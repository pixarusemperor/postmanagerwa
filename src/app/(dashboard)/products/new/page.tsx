'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Upload, X, Image as ImageIcon, Video, Music, File, Download } from 'lucide-react';
import Link from 'next/link';

const CURRENCIES = ['XOF', 'XAF', 'USD', 'EUR', 'GBP', 'NGN'];
const MAX_FILES = 20;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for videos
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/ogg'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav'];
const DOCUMENT_EXTENSIONS = ['.pdf'];

export default function NewProductPage() {
  const { org } = useAuth();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [stockCount, setStockCount] = useState('0');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<{ file: File; preview: string; isVideo: boolean; isAudio: boolean }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const autoCode = useCallback((pn: string): string => {
    if (code && pn === name) return code;
    return pn.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() || 'NEW';
  }, [code, name]);

  useEffect(() => {
    if (!code) setCode(autoCode(name));
  }, [name, code, autoCode]);

  function getFileCategory(type: string): 'image' | 'video' | 'audio' | 'doc' {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'doc';
  }

  function getCategoryIcon(category: string) {
    switch (category) {
      case 'video': return <Video className="w-4 h-4 text-white" />;
      case 'audio': return <Music className="w-4 h-4 text-white" />;
      case 'doc': return <File className="w-4 h-4 text-white" />;
      default: return null;
    }
  }

  async function handleFileInputChange(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles: typeof files = [];
    for (const f of Array.from(fileList)) {
      if (files.length + newFiles.length >= MAX_FILES) break;
      if (f.size > MAX_FILE_SIZE) { setError(`"${f.name}" exceeds 50MB limit.`); continue; }
      const cat = getFileCategory(f.type);
      const isImg = cat === 'image';
      const isVid = cat === 'video';
      const isAud = cat === 'audio';
      newFiles.push({ file: f, preview: isImg ? URL.createObjectURL(f) : '', isVideo: isVid, isAudio: isAud });
    }
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setError('');
    }
  }

  function removeFile(index: number) {
    setFiles(prev => {
      const next = [...prev];
      if (next[index].preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }

  async function uploadFileToR2(file: File, productId: string): Promise<string | null> {
    if (!org) return null;
    try {
      const presignedRes = await fetch('/api/pm/media/upload-url', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, entityType: 'products', entityId: productId }),
      });
      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => ({ error: 'Upload setup failed' }));
        throw new Error(err.error || 'Upload setup failed');
      }
      const { presignedUrl, storagePath } = await presignedRes.json();

      const uploadRes = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status}`);

      const attachRes = await fetch('/api/pm/media/attach', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, orgId: org.id, productId, fileType: file.type, fileSize: file.size }),
      });
      if (!attachRes.ok) {
        const errBody = await attachRes.text();
        console.warn('[attach] failed:', errBody.substring(0, 200));
      }
      return storagePath;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      console.error('[uploadFileToR2]', msg);
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setFieldErrors({});
    if (!name.trim()) { setFieldErrors({ name: 'Product name is required' }); return; }
    if (!org) { setError('No organization selected'); return; }
    setLoading(true);

    try {
      // Step 1: Create product
      const { data: product, error: insertError } = await supabase.schema('pm').from('products').insert({
        organization_id: org.id, code: code.trim() || autoCode(name), name: name.trim(),
        selling_price: sellingPrice !== '' ? Number(sellingPrice) : null,
        cost_price: costPrice !== '' ? Number(costPrice) : null,
        promotional_price: promoPrice !== '' ? Number(promoPrice) : null,
        currency, stock_count: Math.max(0, parseInt(stockCount) || 0),
        description: description.trim() || null,
      }).select().single();

      if (insertError || !product) {
        if (insertError?.code === '23505') { setFieldErrors({ code: 'Product code already exists.' }); }
        else { setError(insertError?.message || 'Failed to create product'); }
        setLoading(false); return;
      }

      // Step 2: Upload files one by one (show progress)
      if (files.length > 0) {
        const uploaded: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(i + 1);
          const path = await uploadFileToR2(files[i].file, product.id);
          if (path) uploaded.push(path);
        }
        setUploadedFiles(uploaded);
      }

      setSuccess(true);
      setTimeout(() => router.push('/products'), uploadProgress > 0 ? 1200 : 600);
    } catch {
      setError('Connection failed. Please try again.');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-lg font-medium">Product created{uploadedFiles.length > 0 ? ` with ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}` : ''}!</p>
          <p className="text-sm text-gray-500 mt-1">Redirecting to products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-xl sm:text-2xl font-bold">New Product</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 sm:p-6 space-y-4">
        {/* File upload section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Media Files ({files.length}/{MAX_FILES})</label>

          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
                  {f.isVideo ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900"><Video className="w-6 h-6 text-white/60" /></div>
                  ) : f.isAudio ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800"><Music className="w-6 h-6 text-white/60" /></div>
                  ) : f.preview ? (
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><File className="w-6 h-6 text-gray-300" /></div>
                  )}
                  {/* Category badge */}
                  {(f.isVideo || f.isAudio) && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                      {f.isVideo ? 'VID' : f.isAudio ? 'AUD' : ''}
                    </div>
                  )}
                  <button type="button" onClick={() => removeFile(i)} className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
            </div>
          )}

          {files.length < MAX_FILES && (
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click to upload images, video, audio, or documents</p>
              <p className="text-xs text-gray-400 mt-1">Images · Video MP4 · Audio MP3 · PDF · up to 50MB</p>
              <p className="text-xs text-gray-400">First image becomes thumbnail</p>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*,video/mp4,audio/mpeg,audio/ogg,.pdf" multiple className="hidden" onChange={e => handleFileInputChange(e.target.files)} />
        </div>

        {/* Name + Code */}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={e => { setName(e.target.value); setCode(autoCode(e.target.value)); }} className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black ${fieldErrors.name ? 'border-red-300' : ''}`} placeholder="Product name" autoFocus />
          {fieldErrors['name'] && <p className="text-red-500 text-xs mt-1">{fieldErrors['name']}</p>}
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} className={`w-full px-3 py-2.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black ${fieldErrors.code ? 'border-red-300' : ''}`} placeholder="AUTO_GENERATED" />
          {fieldErrors['code'] && <p className="text-red-500 text-xs mt-1">{fieldErrors['code']}</p>}
          <p className="text-xs text-gray-400 mt-1">Auto-generated from name. Edit if needed.</p>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label><input type="number" min="0" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label><input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Promotional Price</label><input type="number" min="0" step="0.01" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Stock</label><input type="number" min="0" value={stockCount} onChange={e => setStockCount(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="0" /></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="Optional product description" rows={3} /></div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? (uploadProgress > 0 ? `Uploading ${uploadProgress}/${files.length}...` : 'Creating...') : 'Create Product'}
          </button>
          <Link href="/products" className="px-6 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

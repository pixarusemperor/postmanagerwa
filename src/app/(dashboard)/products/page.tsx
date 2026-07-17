'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { Plus, Search, AlertCircle, ChevronRight, X, Pencil, Image as ImageIcon, Video, Music, File, Download, Copy, Check, Upload, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getMediaPublicUrl } from '@/lib/media/client-upload';

interface Product {
  id: string; code: string; name: string; selling_price: number | null;
  cost_price: number | null; promotional_price: number | null;
  currency: string; stock_count: number; is_active: boolean;
  description: string | null; created_at: string;
  media?: { storage_path: string; id: string; mime_type: string }[];
}

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return '—';
  return `${price.toLocaleString()} ${currency}`;
}

function ProductImage({ product, size }: { product: Product; size: 'sm' | 'lg' }) {
  const first = product.media?.[0];
  const dims = size === 'sm' ? 'w-10 h-10' : 'w-full h-48';
  const rounded = size === 'sm' ? 'rounded' : 'rounded-lg';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-8 h-8';

  if (!first) {
    return (
      <div className={`${dims} ${rounded} bg-gray-100 flex items-center justify-center shrink-0`}>
        <ImageIcon className={`${iconSize} text-gray-300`} />
      </div>
    );
  }

  const mime = first.mime_type || '';
  const url = getMediaPublicUrl(first.storage_path);

  if (mime.startsWith('video/')) {
    return (
      <div className={`${dims} ${rounded} bg-gray-900 flex items-center justify-center shrink-0 relative`}>
        <Video className={`${iconSize} text-white/50`} />
        <span className="absolute bottom-1 right-1 text-[10px] text-white/70 bg-black/40 px-1 rounded">VID</span>
      </div>
    );
  }

  if (mime.startsWith('audio/')) {
    return (
      <div className={`${dims} ${rounded} bg-gray-800 flex items-center justify-center shrink-0`}>
        <Music className={`${iconSize} text-white/50`} />
      </div>
    );
  }

  return (
    <img src={url} alt="" className={`${dims} ${rounded} object-cover shrink-0`} loading="lazy" />
  );
}

export default function ProductsPage() {
  const { org } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function handleUploadToExisting(file: File) {
    if (!selected || !org) return;
    setUploadingMedia(true);
    try {
      // Step 1: Get presigned URL
      const presignedRes = await fetch('/api/pm/media/upload-url', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, entityType: 'products', entityId: selected.id }),
      });
      if (!presignedRes.ok) {
        const txt = await presignedRes.text();
        throw new Error('Presigned URL failed: ' + presignedRes.status + ' ' + txt.substring(0, 100));
      }
      const { presignedUrl, storagePath } = await presignedRes.json();

      // Step 2: Upload to R2
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('R2 upload failed: ' + uploadRes.status);

      // Step 3: Attach metadata
      const attachRes = await fetch('/api/pm/media/attach', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, orgId: org.id, productId: selected.id, fileType: file.type, fileSize: file.size }),
      });
      if (!attachRes.ok) {
        const errTxt = await attachRes.text();
        throw new Error('Attach failed: ' + attachRes.status + ' ' + errTxt.substring(0, 200));
      }

      // Step 4: Refresh media list
      const { data: newMedia } = await supabase.schema('pm').from('media')
        .select('id,storage_path,mime_type,product_id')
        .eq('product_id', selected.id)
        .order('created_at');
      if (newMedia) setSelected(prev => prev ? { ...prev, media: newMedia as any } : prev);
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : 'Unknown error';
      console.error('Upload failed:', msg);
      setError('Upload failed: ' + msg);
    }
    setUploadingMedia(false);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  }

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const { data: prodData, error: prodErr } = await supabase
          .schema('pm')
          .from('products')
          .select('*')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (prodErr) { setError(prodErr.message); setLoading(false); return; }

        const productList = (prodData as Product[]) || [];

        // Fetch media for all products
        if (productList.length > 0) {
          const ids = productList.map(p => p.id);
          const { data: mediaData } = await supabase
            .schema('pm')
            .from('media')
            .select('id, storage_path, product_id, mime_type')
            .in('product_id', ids)
            .order('created_at', { ascending: true });

          if (mediaData) {
            const mediaMap: Record<string, { storage_path: string; id: string; mime_type: string }[]> = {};
            for (const m of mediaData as any[]) {
              if (!mediaMap[m.product_id]) mediaMap[m.product_id] = [];
              mediaMap[m.product_id].push({ storage_path: m.storage_path, id: m.id, mime_type: m.mime_type });
            }
            for (const p of productList) {
              (p as Product).media = mediaMap[p.id] || [];
            }
          }
        }

        if (!cancelled) {
          setProducts(productList);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setError('Failed to connect to database'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [org, supabase]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Products</h1>
        <Link
          href="/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search products..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" /></div>
      ) : (
        <div className="flex gap-4">
          <div className={`${selected ? 'hidden md:block md:w-1/2' : 'w-full'} transition-all`}>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 w-14"></th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Price</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stock</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No products yet. Import or create your first product.</td></tr>
                  ) : (
                    filtered.map(p => (
                      <tr key={p.id} onClick={() => setSelected(p)}
                        className={`border-b last:border-0 cursor-pointer transition-colors ${selected?.id === p.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2"><ProductImage product={p} size="sm" /></td>
                        <td className="px-4 py-3 text-sm font-mono">{p.code}</td>
                        <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-sm">{formatPrice(p.selling_price, p.currency)}</td>
                        <td className="px-4 py-3 text-sm">{p.stock_count}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">No products yet. Import or create your first product.</div>
              ) : (
                filtered.map(p => (
                  <div key={p.id} onClick={() => setSelected(p)}
                    className={`bg-white rounded-xl border p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50 ${selected?.id === p.id ? 'ring-2 ring-black' : ''}`}>
                    <ProductImage product={p} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.code} · {formatPrice(p.selling_price, p.currency)}</p>
                      <p className="text-xs mt-1">
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                        <span className="ml-2 text-gray-400">Stock: {p.stock_count}</span>
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Desktop detail panel */}
          {selected && (
            <div className="hidden md:block md:w-1/2 bg-white rounded-xl border sticky top-4 self-start overflow-hidden">
              {/* Hero image */}
              <ProductImage product={selected} size="lg" />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <p className="text-sm font-mono text-gray-500">{selected.code}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                </div>

                {/* Media gallery with download */}
                {(selected.media?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Media ({selected.media!.length})</p>
                      {selected.media!.length > 0 && (
                        <a href={getMediaPublicUrl(selected.media![0].storage_path)} download className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" /> Download all</a>
                      )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selected.media!.map(m => {
                        const mime = m.mime_type || '';
                        const url = getMediaPublicUrl(m.storage_path);
                        if (mime.startsWith('video/')) return (
                          <a key={m.id} href={url} download className="w-16 h-16 bg-gray-900 rounded flex items-center justify-center shrink-0 relative group">
                            <Video className="w-5 h-5 text-white/50" />
                            <span className="absolute bottom-0.5 right-0.5 text-[9px] text-white/70 bg-black/40 px-1 rounded">VID</span>
                          </a>
                        );
                        if (mime.startsWith('audio/')) return (
                          <a key={m.id} href={url} download className="w-16 h-16 bg-gray-800 rounded flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5 text-white/50" />
                          </a>
                        );
                        return (
                          <a key={m.id} href={url} download className="shrink-0">
                            <img src={url} alt="" className="w-16 h-16 rounded object-cover" loading="lazy" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Selling</p><p className="text-sm font-medium">{formatPrice(selected.selling_price, selected.currency)}</p></div>
                    <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Cost</p><p className="text-sm font-medium">{formatPrice(selected.cost_price, selected.currency)}</p></div>
                    <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Promo</p><p className="text-sm font-medium">{formatPrice(selected.promotional_price, selected.currency)}</p></div>
                    <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Stock</p><p className="text-sm font-medium">{selected.stock_count} units</p></div>
                  </div>
                  <div><p className="text-xs text-gray-500 mb-1">Status</p><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selected.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{selected.is_active ? 'Active' : 'Inactive'}</span></div>
                  {selected.description && <div><p className="text-xs text-gray-500 mb-1">Description</p><p className="text-sm text-gray-700">{selected.description}</p></div>}
                  <div><p className="text-xs text-gray-500 mb-1">Created</p><p className="text-sm text-gray-600">{new Date(selected.created_at).toLocaleDateString()}</p></div>

                  {/* Upload to existing product */}
                  <div className="pt-2 border-t">
                    <input ref={uploadInputRef} type="file" accept="image/*,video/mp4,audio/mpeg,audio/ogg,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadToExisting(e.target.files[0]); }} />
                    <button onClick={() => uploadInputRef.current?.click()} disabled={uploadingMedia}
                      className="w-full px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingMedia ? 'Uploading...' : 'Add Image/Video/Audio'}
                    </button>
                  </div>

                  <Link href={`/products/${selected.id}/edit`}
                    className="w-full mt-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <Pencil className="w-4 h-4" /> Edit Product
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile detail modal */}
      {selected && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <ProductImage product={selected} size="lg" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-sm font-mono text-gray-500">{selected.code}</p></div>
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Selling</p><p className="text-sm font-medium">{formatPrice(selected.selling_price, selected.currency)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Cost</p><p className="text-sm font-medium">{formatPrice(selected.cost_price, selected.currency)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Promo</p><p className="text-sm font-medium">{formatPrice(selected.promotional_price, selected.currency)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Stock</p><p className="text-sm font-medium">{selected.stock_count}</p></div>
                </div>
                <div><p className="text-xs text-gray-500 mb-1">Status</p><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selected.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{selected.is_active ? 'Active' : 'Inactive'}</span></div>
                {selected.description && <div><p className="text-xs text-gray-500 mb-1">Description</p><p className="text-sm text-gray-700">{selected.description}</p></div>}
                <div className="pt-2 flex gap-2">
                  <Link href={`/products/${selected.id}/edit`} className="flex-1 px-4 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 text-center">Edit</Link>
                  <button onClick={() => setSelected(null)} className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg text-sm font-medium">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

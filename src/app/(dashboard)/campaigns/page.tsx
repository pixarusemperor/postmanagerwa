'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { Plus, Megaphone, Calendar, Loader2, AlertCircle, X, Search, Check, Rocket, Pencil, Trash2, Users, Package } from 'lucide-react';

interface Campaign {
  id: string; name: string; description: string | null; status: string; post_mode: string;
  scheduled_start_at: string | null; created_at: string;
}

interface CampaignDetail {
  id: string; name: string; description: string | null; status: string; post_mode: string;
  scheduled_start_at: string | null; created_at: string; created_by?: string | null;
  target_list?: { id: string; name: string; target_count?: number } | null;
  posts?: { id: string; position: number; snapshot: any; caption_override: string | null }[];
  dispatch_count?: number;
}

interface Product { id: string; name: string; code: string; selling_price: number | null; currency: string; }
interface TargetList { id: string; name: string; }
interface Template { id: string; name: string; body: string; }

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', scheduled: 'Scheduled', running: 'Running', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled' };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-700', scheduled: 'bg-blue-100 text-blue-700', running: 'bg-green-100 text-green-700', paused: 'bg-gray-100 text-gray-600', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

export default function CampaignsPage() {
  const { org, user } = useAuth();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [targetLists, setTargetLists] = useState<TargetList[]>([]);
  const [selectedTargetListId, setSelectedTargetListId] = useState('');
  const [selectedPostMode, setSelectedPostMode] = useState<'manual' | 'automated' | 'export'>('manual');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (!org) return;
    loadCampaigns();
  }, [org]);

  const loadCampaigns = async () => {
    if (!org) return;
    const { data, error: qe } = await supabase.schema('pm').from('campaigns').select('*').eq('organization_id', org.id).order('created_at', { ascending: false });
    if (qe) { setError(qe.message); setLoading(false); return; }
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  };

  const openDetail = async (campaign: Campaign) => {
    setDetailLoading(true);
    setDetailError(null);
    setView('detail');
    const detail: CampaignDetail = { ...campaign };

    // Get target list info + count
    const { data: ctl } = await supabase.schema('pm').from('campaign_target_lists').select('target_list_id').eq('campaign_id', campaign.id).single();
    if (ctl) {
      const { data: tl } = await supabase.schema('pm').from('target_lists').select('id,name').eq('id', ctl.target_list_id).single();
      const { count } = await supabase.schema('pm').from('targets').select('*', { count: 'exact', head: true }).eq('target_list_id', ctl.target_list_id);
      detail.target_list = tl ? { ...tl, target_count: count ?? 0 } : null;
    }

    // Get posts
    const { data: posts } = await supabase.schema('pm').from('posts').select('id,position,snapshot,caption_override').eq('campaign_id', campaign.id).order('position');
    detail.posts = (posts as any[]) || [];

    // Get dispatch count
    const { count: dc } = await supabase.schema('pm').from('dispatches').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id);
    detail.dispatch_count = dc ?? 0;

    setSelectedCampaign(detail);
    setDetailLoading(false);
  };

  const generateDispatches = async () => {
    if (!selectedCampaign) return;
    setGenerating(true);
    setGenError(null);
    setGenSuccess(null);
    try {
      const res = await fetch(`/api/pm/campaigns/${selectedCampaign.id}/generate-dispatches`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || 'Dispatch generation failed');
      } else {
        setGenSuccess(`Generated ${data.dispatch_count} dispatches across ${data.target_count} targets and ${data.post_count} posts.`);
        // Refresh detail
        const updated = { ...selectedCampaign, status: 'scheduled', dispatch_count: data.dispatch_count };
        setSelectedCampaign(updated);
        // Update in list
        setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, status: 'scheduled' } : c));
      }
    } catch {
      setGenError('Connection failed during dispatch generation.');
    }
    setGenerating(false);
  };

  const loadResources = async () => {
    if (!org) return;
    const [prodRes, targetRes, templRes] = await Promise.all([
      supabase.schema('pm').from('products').select('id,name,code,selling_price,currency').eq('organization_id', org.id).order('name'),
      supabase.schema('pm').from('target_lists').select('id,name').eq('organization_id', org.id).order('name'),
      supabase.schema('pm').from('caption_templates').select('id,name,body').eq('organization_id', org.id).order('name'),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (targetRes.data) setTargetLists(targetRes.data as TargetList[]);
    if (templRes.data) setTemplates(templRes.data as Template[]);
  };

  const openCreate = async () => { await loadResources(); setView('create'); setFormSuccess(false); setSelectedProducts([]); setSelectedTargetListId(''); setSelectedTemplateId(''); };
  const toggleProduct = (p: Product) => { setSelectedProducts(prev => prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !org) { setFormError('Campaign name required'); return; }
    if (selectedProducts.length === 0) { setFormError('Select at least one product'); return; }
    if (!selectedTargetListId) { setFormError('Select a target list'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      const { data: campaign, error: campErr } = await supabase.schema('pm').from('campaigns').insert({
        organization_id: org.id, name: formName.trim(), description: formDesc.trim() || null,
        scheduled_start_at: formDate || null, created_by: user?.id ?? null, post_mode: selectedPostMode,
      }).select().single();
      if (campErr || !campaign) { setFormError(campErr?.message || 'Failed'); setFormLoading(false); return; }

      await supabase.schema('pm').from('campaign_target_lists').insert({ campaign_id: campaign.id, target_list_id: selectedTargetListId });
      for (let i = 0; i < selectedProducts.length; i++) {
        const p = selectedProducts[i];
        let caption: string | null = null;
        if (template) {
          caption = template.body.replace(/\{\{Product Name\}\}/g, p.name).replace(/\{\{Product Code\}\}/g, p.code).replace(/\{\{Selling Price\}\}/g, p.selling_price?.toLocaleString() || '—').replace(/\{\{Currency\}\}/g, p.currency).replace(/\{\{WhatsApp Link\}\}/g, 'wa.me/...');
        }
        await supabase.schema('pm').from('posts').insert({ campaign_id: campaign.id, position: i, snapshot: { name: p.name, code: p.code, selling_price: p.selling_price, currency: p.currency, product_id: p.id }, caption_override: caption });
      }

      // Generate dispatches — surface errors to user
      let dispatchErr: string | null = null;
      try {
        const res = await fetch(`/api/pm/campaigns/${campaign.id}/generate-dispatches`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) dispatchErr = data.error;
      } catch {
        dispatchErr = 'Dispatch generation failed. You can retry from the campaign detail view.';
      }

      if (dispatchErr) {
        setFormError(`Campaign created but dispatches could not be generated: ${dispatchErr}. Add targets to your list and retry from the campaign list.`);
        setFormLoading(false);
        setCampaigns(prev => [{ ...campaign, status: 'draft' }, ...prev]);
        setTimeout(() => { setView('list'); setFormName(''); setFormDesc(''); setFormDate(''); setSelectedProducts([]); setSelectedTargetListId(''); setFormError(''); }, 2000);
        return;
      }

      setFormSuccess(true);
      setCampaigns(prev => [{ ...campaign, status: 'scheduled' }, ...prev]);
      setTimeout(() => { router.push('/poster'); }, 800);
    } catch (e) { setFormError('Connection failed: ' + (e instanceof Error ? e.message : 'Unknown error')); }
    setFormLoading(false);
  };

  const moveUp = (i: number) => { if (i === 0) return; setSelectedProducts(prev => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; }); };
  const moveDown = (i: number) => { if (i >= selectedProducts.length - 1) return; setSelectedProducts(prev => { const n = [...prev]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; }); };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase()));

  if (view === 'detail' && selectedCampaign) {
    return (
      <div>
        <button onClick={() => { setView('list'); setSelectedCampaign(null); }} className="text-sm text-gray-500 hover:text-black mb-4 flex items-center gap-1">← Back to campaigns</button>

        {detailLoading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <div className="space-y-4">
            {/* Campaign header */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div><h1 className="text-xl font-bold">{selectedCampaign.name}</h1>
                  {selectedCampaign.description && <p className="text-sm text-gray-500 mt-1">{selectedCampaign.description}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[selectedCampaign.status]}`}>{STATUS_LABELS[selectedCampaign.status]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {selectedCampaign.scheduled_start_at && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(selectedCampaign.scheduled_start_at).toLocaleString()}</span>}
                <span className="capitalize">{selectedCampaign.post_mode} mode</span>
                <span>Created {new Date(selectedCampaign.created_at).toLocaleDateString()}</span>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <button onClick={generateDispatches} disabled={generating} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {selectedCampaign.status === 'draft' ? 'Generate Dispatches' : 'Regenerate Dispatches'}
                </button>
                {selectedCampaign.dispatch_count && selectedCampaign.dispatch_count > 0 ? (
                  <button onClick={() => router.push('/poster')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2">
                    View in Poster Queue ({selectedCampaign.dispatch_count} tasks)
                  </button>
                ) : null}
              </div>
              {genError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{genError}</div>}
              {genSuccess && <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><Check className="w-4 h-4 shrink-0" />{genSuccess}</div>}
            </div>

            {/* Target list info */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Target List</h2>
              {selectedCampaign.target_list ? (
                <div>
                  <p className="text-sm">{selectedCampaign.target_list.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedCampaign.target_list.target_count} target{selectedCampaign.target_list.target_count !== 1 ? 's' : ''} in this list</p>
                  {selectedCampaign.target_list.target_count === 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                      ⚠️ This target list is empty. <a href="/targets" className="underline font-medium">Add targets</a> before generating dispatches.
                    </div>
                  )}
                </div>
              ) : <p className="text-sm text-gray-400">No target list linked</p>}
            </div>

            {/* Posts */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Posts ({selectedCampaign.posts?.length || 0})</h2>
              {selectedCampaign.posts && selectedCampaign.posts.length > 0 ? (
                <div className="space-y-1">
                  {selectedCampaign.posts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                      <span className="font-mono text-xs text-gray-400 w-5">{p.position + 1}.</span>
                      <span className="flex-1 font-medium">{p.snapshot.name || 'Untitled'}</span>
                      <span className="text-xs text-gray-400 font-mono">{p.snapshot.code}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No posts</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Campaigns</h1>
        {view === 'list' && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> New Campaign</button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

      {view === 'create' && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">New Campaign</h2><button onClick={() => setView('list')} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button></div>
          {formSuccess ? (
            <div className="flex items-center gap-2 py-2"><div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-green-600" /></div><span className="text-sm text-green-700">Campaign created! Redirecting to poster queue...</span></div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name <span className="text-red-500">*</span></label><input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" autoFocus /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="datetime-local" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Posting Mode</label>
                <div className="flex gap-2">{(['manual', 'automated', 'export'] as const).map(m => (<button key={m} type="button" onClick={() => setSelectedPostMode(m)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${selectedPostMode === m ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{m}</button>))}</div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Products ({selectedProducts.length} selected) <span className="text-red-500">*</span></label>
                {selectedProducts.length > 0 && <div className="space-y-1 mb-2">{selectedProducts.map((p, i) => (<div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm"><div className="flex flex-col gap-0.5"><button type="button" onClick={() => moveUp(i)} className="p-0.5 hover:bg-gray-200 rounded" title="Move up"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg></button><button type="button" onClick={() => moveDown(i)} className="p-0.5 hover:bg-gray-200 rounded" title="Move down"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></button></div><span className="font-mono text-xs text-gray-400">{i+1}.</span><span className="flex-1 font-medium truncate">{p.name}</span><button type="button" onClick={() => toggleProduct(p)} className="p-0.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button></div>))}</div>}
                <button type="button" onClick={() => setShowProductSelector(!showProductSelector)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 text-left flex items-center gap-2"><Search className="w-4 h-4" />{showProductSelector ? 'Close' : 'Add products...'}</button>
                {showProductSelector && (<div className="mt-2 border rounded-lg overflow-hidden"><input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search..." className="w-full px-3 py-2 border-b text-sm focus:outline-none" /><div className="max-h-48 overflow-y-auto">{filteredProducts.length === 0 ? <p className="px-3 py-4 text-sm text-gray-500 text-center">No products</p> : filteredProducts.map(p => { const isSel = selectedProducts.some(x => x.id === p.id); return (<button key={p.id} type="button" onClick={() => toggleProduct(p)} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${isSel ? 'bg-gray-100 font-medium' : ''}`}><div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-black border-black' : 'border-gray-300'}`}>{isSel && <Check className="w-3 h-3 text-white" />}</div><span>{p.name}</span><span className="text-xs text-gray-400 font-mono ml-auto">{p.code}</span></button>); })}</div></div>)}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Target List <span className="text-red-500">*</span></label><select value={selectedTargetListId} onChange={e => setSelectedTargetListId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"><option value="">Select a target list...</option>{targetLists.map(tl => <option key={tl.id} value={tl.id}>{tl.name}</option>)}</select>{targetLists.length === 0 && <p className="text-xs text-gray-400 mt-1">No target lists. <a href="/targets" className="underline">Create one</a>.</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Caption Template (optional)</label><select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"><option value="">No template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" rows={2} /></div>
              <div className="flex gap-2"><button type="submit" disabled={formLoading} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">{formLoading && <Loader2 className="w-4 h-4 animate-spin" />}{formLoading ? 'Creating...' : 'Create Campaign'}</button><button type="button" onClick={() => setView('list')} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button></div>
            </form>
          )}
        </div>
      )}

      {view === 'list' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center"><Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" /><h2 className="text-lg font-semibold mb-1">No campaigns yet</h2><p className="text-sm text-gray-500 mb-4">Create your first WhatsApp marketing campaign.</p><button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> New Campaign</button></div>
        ) : (
          <div className="space-y-2">
            {campaigns.map(c => (
              <div key={c.id} onClick={() => openDetail(c)} className="bg-white rounded-xl border p-4 hover:border-gray-300 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-sm">{c.name}</h3>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[c.status] || c.status}</span>
                      {c.scheduled_start_at && <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar className="w-3 h-3" />{new Date(c.scheduled_start_at).toLocaleDateString()}</span>}
                      <span className="text-xs text-gray-400 capitalize">{c.post_mode}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openDetail(c)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400" title="View details"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

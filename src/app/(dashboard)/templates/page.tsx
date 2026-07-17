'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { Plus, FileText, X, Loader2, AlertCircle, Trash2, Pencil, MessageSquare, Copy, Check, Download } from 'lucide-react';

interface Template {
  id: string; name: string; body: string; created_at: string; updated_at: string;
}

const CAPTION_VARIABLES = [
  { key: '{{Selling Price}}', desc: 'Selling price', preview: '15,000' },
  { key: '{{Cost Price}}', desc: 'Cost price', preview: '8,000' },
  { key: '{{Promotional Price}}', desc: 'Promotional price', preview: '12,000' },
  { key: '{{Discounted Price}}', desc: 'Discounted price', preview: '9,999' },
  { key: '{{Currency}}', desc: 'Currency code', preview: 'XOF' },
  { key: '{{Product Name}}', desc: 'Product name', preview: 'iPhone 15 Pro' },
  { key: '{{Product Code}}', desc: 'Product code', preview: 'IP15P' },
  { key: '{{WhatsApp Link}}', desc: 'wa.me link', preview: 'wa.me/237...' },
  { key: '{{Margin}}', desc: 'Selling - Cost', preview: '7,000' },
  { key: '{{Discount Amount}}', desc: 'Selling - Discounted', preview: '5,001' },
  { key: '{{Discount Percent}}', desc: 'Discount %', preview: '33%' },
];

const PREFILLED_VARIABLES = [
  { key: '{{Product Name}}', desc: 'Product name', preview: 'iPhone 15 Pro' },
  { key: '{{Product Code}}', desc: 'Product code', preview: 'IP15P' },
  { key: '{{Selling Price}}', desc: 'Selling price', preview: '15,000' },
  { key: '{{Currency}}', desc: 'Currency code', preview: 'XOF' },
];

function resolvePreview(body: string, vars: typeof CAPTION_VARIABLES): string {
  let result = body;
  for (const v of vars) result = result.replaceAll(v.key, v.preview);
  return result;
}

function TemplateForm({
  template, onSave, onCancel, table, title,
}: {
  template: Template | null; onSave: () => void; onCancel: () => void; table: 'caption' | 'prefilled'; title: string;
}) {
  const { org } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [name, setName] = useState(template?.name || '');
  const [body, setBody] = useState(template?.body || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const vars = table === 'caption' ? CAPTION_VARIABLES : PREFILLED_VARIABLES;
  const tableName = table === 'caption' ? 'caption_templates' : 'prefilled_message_templates';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim() || !org) { setError('Name and body required'); return; }
    setLoading(true);
    const payload = { name: name.trim(), body, updated_at: new Date().toISOString() };
    let err;
    if (template) {
      ({ error: err } = await supabase.schema('pm').from(tableName).update(payload).eq('id', template.id));
    } else {
      ({ error: err } = await supabase.schema('pm').from(tableName).insert({ ...payload, organization_id: org.id }));
    }
    if (err) { setError(err.message); setLoading(false); return; }
    setLoading(false);
    onSave();
  };

  const copyBody = async () => {
    try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="bg-white rounded-xl border p-5 mb-6">
      <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button></div>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="e.g. Standard Product" autoFocus /></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body <span className="text-red-500">*</span></label>
          <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black font-mono" rows={5} />
          <div className="flex flex-wrap gap-1 mt-2">
            {vars.map(v => (<button key={v.key} type="button" onClick={() => setBody(prev => prev + ' ' + v.key)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono transition-colors" title={v.desc}>{v.key}</button>))}
          </div>
        </div>
        {body && (
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Preview</p>
            <p className="text-sm whitespace-pre-wrap">{resolvePreview(body, vars)}</p>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? 'Saving...' : template ? 'Update' : 'Create'}</button>
          <button type="button" onClick={copyBody} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy Body'}</button>
          {table === 'prefilled' && body && (
            <a href={`https://wa.me/237?text=${encodeURIComponent(resolvePreview(body, vars))}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"><MessageSquare className="w-4 h-4" /> Test in WhatsApp</a>
          )}
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function TemplatesPage() {
  const { org } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [tab, setTab] = useState<'caption' | 'prefilled'>('caption');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const tableName = tab === 'caption' ? 'caption_templates' : 'prefilled_message_templates';

  const load = async () => {
    if (!org) return;
    const { data, error: qe } = await supabase.schema('pm').from(tableName).select('*').eq('organization_id', org.id).order('created_at', { ascending: false });
    if (qe) { setError(qe.message); setLoading(false); return; }
    setTemplates((data as Template[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (org) { setLoading(true); load(); } }, [org, tab]);

  const openCreate = () => { setEditingTemplate(null); setShowForm(true); };
  const openEdit = (t: Template) => { setEditingTemplate(t); setShowForm(true); };

  const handleSaved = () => { setShowForm(false); load(); };
  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.schema('pm').from(tableName).delete().eq('id', deleteId);
    setDeleteId(null);
    await load();
  };

  const vars = tab === 'caption' ? CAPTION_VARIABLES : PREFILLED_VARIABLES;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Templates</h1>
        {!showForm && <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> New Template</button>}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('caption')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'caption' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          <FileText className="w-4 h-4 inline mr-1.5" /> Caption Templates
        </button>
        <button onClick={() => setTab('prefilled')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'prefilled' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          <MessageSquare className="w-4 h-4 inline mr-1.5" /> Prefilled Messages
        </button>
      </div>

      {tab === 'prefilled' && !showForm && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <strong>Prefilled messages</strong> are used in wa.me links. When a customer clicks a WhatsApp link from your post, they see this message pre-filled in the chat. Variables like {'{{Product Code}}'} help chatbot auto-routing.
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

      {showForm && (
        <TemplateForm
          template={editingTemplate}
          onSave={handleSaved}
          onCancel={() => setShowForm(false)}
          table={tab}
          title={`${editingTemplate ? 'Edit' : 'New'} ${tab === 'caption' ? 'Caption' : 'Prefilled Message'} Template`}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete template?</h3>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-2"><button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button><button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button></div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          {tab === 'caption' ? <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" /> : <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />}
          <h2 className="text-lg font-semibold mb-1">No {tab === 'caption' ? 'caption' : 'prefilled message'} templates</h2>
          <p className="text-sm text-gray-500 mb-4">
            {tab === 'caption' ? 'Create reusable caption templates with variables.' : 'Create prefilled WhatsApp message templates for wa.me links.'}
          </p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> New Template</button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-medium text-sm">{t.name}</h3>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={() => setDeleteId(t.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
              </div>
              <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{resolvePreview(t.body, vars)}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(t.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

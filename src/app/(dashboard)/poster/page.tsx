'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Check, Download, Video, Music, File } from 'lucide-react';
import { getMediaPublicUrl } from '@/lib/media/client-upload';

interface DispatchRaw {
  id: string; scheduled_at: string; status: string; resolved_caption: string | null;
  target: { jid: string; display_name: string | null; id: string } | { jid: string; display_name: string | null; id: string }[];
  campaign_id: string;
  post: {
    snapshot: { name?: string; code?: string; product_id?: string; selling_price?: number; currency?: string };
    id: string;
  } | { snapshot: { name?: string; code?: string; product_id?: string; selling_price?: number; currency?: string }; id: string }[];
}

interface DispatchItem {
  id: string; scheduled_at: string; status: string; resolved_caption: string | null;
  target: { jid: string; display_name: string | null; id: string } | null;
  campaign_id: string;
  post: { snapshot: { name?: string; code?: string; product_id?: string; selling_price?: number; currency?: string }; id: string } | null;
  media?: { storage_path: string; mime_type: string }[];
}

interface ContactNumber { id: string; country_code: string; phone_number: string; label: string | null; }
interface PrefilledTemplate { id: string; name: string; body: string; }

const DEFAULT_PREFILLED = 'Salut je veux commander {{Product Code}} ({{Product Name}}) à {{Selling Price}} {{Currency}}';

function normalizeDispatches(raw: DispatchRaw[]): DispatchItem[] {
  return raw.map(d => ({
    id: d.id, scheduled_at: d.scheduled_at, status: d.status, resolved_caption: d.resolved_caption,
    campaign_id: d.campaign_id,
    target: Array.isArray(d.target) ? d.target[0] ?? null : d.target ?? null,
    post: Array.isArray(d.post) ? d.post[0] ?? null : d.post ?? null,
  }));
}

function resolveCaption(caption: string | null, snapshot: any, template: PrefilledTemplate | null): string {
  if (caption) return caption;
  const tpl = template?.body || DEFAULT_PREFILLED;
  const name = snapshot?.name || 'Untitled';
  const code = snapshot?.code || '';
  const price = snapshot?.selling_price?.toLocaleString() || '';
  const currency = snapshot?.currency || 'XOF';
  return tpl
    .replace(/\{\{Product Name\}\}/g, name)
    .replace(/\{\{Product Code\}\}/g, code)
    .replace(/\{\{Selling Price\}\}/g, price)
    .replace(/\{\{Currency\}\}/g, currency);
}

export default function PosterPage() {
  const { org, user } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Contact number selector
  const [contacts, setContacts] = useState<ContactNumber[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');

  // Prefilled template
  const [prefilledTemplate, setPrefilledTemplate] = useState<PrefilledTemplate | null>(null);

  useEffect(() => {
    if (!org) return;

    // Load contacts
    supabase.schema('pm').from('contact_numbers').select('id,country_code,phone_number,label').eq('organization_id', org.id).order('created_at').then(({ data }) => {
      if (data && data.length > 0) {
        setContacts(data as ContactNumber[]);
        const stored = sessionStorage.getItem('pm_contact_id');
        if (stored && data.some((c: any) => c.id === stored)) {
          setSelectedContactId(stored);
        } else {
          setSelectedContactId(data[0].id);
        }
      }
    });

    // Load default prefilled template (first one)
    supabase.schema('pm').from('prefilled_message_templates').select('id,name,body').eq('organization_id', org.id).order('created_at').limit(1).then(({ data }) => {
      if (data && data.length > 0) setPrefilledTemplate(data[0] as PrefilledTemplate);
    });

    // Load dispatches
    let cancelled = false;
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const { data, error: qe } = await supabase.schema('pm').from('dispatches')
          .select('id, scheduled_at, status, resolved_caption, campaign_id, target:target_id (id, jid, display_name), post:post_id (snapshot, id)')
          .eq('organization_id', org.id).in('status', ['pending', 'in_progress', 'delayed'])
          .lte('scheduled_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()).order('scheduled_at');

        if (cancelled) return;
        if (qe) { setError(qe.message); setLoading(false); return; }

        const list = normalizeDispatches(data || []);

        // Fetch media
        const productIds = list.map(d => d.post?.snapshot?.product_id).filter(Boolean) as string[];
        if (productIds.length > 0) {
          const { data: mediaData } = await supabase.schema('pm').from('media').select('storage_path, mime_type, product_id').in('product_id', productIds).order('created_at');
          if (mediaData) {
            const mediaMap: Record<string, { storage_path: string; mime_type: string }[]> = {};
            for (const m of mediaData as any[]) {
              if (!mediaMap[m.product_id]) mediaMap[m.product_id] = [];
              mediaMap[m.product_id].push({ storage_path: m.storage_path, mime_type: m.mime_type });
            }
            for (const d of list) {
              const pid = d.post?.snapshot?.product_id;
              if (pid && mediaMap[pid]) (d as any).media = mediaMap[pid];
            }
          }
        }

        if (!cancelled) { setDispatches(list); setLoading(false); }
      } catch {
        if (!cancelled) { setError('Failed to connect'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [org, supabase]);

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  function buildWaLink(snapshot: any, contact: ContactNumber | undefined): string {
    if (!contact) return '#';
    const resolved = resolveCaption(null, snapshot, prefilledTemplate);
    return `https://wa.me/${contact.country_code}${contact.phone_number}?text=${encodeURIComponent(resolved)}`;
  }

  function handleContactChange(id: string) {
    setSelectedContactId(id);
    sessionStorage.setItem('pm_contact_id', id);
  }

  async function markDone(dispatchId: string) {
    setActionError(null);
    try {
      const { error: markError } = await supabase.schema('pm').from('dispatches')
        .update({ status: 'done', actual_sent_at: new Date().toISOString(), posted_by: user?.id }).eq('id', dispatchId);
      if (markError) { setActionError('Failed: ' + markError.message); return; }

      try { await supabase.schema('pm').from('action_logs').insert({ organization_id: org?.id, actor_id: user?.id, action_code: 'dispatch_marked_done', entity_type: 'dispatch', entity_id: dispatchId }); } catch {}
      setDispatches(prev => prev.filter(d => d.id !== dispatchId));
    } catch { setActionError('Connection failed.'); }
  }

  async function copyCaption(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); } catch {}
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Today&apos;s Posting Queue</h1>

        {/* Contact number selector */}
        {contacts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sending as:</span>
            <select value={selectedContactId} onChange={e => handleContactChange(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
              {contacts.map(c => (<option key={c.id} value={c.id}>{c.label || `+${c.country_code} ${c.phone_number}`}</option>))}
            </select>
          </div>
        )}
      </div>

      {contacts.length === 0 && !loading && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          No contact numbers configured. <a href="/contacts" className="underline font-medium">Add a contact number</a> to enable WhatsApp links.
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
      {actionError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{actionError}</span></div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" /></div>
      ) : dispatches.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 sm:p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No posts scheduled for today.</p>
          <p className="text-xs text-gray-400 mt-1"><a href="/campaigns" className="underline">Create a campaign</a> to generate dispatches.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dispatches.map(d => {
            const caption = resolveCaption(d.resolved_caption, d.post?.snapshot, null);
            const waLink = buildWaLink(d.post?.snapshot, selectedContact);

            return (
              <div key={d.id} className="bg-white border rounded-lg p-3 sm:p-4">
                <div className="flex gap-3">
                  {(d as any).media?.[0] && ((d as any).media[0].mime_type?.startsWith('video/') ? (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 relative">
                      <Video className="w-5 h-5 text-white/50" />
                      <a href={getMediaPublicUrl((d as any).media[0].storage_path)} download className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 rounded-lg transition-opacity">
                        <Download className="w-5 h-5 text-white" />
                      </a>
                    </div>
                  ) : (d as any).media[0].mime_type?.startsWith('audio/') ? (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 relative">
                      <Music className="w-5 h-5 text-white/50" />
                      <a href={getMediaPublicUrl((d as any).media[0].storage_path)} download className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 rounded-lg transition-opacity">
                        <Download className="w-5 h-5 text-white" />
                      </a>
                    </div>
                  ) : (
                    <div className="relative shrink-0 group">
                      <img src={getMediaPublicUrl((d as any).media[0].storage_path)} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover" loading="lazy" />
                      <a href={getMediaPublicUrl((d as any).media[0].storage_path)} download className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 rounded-lg transition-opacity">
                        <Download className="w-5 h-5 text-white" />
                      </a>
                    </div>
                  ))}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{d.post?.snapshot?.name || 'Untitled'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {d.target?.display_name || d.target?.jid || 'Unknown'}
                          {' · '}{new Date(d.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => copyCaption(caption, d.id)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shrink-0 ${copiedId === d.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                      >
                        {copiedId === d.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="hidden sm:inline">{copiedId === d.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="mt-2 bg-gray-50 rounded-lg p-2 sm:p-3">
                      <p className="text-xs sm:text-sm whitespace-pre-wrap text-gray-700">{caption}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      {selectedContact && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          <span className="hidden sm:inline">Open WhatsApp</span>
                          <span className="sm:hidden">WhatsApp</span>
                        </a>
                      )}
                      {!selectedContact && <div />}
                      <button onClick={() => markDone(d.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors active:bg-green-800">Mark Done</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

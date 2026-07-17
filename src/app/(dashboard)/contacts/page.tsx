'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { Plus, Phone, X, Loader2, AlertCircle, Trash2, Pencil, ExternalLink, Copy, Check } from 'lucide-react';

interface Contact {
  id: string; phone_number: string; country_code: string; label: string | null;
  is_also_wa_poster: boolean; created_at: string;
}

export default function ContactsPage() {
  const { org } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formCountryCode, setFormCountryCode] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWaPoster, setFormWaPoster] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const loadContacts = async () => {
    if (!org) return;
    const { data, error: qe } = await supabase.schema('pm').from('contact_numbers').select('*').eq('organization_id', org.id).order('created_at');
    if (qe) { setError(qe.message); return; }
    setContacts((data as Contact[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (org) loadContacts(); }, [org]);

  const openCreate = () => { setEditingId(null); setFormLabel(''); setFormCountryCode(''); setFormPhone(''); setFormWaPoster(false); setFormError(''); setShowForm(true); };
  const openEdit = (c: Contact) => { setEditingId(c.id); setFormLabel(c.label || ''); setFormCountryCode(c.country_code); setFormPhone(c.phone_number); setFormWaPoster(c.is_also_wa_poster); setFormError(''); setShowForm(true); };

  const buildWaLink = (cc: string, phone: string) => `https://wa.me/${cc}${phone}`;

  const copyLink = async (cc: string, phone: string, id: string) => {
    try {
      await navigator.clipboard.writeText(buildWaLink(cc, phone));
      setCopied(id); setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCountryCode.trim() || !formPhone.trim()) { setFormError('Country code and phone number required'); return; }
    if (!org) return;
    setFormLoading(true);
    const payload = { country_code: formCountryCode.trim(), phone_number: formPhone.trim().replace(/[^0-9]/g, ''), label: formLabel.trim() || null, is_also_wa_poster: formWaPoster };
    let err;
    if (editingId) {
      ({ error: err } = await supabase.schema('pm').from('contact_numbers').update(payload).eq('id', editingId));
    } else {
      ({ error: err } = await supabase.schema('pm').from('contact_numbers').insert({ ...payload, organization_id: org.id }));
    }
    if (err) { setFormError(err.message); setFormLoading(false); return; }
    setShowForm(false);
    await loadContacts();
    setFormLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.schema('pm').from('contact_numbers').delete().eq('id', id);
    await loadContacts();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Contact Numbers</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> Add Number</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

      {showForm && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{editingId ? 'Edit' : 'New'} Contact Number</h2><button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button></div>
          {formError && <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{formError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
              <input type="text" value={formLabel} onChange={e => setFormLabel(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="e.g. Main Sales Line" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country Code <span className="text-red-500">*</span></label>
                <input type="text" value={formCountryCode} onChange={e => setFormCountryCode(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="237" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="691234567" />
              </div>
            </div>

            {/* Live wa.me preview */}
            {formCountryCode && formPhone && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 mb-1 font-medium">wa.me link preview:</p>
                <p className="text-sm font-mono text-green-800 break-all">{buildWaLink(formCountryCode, formPhone.replace(/[^0-9]/g, ''))}</p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formWaPoster} onChange={e => setFormWaPoster(e.target.checked)} className="rounded border-gray-300" /> Use as WA Poster (automated posting)</label>

            <div className="flex gap-2">
              <button type="submit" disabled={formLoading} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">{formLoading && <Loader2 className="w-4 h-4 animate-spin" />}{formLoading ? 'Saving...' : editingId ? 'Update' : 'Add Number'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" /></div>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Phone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">No contact numbers</h2>
          <p className="text-sm text-gray-500 mb-4">Add the WhatsApp phone numbers your organization sends messages from. These are used in wa.me links.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> Add Number</button>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-sm">{c.label || 'Untitled'}</h3>
                  <p className="text-sm font-mono text-gray-700 mt-0.5">+{c.country_code} {c.phone_number}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button onClick={() => copyLink(c.country_code, c.phone_number, c.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${copied === c.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {copied === c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === c.id ? 'Copied' : `wa.me/+${c.country_code}${c.phone_number}`}
                    </button>
                    <a href={buildWaLink(c.country_code, c.phone_number)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium hover:bg-green-100"><ExternalLink className="w-3 h-3" /> Open</a>
                  </div>
                  {c.is_also_wa_poster && <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">WA Poster</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

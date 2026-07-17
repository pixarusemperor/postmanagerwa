'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { Plus, Target, X, Loader2, AlertCircle, Upload, Trash2 } from 'lucide-react';

interface TargetList {
  id: string; name: string; description: string | null; created_at: string;
  target_count?: number;
}

interface TargetItem {
  id: string; type: string; jid: string; display_name: string | null;
}

export default function TargetsPage() {
  const { org } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [lists, setLists] = useState<TargetList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<TargetList | null>(null);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Add target form
  const [newJid, setNewJid] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('group');
  const [addLoading, setAddLoading] = useState(false);

  const loadLists = async () => {
    if (!org) return;
    const { data, error: qe } = await supabase.schema('pm').from('target_lists').select('*').eq('organization_id', org.id).order('created_at', { ascending: false });
    if (qe) { setError(qe.message); return; }
    setLists((data as TargetList[]) || []);
    setLoading(false);
  };

  const loadTargets = async (listId: string) => {
    setTargetsLoading(true);
    const { data } = await supabase.schema('pm').from('targets').select('*').eq('target_list_id', listId).order('created_at');
    setTargets((data as TargetItem[]) || []);
    setTargetsLoading(false);
  };

  useEffect(() => { if (org) loadLists(); }, [org, supabase]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !org) { setFormError('Name required'); return; }
    setFormLoading(true);
    const { error: ie } = await supabase.schema('pm').from('target_lists').insert({ organization_id: org.id, name: formName.trim(), description: formDesc.trim() || null });
    if (ie) { setFormError(ie.message); setFormLoading(false); return; }
    setShowCreate(false); setFormName(''); setFormDesc(''); setFormError('');
    await loadLists();
    setFormLoading(false);
  };

  const handleAddTarget = async () => {
    if (!newJid.trim() || !selectedList) return;
    setAddLoading(true);
    const { error: ie } = await supabase.schema('pm').from('targets').insert({ target_list_id: selectedList.id, type: newType, jid: newJid.trim(), display_name: newName.trim() || null });
    if (!ie) { setNewJid(''); setNewName(''); await loadTargets(selectedList.id); await loadLists(); }
    setAddLoading(false);
  };

  const handleDeleteTarget = async (id: string) => {
    await supabase.schema('pm').from('targets').delete().eq('id', id);
    if (selectedList) { await loadTargets(selectedList.id); await loadLists(); }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedList) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const parts = line.split(',').map(s => s.trim());
        const jid = parts[0]?.replace(/[^0-9]/g, '');
        const name = parts[1] || null;
        if (jid && jid.length > 5) {
          await supabase.schema('pm').from('targets').insert({ target_list_id: selectedList.id, type: jid.includes('-') ? 'group' : 'individual', jid, display_name: name });
        }
      }
      await loadTargets(selectedList.id);
      await loadLists();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Target Lists</h1>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

      {showCreate && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">New Target List</h2><button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button></div>
          {formError && <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{formError}</div>}
          <form onSubmit={handleCreateList} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label><input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="e.g. Fashion Groups Q2" autoFocus /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="Optional" /></div>
            <div className="flex gap-2"><button type="submit" disabled={formLoading} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">{formLoading && <Loader2 className="w-4 h-4 animate-spin" />}{formLoading ? 'Creating...' : 'Create List'}</button><button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button></div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" /></div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">No target lists</h2>
          <p className="text-sm text-gray-500 mb-4">Create lists of WhatsApp groups and contacts for your campaigns.</p>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"><Plus className="w-4 h-4" /> New List</button>
        </div>
      ) : selectedList ? (
        <div>
          <button onClick={() => setSelectedList(null)} className="text-sm text-gray-500 hover:text-black mb-4 flex items-center gap-1">← Back to lists</button>
          <div className="bg-white rounded-xl border p-5 mb-4">
            <h2 className="text-lg font-bold mb-1">{selectedList.name}</h2>
            {selectedList.description && <p className="text-sm text-gray-500">{selectedList.description}</p>}
          </div>

          {/* Add target form */}
          <div className="bg-white rounded-xl border p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={newType} onChange={e => setNewType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="group">Group</option>
                <option value="individual">Individual</option>
              </select>
              <input type="text" value={newJid} onChange={e => setNewJid(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="Group ID or phone number" />
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="Display name" />
              <button onClick={handleAddTarget} disabled={addLoading} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">{addLoading ? '...' : 'Add'}</button>
            </div>
            <div className="mt-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs text-gray-500 hover:bg-gray-50 cursor-pointer">
                <Upload className="w-3 h-3" /> Import CSV
                <input type="file" accept=".csv,.txt" onChange={handleCsvImport} className="hidden" />
              </label>
            </div>
          </div>

          {targetsLoading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" /></div>
          ) : targets.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">No targets yet. Add groups or individual numbers above.</div>
          ) : (
            <div className="space-y-1">
              {targets.map(t => (
                <div key={t.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.display_name || t.jid}</p>
                    <p className="text-xs text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${t.type === 'group' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{t.type === 'group' ? 'Group' : 'Individual'}</span>
                      {' '}{t.jid}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteTarget(t.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(l => (
            <div key={l.id} onClick={() => { setSelectedList(l); loadTargets(l.id); }} className="bg-white rounded-xl border p-4 cursor-pointer hover:border-gray-300 transition-colors">
              <h3 className="font-medium text-sm">{l.name}</h3>
              {l.description && <p className="text-xs text-gray-500 mt-0.5">{l.description}</p>}
              <p className="text-xs text-gray-400 mt-1">{l.target_count ?? '—'} targets</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

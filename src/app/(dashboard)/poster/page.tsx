'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface DispatchItem {
  id: string; scheduled_at: string; status: string; resolved_caption: string | null;
  target: { jid: string; display_name: string | null } | null;
  post: { snapshot: { name?: string; code?: string } } | null;
}

function normalizeDispatches(raw: any[]): DispatchItem[] {
  return raw.map((d: any) => ({
    id: d.id,
    scheduled_at: d.scheduled_at,
    status: d.status,
    resolved_caption: d.resolved_caption,
    target: Array.isArray(d.target) ? d.target[0] ?? null : d.target ?? null,
    post: Array.isArray(d.post) ? d.post[0] ?? null : d.post ?? null,
  }));
}

export default function PosterPage() {
  const { org, user } = useAuth();
  const supabase = createClient();
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    setError(null);
    setLoading(true);

    const loadDispatches = async () => {
      try {
        const { data, error: queryError } = await supabase
          .schema('pm')
          .from('dispatches')
          .select('id, scheduled_at, status, resolved_caption, target:target_id (jid, display_name), post:post_id (snapshot)')
          .eq('organization_id', org.id)
          .in('status', ['pending', 'in_progress', 'delayed'])
          .lte('scheduled_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at');

        if (cancelled) return;
        if (queryError) {
          setError(queryError.message || 'Failed to load dispatches');
          setLoading(false);
          return;
        }
        setDispatches(normalizeDispatches(data || []));
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to connect to the database');
          setLoading(false);
        }
      }
    };

    loadDispatches();
    return () => { cancelled = true; };
  }, [org, supabase]);

  async function markDone(dispatchId: string) {
    setActionError(null);
    const { error: markError } = await supabase
      .schema('pm')
      .from('dispatches')
      .update({ status: 'done', actual_sent_at: new Date().toISOString(), posted_by: user?.id })
      .eq('id', dispatchId);

    if (markError) {
      setActionError('Failed to mark as done: ' + markError.message);
      return;
    }

    setDispatches(prev => prev.filter(d => d.id !== dispatchId));
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Today&apos;s Posting Queue</h1>

      {error && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      ) : dispatches.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 sm:p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No posts scheduled for today.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dispatches.map(d => (
            <div key={d.id} className="bg-white border rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{d.post?.snapshot?.name || 'Untitled'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {d.target?.display_name || d.target?.jid || 'Unknown'} · {new Date(d.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {d.resolved_caption && (
                  <p className="text-xs mt-1 text-gray-600 line-clamp-2">{d.resolved_caption}</p>
                )}
              </div>
              <button
                onClick={() => markDone(d.id)}
                className="shrink-0 w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors active:bg-green-800"
              >
                Mark Done
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

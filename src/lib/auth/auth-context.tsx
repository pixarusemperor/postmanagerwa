'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: 'admin' | 'campaign_manager' | 'product_manager';
}

interface AuthContextType {
  user: User | null;
  org: OrgInfo | null;
  orgs: OrgInfo[];
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  org: null,
  orgs: [],
  loading: true,
  error: null,
  signOut: async () => {},
  switchOrg: async () => {},
});

const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orgRef = useRef<OrgInfo | null>(null);

  // Keep ref in sync with state so loadOrgs always reads latest org
  orgRef.current = org;

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  const loadOrgs = useCallback(async (userId: string) => {
    try {
      const { data: members, error: memError } = await supabase
        .schema('pm')
        .from('organization_members')
        .select('organization_id, role, organizations:organization_id (id, name, slug)')
        .eq('user_id', userId);

      if (memError) {
        setError('Failed to load organizations');
        setLoading(false);
        return;
      }

      if (members) {
        const orgList: OrgInfo[] = members.map((m: any) => ({
          id: m.organizations.id,
          name: m.organizations.name,
          slug: m.organizations.slug,
          role: m.role,
        }));
        setOrgs(orgList);
        if (!orgRef.current && orgList.length > 0) setOrg(orgList[0]);
      }
    } catch {
      setError('Failed to load organizations');
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
      if (cancelled) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser) {
        loadOrgs(sessionUser.id);
      } else {
        setLoading(false);
        // Redirect unauthenticated users to login (skip public pages + callback)
        if (!isPublicPath && pathname !== '/auth/callback') {
          router.push('/login');
        }
      }
    }).catch(() => {
      if (!cancelled) {
        setError('Authentication service unavailable');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (cancelled) return;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser) {
        loadOrgs(sessionUser.id);
      } else {
        setOrg(null);
        setOrgs([]);
        setLoading(false);
        if (!isPublicPath) {
          router.push('/login');
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isPublicPath, pathname, router, loadOrgs, supabase]);

  async function switchOrg(orgId: string) {
    const found = orgs.find(o => o.id === orgId);
    if (found) setOrg(found);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setOrg(null);
    setOrgs([]);
    setError(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, org, orgs, loading, error, signOut, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

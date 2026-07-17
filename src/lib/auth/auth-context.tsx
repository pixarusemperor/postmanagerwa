'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
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
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orgRef = useRef<OrgInfo | null>(null);
  const loadingRef = useRef(true);

  // Keep ref in sync with state so loadOrgs always reads latest org
  orgRef.current = org;

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

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
        loadingRef.current = false;
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
    loadingRef.current = false;
  }, [supabase]);

  // Effect 1: Auth listener — runs once, never resubscribes
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
        loadingRef.current = false;
      }
    }).catch(() => {
      if (!cancelled) {
        setError('Authentication service unavailable');
        setLoading(false);
        loadingRef.current = false;
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
        loadingRef.current = false;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2: Reactive redirect logic — responds to pathname changes
  useEffect(() => {
    if (loadingRef.current) return;
    if (!user && !isPublicPath) {
      router.push('/login');
    } else if (user && isPublicPath) {
      router.push('/products');
    }
  }, [user, isPublicPath, router]);

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

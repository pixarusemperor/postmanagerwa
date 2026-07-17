'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Package, Megaphone, FileText, Target, Users, Settings,
  MessageCircle, Workflow, Inbox, LogOut, ChevronDown,
  LayoutDashboard, Upload, Tag, Brain, Menu, X, Phone,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const navGroups = [
  {
    label: 'Main',
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/templates', label: 'Templates', icon: FileText },
      { href: '/targets', label: 'Targets', icon: Target },
      { href: '/imports', label: 'Imports', icon: Upload },
      { href: '/poster', label: 'Poster Queue', icon: LayoutDashboard },
    ],
  },
  {
    label: 'WhatsApp',
    items: [
      { href: '/wa/instances', label: 'Instances', icon: Users },
      { href: '/wa/sequences', label: 'Sequences', icon: Workflow },
      { href: '/wa/inbox', label: 'Inbox', icon: Inbox },
      { href: '/wa/campaigns', label: 'WA Campaigns', icon: MessageCircle },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/contacts', label: 'Contacts', icon: Phone },
      { href: '/settings/discounts', label: 'Discounts', icon: Tag },
      { href: '/settings/ai', label: 'AI Config', icon: Brain },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function SidebarContent({
  pathname, org, orgs, switchOrg, orgMenuOpen, setOrgMenuOpen, onNavClick,
}: {
  pathname: string;
  org: { id: string; name: string; role: string } | null;
  orgs: { id: string; name: string; role: string }[];
  switchOrg: (id: string) => Promise<void>;
  orgMenuOpen: boolean;
  setOrgMenuOpen: (v: boolean) => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b shrink-0">
        <h1 className="text-lg font-bold">PostManagerwa</h1>
      </div>

      {/* Org Switcher */}
      <div className="p-3 border-b relative shrink-0">
        <button
          onClick={() => setOrgMenuOpen(!orgMenuOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 text-sm"
        >
          <span className="truncate">{org?.name || 'Select Org'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {orgMenuOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border rounded-lg shadow-lg z-50">
            {orgs.map(o => (
              <button
                key={o.id}
                onClick={() => { switchOrg(o.id); setOrgMenuOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${o.id === org?.id ? 'font-medium' : ''}`}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {group.label}
            </p>
            {group.items.map(item => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm mb-0.5 ${
                    active ? 'bg-gray-100 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, org, orgs, signOut, switchOrg, loading, error } = useAuth();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on resize to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <X className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Connection Error</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-black text-white rounded-lg text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent
          pathname={pathname} org={org} orgs={orgs}
          switchOrg={switchOrg}
          orgMenuOpen={orgMenuOpen} setOrgMenuOpen={setOrgMenuOpen}
        />
        {/* Desktop user footer */}
        <div className="p-3 border-t shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 truncate">{user?.email}</span>
            <button onClick={signOut} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Sign out">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out md:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h1 className="text-lg font-bold">PostManagerwa</h1>
          <button onClick={closeSidebar} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent
          pathname={pathname} org={org} orgs={orgs}
          switchOrg={switchOrg}
          orgMenuOpen={orgMenuOpen} setOrgMenuOpen={setOrgMenuOpen}
          onNavClick={closeSidebar}
        />
        <div className="p-3 border-t shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 truncate">{user?.email}</span>
            <button onClick={() => { signOut(); closeSidebar(); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold">PostManagerwa</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 truncate max-w-[120px]">{user?.email}</span>
            <button onClick={signOut} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </header>

        {/* Mobile org selector bar */}
        {org && (
          <div className="md:hidden px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-medium truncate">{org.name}</span>
            {orgs.length > 1 && (
              <select
                value={org.id}
                onChange={e => switchOrg(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              >
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

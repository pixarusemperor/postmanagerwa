'use client';

import { AuthProvider } from '@/lib/auth/auth-context';
import DashboardLayout from '@/components/dashboard/dashboard-layout';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthProvider>
  );
}

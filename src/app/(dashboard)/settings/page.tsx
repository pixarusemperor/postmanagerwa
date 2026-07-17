'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function Page() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md">
        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Settings</h1>
        <p className="text-sm text-gray-500 mb-4">
          Configure your organization&apos;s preferences, billing plan, and team members.
        </p>
        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Coming soon</span>
        <div className="mt-8">
          <Link href="/products" className="text-sm text-black underline">← Back to Products</Link>
        </div>
      </div>
    </div>
  );
}

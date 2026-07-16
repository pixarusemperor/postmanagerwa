'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const router = useRouter();
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push('/products');
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setMagicLinkSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-xl shadow-sm border">
        <h1 className="text-xl sm:text-2xl font-bold mb-6 text-center">PostManagerwa</h1>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('password')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'password' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Password
          </button>
          <button
            onClick={() => setMode('magic')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'magic' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Magic Link
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {magicLinkSent && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Check your email for the magic link.
          </div>
        )}

        <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {mode === 'password' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors active:bg-gray-700"
          >
            {loading ? 'Signing in...' : mode === 'password' ? 'Sign In' : 'Send Magic Link'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-black underline font-medium">Sign up</a>
        </p>
      </div>
    </div>
  );
}

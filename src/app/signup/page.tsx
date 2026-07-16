'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authError || !authData.user) {
      setError(authError?.message || 'Signup failed');
      setLoading(false);
      return;
    }

    // Sign in immediately so RLS has auth.uid() available
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Account created but login failed. Please sign in manually.');
      setLoading(false);
      return;
    }

    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Insert without .select() — RLS INSERT policy allows it, but can't SELECT back
    // because the user isn't a member yet (chicken-and-egg)
    const { error: orgError } = await supabase
      .schema('pm')
      .from('organizations')
      .insert({ name: orgName, slug, plan: 'free' });

    if (orgError) {
      setError('Failed to create organization: ' + (orgError?.message || ''));
      setLoading(false);
      return;
    }

    // Now query to get the org ID — RLS allows SELECT because org exists
    const { data: orgData, error: orgFetchError } = await supabase
      .schema('pm')
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (orgFetchError || !orgData) {
      setError('Organization created but could not be retrieved. Please sign in again.');
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .schema('pm')
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: authData.user.id,
        role: 'admin',
      });

    if (memberError) {
      setError('Organization created but failed to add you as a member. Please contact support.');
      setLoading(false);
      return;
    }

    router.push('/products');
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-xl shadow-sm border">
        <h1 className="text-xl sm:text-2xl font-bold mb-6 text-center">Create Account</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              required
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="My Business"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Min 6 characters"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors active:bg-gray-700"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <a href="/login" className="text-black underline font-medium">Sign in</a>
        </p>
      </div>
    </div>
  );
}

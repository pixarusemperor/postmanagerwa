'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client-browser';
import { useAuth } from '@/lib/auth/auth-context';
import { Plus, Search, AlertCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string; code: string; name: string; selling_price: number | null;
  currency: string; stock_count: number; is_active: boolean;
}

export default function ProductsPage() {
  const { org } = useAuth();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    setError(null);
    setLoading(true);

    const loadProducts = async () => {
      try {
        const { data, error: queryError } = await supabase
          .schema('pm')
          .from('products')
          .select('*')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (queryError) {
          setError(queryError.message || 'Failed to load products');
          setLoading(false);
          return;
        }
        setProducts((data as Product[]) || []);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to connect to the database');
          setLoading(false);
        }
      }
    };

    loadProducts();
    return () => { cancelled = true; };
  }, [org, supabase]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Products</h1>
        <Link
          href="/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stock</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      No products yet. Import or create your first product.
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">{p.code}</td>
                      <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-sm">
                        {p.selling_price ? `${p.selling_price.toLocaleString()} ${p.currency}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{p.stock_count}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
                No products yet. Import or create your first product.
              </div>
            ) : (
              filtered.map(p => (
                <div key={p.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.code} · {p.selling_price ? `${p.selling_price.toLocaleString()} ${p.currency}` : '—'}
                    </p>
                    <p className="text-xs mt-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="ml-2 text-gray-400">Stock: {p.stock_count}</span>
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 ml-2" />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

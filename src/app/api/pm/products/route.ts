import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .schema('pm')
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!member) return NextResponse.json({ error: 'No organization' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;
  const search = searchParams.get('search');

  const admin = getAdmin();
  let query = admin
    .schema('pm')
    .from('products')
    .select('*', { count: 'exact' })
    .eq('organization_id', member.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count, page, limit });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .schema('pm')
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!member) return NextResponse.json({ error: 'No organization' }, { status: 403 });

  const { name, code, selling_price, cost_price, promotional_price, currency, description, stock_count } = await request.json();
  if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 });

  const admin = getAdmin();
  const { data, error } = await admin
    .schema('pm')
    .from('products')
    .insert({
      organization_id: member.organization_id,
      code: code || name.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
      name,
      selling_price: selling_price || null,
      cost_price: cost_price || null,
      promotional_price: promotional_price || null,
      currency: currency || 'XOF',
      description: description || null,
      stock_count: stock_count || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

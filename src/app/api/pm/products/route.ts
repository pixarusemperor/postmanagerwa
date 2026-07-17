import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getMemberOrg(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: member } = await supabase
    .schema('pm')
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
  return member?.organization_id ?? null;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = await getMemberOrg(supabase, user.id);
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';

    let query = supabase
      .schema('pm')
      .from('products')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${escaped}%,code.ilike.%${escaped}%`);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, total: count, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = await getMemberOrg(supabase, user.id);
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, code, selling_price, cost_price, promotional_price, currency, description, stock_count } = body;
    if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 });

    // Validate numeric fields
    const sellingPrice = selling_price != null && selling_price !== '' ? Number(selling_price) : null;
    const costPrice = cost_price != null && cost_price !== '' ? Number(cost_price) : null;
    const promPrice = promotional_price != null && promotional_price !== '' ? Number(promotional_price) : null;
    const stock = stock_count != null && stock_count !== '' ? Math.max(0, Number(stock_count)) : 0;

    if (sellingPrice !== null && (isNaN(sellingPrice) || sellingPrice < 0)) {
      return NextResponse.json({ error: 'Selling price must be a positive number' }, { status: 400 });
    }
    if (costPrice !== null && (isNaN(costPrice) || costPrice < 0)) {
      return NextResponse.json({ error: 'Cost price must be a positive number' }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema('pm')
      .from('products')
      .insert({
        organization_id: orgId,
        code: code || name.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
        name,
        selling_price: sellingPrice,
        cost_price: costPrice,
        promotional_price: promPrice,
        currency: currency || 'XOF',
        description: description || null,
        stock_count: stock,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

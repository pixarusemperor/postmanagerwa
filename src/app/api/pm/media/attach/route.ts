import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { storagePath, orgId, productId, fileType, fileSize } = body;

    if (!storagePath || !orgId || !productId) {
      return NextResponse.json({ error: 'storagePath, orgId, and productId required' }, { status: 400 });
    }

    // Verify user is member of the org
    const { data: member } = await supabase.schema('pm').from('organization_members')
      .select('id').eq('organization_id', orgId).eq('user_id', user.id).single();
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Use the Supabase Management API directly with the service_role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/media`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'pm',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        organization_id: orgId,
        storage_path: storagePath,
        bucket_name: 'postmanagerwa-media',
        mime_type: fileType || 'image/jpeg',
        file_size: fileSize || 0,
        product_id: productId,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('Media insert via REST failed:', errBody);
      return NextResponse.json({ error: 'Failed to attach media' }, { status: 500 });
    }

    const media = await res.json();
    return NextResponse.json({ id: (media as any)?.[0]?.id || media?.id, storagePath }, { status: 201 });
  } catch (e) {
    console.error('Media attach error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

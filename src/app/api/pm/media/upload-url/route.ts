import { NextResponse } from 'next/server';
import { getUploadPresignedUrl, buildStoragePath } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { filename, contentType, entityType, entityId } = body;
    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 });
    }

    const storagePath = buildStoragePath(
      member.organization_id,
      entityType || 'products',
      entityId || 'temp',
      `${Date.now()}_${filename}`
    );

    try {
      const presignedUrl = await getUploadPresignedUrl(storagePath, contentType);
      return NextResponse.json({ presignedUrl, storagePath });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

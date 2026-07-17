import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const rawNext = searchParams.get('next') ?? '/products';

    // Prevent open redirect: only allow relative local paths
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/products';

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  } catch {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/login?error=auth_service_unavailable`);
  }
}

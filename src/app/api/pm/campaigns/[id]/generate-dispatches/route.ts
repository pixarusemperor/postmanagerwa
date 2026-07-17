import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify campaign ownership
    const { data: campaign, error: campErr } = await supabase
      .schema('pm').from('campaigns').select('*, target_lists:campaign_target_lists(target_list_id)')
      .eq('id', campaignId).single();

    if (campErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const memberCheck = await supabase.schema('pm').from('organization_members')
      .select('id').eq('organization_id', campaign.organization_id).eq('user_id', user.id).single();
    if (!memberCheck.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Get target_list_id from join
    const targetListJoin = campaign.target_lists as any;
    const targetListId = Array.isArray(targetListJoin) ? targetListJoin[0]?.target_list_id : targetListJoin?.target_list_id;
    if (!targetListId) return NextResponse.json({ error: 'Campaign has no target list' }, { status: 400 });

    // Get all targets in the list
    const { data: targets } = await supabase.schema('pm').from('targets')
      .select('id').eq('target_list_id', targetListId);

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: 'Target list is empty. Add targets first.' }, { status: 400 });
    }

    // Get all posts for this campaign
    const { data: posts } = await supabase.schema('pm').from('posts')
      .select('*').eq('campaign_id', campaignId).order('position');

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'Campaign has no posts. Add products first.' }, { status: 400 });
    }

    // Calculate scheduling: start from campaign's scheduled_start_at or now
    const startTime = campaign.scheduled_start_at
      ? new Date(campaign.scheduled_start_at).getTime()
      : Date.now() + 60000; // 1 minute from now if no start date

    const INTERVAL_MS = 300_000; // 5 minutes between posts
    let dispatchCount = 0;

    // Generate dispatches: Post × Target
    for (let pi = 0; pi < posts.length; pi++) {
      const post = posts[pi];
      for (const target of targets) {
        const scheduledAt = new Date(startTime + (pi * targets.length + dispatchCount % targets.length) * INTERVAL_MS).toISOString();

        const { error: dispErr } = await supabase.schema('pm').from('dispatches').insert({
          organization_id: campaign.organization_id,
          campaign_id: campaignId,
          post_id: post.id,
          target_id: target.id,
          wave_number: 1,
          scheduled_at: scheduledAt,
          resolved_caption: post.caption_override,
          status: 'pending',
        });

        if (!dispErr) dispatchCount++;
      }
    }

    // Update campaign status
    await supabase.schema('pm').from('campaigns')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    // Log action
    try { await supabase.schema('pm').from('action_logs').insert({ organization_id: campaign.organization_id, actor_id: user.id, action_code: 'campaign_dispatches_generated', entity_type: 'campaign', entity_id: campaignId, metadata: { dispatch_count: dispatchCount, target_count: targets.length, post_count: posts.length } }); } catch {}

    return NextResponse.json({
      success: true,
      dispatch_count: dispatchCount,
      target_count: targets.length,
      post_count: posts.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : 'Internal error') }, { status: 500 });
  }
}

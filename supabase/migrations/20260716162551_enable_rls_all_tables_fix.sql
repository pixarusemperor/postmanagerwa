-- ============================================================
-- FIX: Enable RLS on EVERY pm.* and wa.* table (CRITICAL)
-- + fix action_logs WITH CHECK
-- + fix organization_members INSERT policy for first member
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE pm.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.product_category_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.parsing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.raw_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.extracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.anti_detection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.media_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.media_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.target_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.campaign_target_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.dispatches_2026_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.dispatches_2026_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.wa_posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.contact_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.caption_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.prefilled_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.discount_rule_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.action_logs_2026_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.action_logs_2026_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.human_poster_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm.human_poster_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE wa.wa_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_send_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_send_queue_2026_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_send_queue_2026_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_group_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa.wa_group_list_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIX: action_logs policy — add WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation ON pm.action_logs;
CREATE POLICY tenant_isolation ON pm.action_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.action_logs.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = organization_id
            AND user_id = auth.uid()
        )
    );

-- ============================================================
-- FIX: organization_members INSERT for first member
-- (The signup flow: user creates org, then adds themselves as admin)
-- ============================================================
DROP POLICY IF EXISTS org_admin_manage ON pm.organization_members;
CREATE POLICY org_admin_manage ON pm.organization_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            EXISTS (
                SELECT 1 FROM pm.organization_members adm
                WHERE adm.organization_id = organization_id
                AND adm.user_id = auth.uid()
                AND adm.role = 'admin'
            )
            OR
            NOT EXISTS (
                SELECT 1 FROM pm.organization_members existing
                WHERE existing.organization_id = organization_id
            )
        )
    );

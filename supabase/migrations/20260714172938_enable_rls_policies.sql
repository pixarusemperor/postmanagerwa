-- ============================================================
-- RLS POLICY FIXES
-- ============================================================

-- FIX A: Add INSERT policy on organizations so signup works
DROP POLICY IF EXISTS org_insert ON pm.organizations;
CREATE POLICY org_insert ON pm.organizations
    FOR INSERT WITH CHECK (true);

-- FIX B: Add UPDATE/DELETE policy on organizations for admins
DROP POLICY IF EXISTS org_admin_manage_org ON pm.organizations;
CREATE POLICY org_admin_manage_org ON pm.organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.organizations.id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- FIX C: Replace pm.current_org_id() approach with subquery-based tenant isolation.
-- The current_org_id() function relied on an org_id JWT claim that doesn't exist.
-- Instead, verify the user is a member of the org that owns the row.

-- Drop the broken function
DROP FUNCTION IF EXISTS pm.current_org_id();

-- Recreate all tenant isolation policies using the subquery pattern
-- PM tables with organization_id:

DROP POLICY IF EXISTS tenant_isolation ON pm.products;
CREATE POLICY tenant_isolation ON pm.products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.products.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.products.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.product_categories;
CREATE POLICY tenant_isolation ON pm.product_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.product_categories.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.product_categories.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.suppliers;
CREATE POLICY tenant_isolation ON pm.suppliers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.suppliers.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.suppliers.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.raw_imports;
CREATE POLICY tenant_isolation ON pm.raw_imports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.raw_imports.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.raw_imports.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.campaigns;
CREATE POLICY tenant_isolation ON pm.campaigns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.campaigns.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.campaigns.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.media;
CREATE POLICY tenant_isolation ON pm.media
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.media.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.media.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.target_lists;
CREATE POLICY tenant_isolation ON pm.target_lists
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.target_lists.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.target_lists.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.dispatches;
CREATE POLICY tenant_isolation ON pm.dispatches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.dispatches.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.dispatches.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.wa_posters;
CREATE POLICY tenant_isolation ON pm.wa_posters
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.wa_posters.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.wa_posters.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.contact_numbers;
CREATE POLICY tenant_isolation ON pm.contact_numbers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.contact_numbers.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.contact_numbers.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.caption_templates;
CREATE POLICY tenant_isolation ON pm.caption_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.caption_templates.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.caption_templates.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.prefilled_message_templates;
CREATE POLICY tenant_isolation ON pm.prefilled_message_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.prefilled_message_templates.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.prefilled_message_templates.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.discount_rules;
CREATE POLICY tenant_isolation ON pm.discount_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.discount_rules.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.discount_rules.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.ai_configs;
CREATE POLICY tenant_isolation ON pm.ai_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.ai_configs.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.ai_configs.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.ai_usage_logs;
CREATE POLICY tenant_isolation ON pm.ai_usage_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.ai_usage_logs.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.ai_usage_logs.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON pm.action_logs;
CREATE POLICY tenant_isolation ON pm.action_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.action_logs.organization_id
            AND user_id = auth.uid()
        )
    );

-- WA tables with organization_id:

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_instances;
CREATE POLICY tenant_isolation ON wa.wa_instances
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_instances.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_instances.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_sequences;
CREATE POLICY tenant_isolation ON wa.wa_sequences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_sequences.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_sequences.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_triggers;
CREATE POLICY tenant_isolation ON wa.wa_triggers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_triggers.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_triggers.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_messages;
CREATE POLICY tenant_isolation ON wa.wa_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_messages.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_messages.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_campaigns;
CREATE POLICY tenant_isolation ON wa.wa_campaigns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_campaigns.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_campaigns.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_send_queue;
CREATE POLICY tenant_isolation ON wa.wa_send_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_send_queue.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_send_queue.organization_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tenant_isolation ON wa.wa_group_lists;
CREATE POLICY tenant_isolation ON wa.wa_group_lists
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_group_lists.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_group_lists.organization_id
            AND user_id = auth.uid()
        )
    );

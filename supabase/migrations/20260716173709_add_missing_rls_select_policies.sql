-- ============================================================
-- FIX: Missing RLS policies — these are the root cause of
-- "Organization created but could not be retrieved" error
-- and blank/non-loading dashboard after login.
--
-- CRITICAL GAPS FOUND:
-- 1. pm.organizations: INSERT + UPDATE but NO SELECT
--    → Signup flow's .select().eq('slug',slug).single() fails
--    → Error: "Organization created but could not be retrieved"
-- 2. pm.organization_members: INSERT only, NO SELECT/UPDATE/DELETE
--    → loadOrgs() in auth-context returns 403/empty
--    → Dashboard stays on infinite loading spinner or shows no org
-- 3. 20+ joining tables without org_id need parent-based isolation
-- ============================================================

-- ============================================================
-- FIX 1: organizations — need SELECT so users can read their org
-- ============================================================
DROP POLICY IF EXISTS org_member_read ON pm.organizations;
CREATE POLICY org_member_read ON pm.organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.organizations.id
            AND user_id = auth.uid()
        )
    );

-- ============================================================
-- FIX 2: organizations — need UPDATE WITH CHECK (fix existing)
-- The existing org_admin_manage_org has USING but not WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS org_admin_manage_org ON pm.organizations;
CREATE POLICY org_admin_manage_org ON pm.organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.organizations.id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.organizations.id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- ============================================================
-- FIX 3: organizations — allow the creator (first signup) to SELECT
-- before they're added as a member. The signup flow:
--   INSERT org → SELECT org by slug → INSERT member
-- Without this, step 2 fails because user isn't a member yet.
-- We add a fallback: allow SELECT when no members exist (just-created org).
-- ============================================================
DROP POLICY IF EXISTS org_creator_read ON pm.organizations;
CREATE POLICY org_creator_read ON pm.organizations
    FOR SELECT USING (
        NOT EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = pm.organizations.id
        )
    );

-- ============================================================
-- FIX 4: organization_members — need SELECT for loadOrgs()
-- This is what the auth-context's loadOrgs queries:
--   supabase.schema('pm').from('organization_members')
--     .select('organization_id, role, organizations:...')
--     .eq('user_id', userId)
-- ============================================================
DROP POLICY IF EXISTS org_member_read_own ON pm.organization_members;
CREATE POLICY org_member_read_own ON pm.organization_members
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- ============================================================
-- FIX 5: organization_members — need UPDATE WITH CHECK for admin
-- ============================================================
DROP POLICY IF EXISTS org_member_update ON pm.organization_members;
CREATE POLICY org_member_update ON pm.organization_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members adm
            WHERE adm.organization_id = organization_id
            AND adm.user_id = auth.uid()
            AND adm.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members adm
            WHERE adm.organization_id = organization_id
            AND adm.user_id = auth.uid()
            AND adm.role = 'admin'
        )
    );

-- ============================================================
-- FIX 6: organization_members — need DELETE for admin
-- ============================================================
DROP POLICY IF EXISTS org_member_delete ON pm.organization_members;
CREATE POLICY org_member_delete ON pm.organization_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members adm
            WHERE adm.organization_id = organization_id
            AND adm.user_id = auth.uid()
            AND adm.role = 'admin'
        )
    );

-- ============================================================
-- FIX 7: Tables without organization_id — need parent-based isolation
-- These joining tables reference a parent that has organization_id.
-- We create policies that check membership through the parent.
-- ============================================================

-- product_variants → products → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.product_variants;
CREATE POLICY tenant_isolation ON pm.product_variants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.products p
            JOIN pm.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = pm.product_variants.product_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.products p
            JOIN pm.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_id
            AND om.user_id = auth.uid()
        )
    );

-- product_category_members → products → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.product_category_members;
CREATE POLICY tenant_isolation ON pm.product_category_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.products p
            JOIN pm.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = pm.product_category_members.product_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.products p
            JOIN pm.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_id
            AND om.user_id = auth.uid()
        )
    );

-- product_suppliers → products → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.product_suppliers;
CREATE POLICY tenant_isolation ON pm.product_suppliers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.products p
            JOIN pm.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = pm.product_suppliers.product_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.products p
            JOIN pm.organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = product_id
            AND om.user_id = auth.uid()
        )
    );

-- parsing_rules → suppliers → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.parsing_rules;
CREATE POLICY tenant_isolation ON pm.parsing_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.suppliers s
            JOIN pm.organization_members om ON om.organization_id = s.organization_id
            WHERE s.id = pm.parsing_rules.supplier_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.suppliers s
            JOIN pm.organization_members om ON om.organization_id = s.organization_id
            WHERE s.id = supplier_id
            AND om.user_id = auth.uid()
        )
    );

-- extracts → raw_imports → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.extracts;
CREATE POLICY tenant_isolation ON pm.extracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.raw_imports ri
            JOIN pm.organization_members om ON om.organization_id = ri.organization_id
            WHERE ri.id = pm.extracts.raw_import_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.raw_imports ri
            JOIN pm.organization_members om ON om.organization_id = ri.organization_id
            WHERE ri.id = raw_import_id
            AND om.user_id = auth.uid()
        )
    );

-- candidates → extracts → raw_imports → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.candidates;
CREATE POLICY tenant_isolation ON pm.candidates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.extracts e
            JOIN pm.raw_imports ri ON ri.id = e.raw_import_id
            JOIN pm.organization_members om ON om.organization_id = ri.organization_id
            WHERE e.id = pm.candidates.extract_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.extracts e
            JOIN pm.raw_imports ri ON ri.id = e.raw_import_id
            JOIN pm.organization_members om ON om.organization_id = ri.organization_id
            WHERE e.id = extract_id
            AND om.user_id = auth.uid()
        )
    );

-- anti_detection_configs → campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.anti_detection_configs;
CREATE POLICY tenant_isolation ON pm.anti_detection_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = pm.anti_detection_configs.campaign_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = campaign_id
            AND om.user_id = auth.uid()
        )
    );

-- posts → campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.posts;
CREATE POLICY tenant_isolation ON pm.posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = pm.posts.campaign_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = campaign_id
            AND om.user_id = auth.uid()
        )
    );

-- media_groups → posts → campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.media_groups;
CREATE POLICY tenant_isolation ON pm.media_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.posts p
            JOIN pm.campaigns c ON c.id = p.campaign_id
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE p.id = pm.media_groups.post_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.posts p
            JOIN pm.campaigns c ON c.id = p.campaign_id
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE p.id = post_id
            AND om.user_id = auth.uid()
        )
    );

-- media_group_items → media_groups → posts → campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.media_group_items;
CREATE POLICY tenant_isolation ON pm.media_group_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.media_groups mg
            JOIN pm.posts p ON p.id = mg.post_id
            JOIN pm.campaigns c ON c.id = p.campaign_id
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE mg.id = pm.media_group_items.media_group_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.media_groups mg
            JOIN pm.posts p ON p.id = mg.post_id
            JOIN pm.campaigns c ON c.id = p.campaign_id
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE mg.id = media_group_id
            AND om.user_id = auth.uid()
        )
    );

-- targets → target_lists → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.targets;
CREATE POLICY tenant_isolation ON pm.targets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.target_lists tl
            JOIN pm.organization_members om ON om.organization_id = tl.organization_id
            WHERE tl.id = pm.targets.target_list_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.target_lists tl
            JOIN pm.organization_members om ON om.organization_id = tl.organization_id
            WHERE tl.id = target_list_id
            AND om.user_id = auth.uid()
        )
    );

-- campaign_target_lists → campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.campaign_target_lists;
CREATE POLICY tenant_isolation ON pm.campaign_target_lists
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = pm.campaign_target_lists.campaign_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = campaign_id
            AND om.user_id = auth.uid()
        )
    );

-- discount_rule_products → discount_rules → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.discount_rule_products;
CREATE POLICY tenant_isolation ON pm.discount_rule_products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.discount_rules dr
            JOIN pm.organization_members om ON om.organization_id = dr.organization_id
            WHERE dr.id = pm.discount_rule_products.discount_rule_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.discount_rules dr
            JOIN pm.organization_members om ON om.organization_id = dr.organization_id
            WHERE dr.id = discount_rule_id
            AND om.user_id = auth.uid()
        )
    );

-- notifications → user owns their own notifications
DROP POLICY IF EXISTS own_notifications ON pm.notifications;
CREATE POLICY own_notifications ON pm.notifications
    FOR ALL USING (
        auth.uid() = user_id
    )
    WITH CHECK (
        auth.uid() = user_id
    );

-- human_poster_working_hours → user owns their own hours
DROP POLICY IF EXISTS own_working_hours ON pm.human_poster_working_hours;
CREATE POLICY own_working_hours ON pm.human_poster_working_hours
    FOR ALL USING (
        auth.uid() = user_id
    )
    WITH CHECK (
        auth.uid() = user_id
    );

-- human_poster_assignments → campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON pm.human_poster_assignments;
CREATE POLICY tenant_isolation ON pm.human_poster_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = pm.human_poster_assignments.campaign_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.campaigns c
            JOIN pm.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = campaign_id
            AND om.user_id = auth.uid()
        )
    );

-- ============================================================
-- FIX 8: WA joining tables without organization_id
-- ============================================================

-- wa_sequence_steps → wa_sequences → organization_members
DROP POLICY IF EXISTS tenant_isolation ON wa.wa_sequence_steps;
CREATE POLICY tenant_isolation ON wa.wa_sequence_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM wa.wa_sequences ws
            JOIN pm.organization_members om ON om.organization_id = ws.organization_id
            WHERE ws.id = wa.wa_sequence_steps.sequence_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM wa.wa_sequences ws
            JOIN pm.organization_members om ON om.organization_id = ws.organization_id
            WHERE ws.id = sequence_id
            AND om.user_id = auth.uid()
        )
    );

-- wa_send_jobs → has organization_id directly
DROP POLICY IF EXISTS tenant_isolation ON wa.wa_send_jobs;
CREATE POLICY tenant_isolation ON wa.wa_send_jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_send_jobs.organization_id
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pm.organization_members
            WHERE organization_id = wa.wa_send_jobs.organization_id
            AND user_id = auth.uid()
        )
    );

-- wa_campaign_events → wa_campaigns → organization_members
DROP POLICY IF EXISTS tenant_isolation ON wa.wa_campaign_events;
CREATE POLICY tenant_isolation ON wa.wa_campaign_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM wa.wa_campaigns wc
            JOIN pm.organization_members om ON om.organization_id = wc.organization_id
            WHERE wc.id = wa.wa_campaign_events.campaign_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM wa.wa_campaigns wc
            JOIN pm.organization_members om ON om.organization_id = wc.organization_id
            WHERE wc.id = campaign_id
            AND om.user_id = auth.uid()
        )
    );

-- wa_group_list_items → wa_group_lists → organization_members
DROP POLICY IF EXISTS tenant_isolation ON wa.wa_group_list_items;
CREATE POLICY tenant_isolation ON wa.wa_group_list_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM wa.wa_group_lists wgl
            JOIN pm.organization_members om ON om.organization_id = wgl.organization_id
            WHERE wgl.id = wa.wa_group_list_items.group_list_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM wa.wa_group_lists wgl
            JOIN pm.organization_members om ON om.organization_id = wgl.organization_id
            WHERE wgl.id = group_list_id
            AND om.user_id = auth.uid()
        )
    );

-- ============================================================
-- FIX: Signup deadlock — first user can't insert themselves as member
-- ============================================================

-- Problem: org_admin_manage policy checked that the inserting user
-- is already an admin. On first signup, no members exist yet.

-- Fix: Allow INSERT into organization_members when:
-- 1. The user already has the admin role (existing member) OR
-- 2. The user just created the org and no members exist yet (first signup)

DROP POLICY IF EXISTS org_admin_manage ON pm.organization_members;
CREATE POLICY org_admin_manage ON pm.organization_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Existing admin adding another member
            EXISTS (
                SELECT 1 FROM pm.organization_members adm
                WHERE adm.organization_id = organization_id
                AND adm.user_id = auth.uid()
                AND adm.role = 'admin'
            )
            OR
            -- First member (org just created, no members exist)
            NOT EXISTS (
                SELECT 1 FROM pm.organization_members existing
                WHERE existing.organization_id = organization_id
            )
        )
    );

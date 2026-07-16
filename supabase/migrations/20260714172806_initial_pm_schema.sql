-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_partman;

-- ============================================================
-- SCHEMA: pm (PostManager)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS pm;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE pm.user_role AS ENUM ('admin', 'campaign_manager', 'product_manager');
CREATE TYPE pm.import_source_type AS ENUM ('csv', 'whatsapp_zip', 'shopify', 'website', 'manual');
CREATE TYPE pm.import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE pm.extract_status AS ENUM ('pending', 'filtered', 'promoted');
CREATE TYPE pm.candidate_status AS ENUM ('pending_approval', 'approved', 'rejected');
CREATE TYPE pm.campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');
CREATE TYPE pm.post_mode AS ENUM ('manual', 'automated', 'export');
CREATE TYPE pm.post_type AS ENUM ('text_only', 'media_text', 'grouped_media_text_before', 'grouped_media_text_after', 'audio', 'document');
CREATE TYPE pm.dispatch_status AS ENUM ('pending', 'in_progress', 'done', 'sent', 'failed', 'delayed', 'missed');
CREATE TYPE pm.wa_poster_provider_type AS ENUM ('watsender', 'twilio', 'unofficial_api');
CREATE TYPE pm.wa_poster_status AS ENUM ('active', 'disconnected', 'error');
CREATE TYPE pm.target_type AS ENUM ('group', 'individual');
CREATE TYPE pm.media_item_type AS ENUM ('image', 'video');
CREATE TYPE pm.discount_rule_type AS ENUM ('product', 'category', 'keyword', 'date_range', 'time_frame', 'import_batch');
CREATE TYPE pm.discount_type AS ENUM ('fixed', 'percentage');
CREATE TYPE pm.variant_cycle_strategy AS ENUM ('sequential', 'random');
CREATE TYPE pm.ai_feature_name AS ENUM ('post_suggestion', 'message_rewrite', 'import_parsing');
CREATE TYPE pm.ai_provider AS ENUM ('vertex_ai', 'saas_key', 'byok');
CREATE TYPE pm.notification_channel AS ENUM ('in_app', 'push', 'email');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE pm.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    plan text NOT NULL DEFAULT 'free',
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ORGANIZATION MEMBERS (links auth.users to an org)
-- ============================================================
CREATE TABLE pm.organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role pm.user_role NOT NULL DEFAULT 'campaign_manager',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE pm.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    code text NOT NULL,
    name text NOT NULL,
    selling_price numeric(12,2),
    cost_price numeric(12,2),
    promotional_price numeric(12,2),
    currency text DEFAULT 'XOF',
    discounted_price numeric(12,2),
    stock_count int DEFAULT 0,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);

CREATE INDEX idx_products_org ON pm.products(organization_id);
CREATE INDEX idx_products_code ON pm.products(organization_id, code);
CREATE INDEX idx_products_active ON pm.products(organization_id, is_active) WHERE is_active = true;

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================
CREATE TABLE pm.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES pm.products(id) ON DELETE CASCADE,
    caption text,
    display_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_variants_product ON pm.product_variants(product_id);

-- ============================================================
-- PRODUCT CATEGORIES (ltree hierarchy)
-- ============================================================
CREATE TABLE pm.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    path ltree NOT NULL,
    parent_id uuid REFERENCES pm.product_categories(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_path ON pm.product_categories USING gist(path);
CREATE INDEX idx_categories_org ON pm.product_categories(organization_id);

-- ============================================================
-- PRODUCT ↔ CATEGORY (many-to-many)
-- ============================================================
CREATE TABLE pm.product_category_members (
    product_id uuid NOT NULL REFERENCES pm.products(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES pm.product_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE pm.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_info jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_org ON pm.suppliers(organization_id);

-- ============================================================
-- PRODUCT ↔ SUPPLIER (many-to-many)
-- ============================================================
CREATE TABLE pm.product_suppliers (
    product_id uuid NOT NULL REFERENCES pm.products(id) ON DELETE CASCADE,
    supplier_id uuid NOT NULL REFERENCES pm.suppliers(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, supplier_id)
);

-- ============================================================
-- PARSING RULES (per supplier, for extract processing)
-- ============================================================
CREATE TABLE pm.parsing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES pm.suppliers(id) ON DELETE CASCADE,
    field_name text NOT NULL,
    rule_pattern text NOT NULL,
    priority int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parsing_rules_supplier ON pm.parsing_rules(supplier_id, priority);

-- ============================================================
-- RAW IMPORTS
-- ============================================================
CREATE TABLE pm.raw_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    source_type pm.import_source_type NOT NULL,
    file_url text,
    batch_id uuid,
    status pm.import_status NOT NULL DEFAULT 'pending',
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_raw_imports_org ON pm.raw_imports(organization_id);
CREATE INDEX idx_raw_imports_batch ON pm.raw_imports(batch_id);

-- ============================================================
-- EXTRACTS (raw items from imports)
-- ============================================================
CREATE TABLE pm.extracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_import_id uuid NOT NULL REFERENCES pm.raw_imports(id) ON DELETE CASCADE,
    message_text text,
    sender_number text,
    timestamp timestamptz,
    status pm.extract_status NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_extracts_import ON pm.extracts(raw_import_id);
CREATE INDEX idx_extracts_status ON pm.extracts(raw_import_id, status);

-- ============================================================
-- CANDIDATES (filtered extracts ready for review)
-- ============================================================
CREATE TABLE pm.candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    extract_id uuid REFERENCES pm.extracts(id) ON DELETE SET NULL,
    product_id uuid REFERENCES pm.products(id) ON DELETE SET NULL,
    suggested_name text,
    suggested_price numeric(12,2),
    suggested_fields jsonb DEFAULT '{}'::jsonb,
    status pm.candidate_status NOT NULL DEFAULT 'pending_approval',
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    review_reason text,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_status ON pm.candidates(status);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE pm.campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status pm.campaign_status NOT NULL DEFAULT 'draft',
    post_mode pm.post_mode NOT NULL DEFAULT 'manual',
    scheduled_start_at timestamptz,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_org ON pm.campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON pm.campaigns(organization_id, status);

-- ============================================================
-- ANTI-DETECTION CONFIGS (per campaign)
-- ============================================================
CREATE TABLE pm.anti_detection_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES pm.campaigns(id) ON DELETE CASCADE UNIQUE,
    max_posts_per_hour int DEFAULT 10,
    min_delay_seconds int DEFAULT 60,
    max_delay_seconds int DEFAULT 300,
    randomization_jitter_seconds int DEFAULT 30,
    wa_poster_rotation_count int DEFAULT 1,
    product_target_cooldown_hours int DEFAULT 24,
    variant_cycle_strategy pm.variant_cycle_strategy DEFAULT 'sequential',
    randomize_target_order_per_wave boolean DEFAULT false,
    ai_rewrite_per_recipient boolean DEFAULT false,
    forward_grouping boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- POSTS (frozen product snapshots in campaign order)
-- ============================================================
CREATE TABLE pm.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES pm.campaigns(id) ON DELETE CASCADE,
    position int NOT NULL DEFAULT 0,
    type pm.post_type NOT NULL DEFAULT 'media_text',
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    caption_override text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_campaign ON pm.posts(campaign_id, position);
CREATE INDEX idx_posts_snapshot_gin ON pm.posts USING gin(snapshot);

-- ============================================================
-- MEDIA (polymorphic — belongs to product, variant, or extract)
-- ============================================================
CREATE TABLE pm.media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    bucket_name text NOT NULL DEFAULT 'postmanagerwa-media',
    mime_type text,
    file_size int,
    product_id uuid REFERENCES pm.products(id) ON DELETE CASCADE,
    variant_id uuid REFERENCES pm.product_variants(id) ON DELETE CASCADE,
    extract_id uuid REFERENCES pm.extracts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_org ON pm.media(organization_id);
CREATE INDEX idx_media_product ON pm.media(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_media_extract ON pm.media(extract_id) WHERE extract_id IS NOT NULL;

-- ============================================================
-- MEDIA GROUPS (ordered media within a post)
-- ============================================================
CREATE TABLE pm.media_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid REFERENCES pm.posts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_groups_post ON pm.media_groups(post_id);

-- ============================================================
-- MEDIA GROUP ITEMS
-- ============================================================
CREATE TABLE pm.media_group_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_group_id uuid NOT NULL REFERENCES pm.media_groups(id) ON DELETE CASCADE,
    media_id uuid NOT NULL REFERENCES pm.media(id) ON DELETE CASCADE,
    position int NOT NULL DEFAULT 0,
    type pm.media_item_type NOT NULL DEFAULT 'image'
);

CREATE INDEX idx_mg_items_group ON pm.media_group_items(media_group_id, position);

-- ============================================================
-- TARGET LISTS
-- ============================================================
CREATE TABLE pm.target_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_target_lists_org ON pm.target_lists(organization_id);

-- ============================================================
-- TARGETS (individual entries in target lists)
-- ============================================================
CREATE TABLE pm.targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_list_id uuid NOT NULL REFERENCES pm.target_lists(id) ON DELETE CASCADE,
    type pm.target_type NOT NULL,
    jid text NOT NULL,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_targets_list ON pm.targets(target_list_id);

-- ============================================================
-- CAMPAIGN ↔ TARGET LISTS (many-to-many)
-- ============================================================
CREATE TABLE pm.campaign_target_lists (
    campaign_id uuid NOT NULL REFERENCES pm.campaigns(id) ON DELETE CASCADE,
    target_list_id uuid NOT NULL REFERENCES pm.target_lists(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, target_list_id)
);

-- ============================================================
-- DISPATCHES (P×T rows, partitioned by month on scheduled_at)
-- Post × Target — one row per dispatch event
-- ============================================================
CREATE TABLE pm.dispatches (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    campaign_id uuid NOT NULL REFERENCES pm.campaigns(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES pm.posts(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES pm.targets(id) ON DELETE CASCADE,
    wave_number int NOT NULL DEFAULT 1,
    scheduled_at timestamptz NOT NULL,
    wa_poster_id uuid,
    resolved_variant_id uuid REFERENCES pm.product_variants(id) ON DELETE SET NULL,
    resolved_caption text,
    status pm.dispatch_status NOT NULL DEFAULT 'pending',
    actual_sent_at timestamptz,
    error_message text,
    posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, scheduled_at)
) PARTITION BY RANGE (scheduled_at);

-- Initial partitions (create monthly via pg_partman in production)
CREATE TABLE pm.dispatches_2026_07 PARTITION OF pm.dispatches
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE pm.dispatches_2026_08 PARTITION OF pm.dispatches
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_dispatches_poster ON pm.dispatches(wa_poster_id, status, scheduled_at);
CREATE INDEX idx_dispatches_org_status ON pm.dispatches(organization_id, status);
CREATE INDEX idx_dispatches_campaign ON pm.dispatches(campaign_id, status);

-- ============================================================
-- WA POSTERS (WhatsApp API connection configs)
-- ============================================================
CREATE TABLE pm.wa_posters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    provider_type pm.wa_poster_provider_type NOT NULL DEFAULT 'watsender',
    api_key text,
    base_url text,
    session_id text,
    status pm.wa_poster_status NOT NULL DEFAULT 'disconnected',
    qr_code_data text,
    last_activity_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_posters_org ON pm.wa_posters(organization_id);
CREATE INDEX idx_wa_posters_status ON pm.wa_posters(organization_id, status);

-- ============================================================
-- CONTACT NUMBERS (for wa.me prefilled links)
-- ============================================================
CREATE TABLE pm.contact_numbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    country_code text NOT NULL,
    label text,
    is_also_wa_poster boolean DEFAULT false,
    wa_poster_id uuid REFERENCES pm.wa_posters(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_numbers_org ON pm.contact_numbers(organization_id);

-- ============================================================
-- CAPTION TEMPLATES
-- ============================================================
CREATE TABLE pm.caption_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_caption_templates_org ON pm.caption_templates(organization_id);

-- ============================================================
-- PREFILLED MESSAGE TEMPLATES (for wa.me links)
-- ============================================================
CREATE TABLE pm.prefilled_message_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prefilled_templates_org ON pm.prefilled_message_templates(organization_id);

-- ============================================================
-- DISCOUNT RULES
-- ============================================================
CREATE TABLE pm.discount_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    type pm.discount_rule_type NOT NULL,
    discount_type pm.discount_type NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    priority int DEFAULT 0,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discount_rules_org ON pm.discount_rules(organization_id);

-- ============================================================
-- DISCOUNT RULE ↔ PRODUCT (for product-specific rules)
-- ============================================================
CREATE TABLE pm.discount_rule_products (
    discount_rule_id uuid NOT NULL REFERENCES pm.discount_rules(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES pm.products(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_rule_id, product_id)
);

-- ============================================================
-- AI CONFIGURATION (per org, per feature)
-- ============================================================
CREATE TABLE pm.ai_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    feature_name pm.ai_feature_name NOT NULL,
    enabled boolean DEFAULT false,
    provider pm.ai_provider DEFAULT 'saas_key',
    api_key text,
    model_name text,
    token_limit int DEFAULT 10000,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, feature_name)
);

-- ============================================================
-- AI USAGE LOGS (cost tracking)
-- ============================================================
CREATE TABLE pm.ai_usage_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    feature_name pm.ai_feature_name NOT NULL,
    model_used text,
    tokens_consumed int,
    estimated_cost numeric(10,6),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_org ON pm.ai_usage_logs(organization_id, created_at);

-- ============================================================
-- ACTION LOGS (immutable, partitioned by month)
-- ============================================================
CREATE TABLE pm.action_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_code text NOT NULL,
    entity_type text,
    entity_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    reason text,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE pm.action_logs_2026_07 PARTITION OF pm.action_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE pm.action_logs_2026_08 PARTITION OF pm.action_logs
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_action_logs_org ON pm.action_logs(organization_id, created_at);
CREATE INDEX idx_action_logs_entity ON pm.action_logs(entity_type, entity_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE pm.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel pm.notification_channel NOT NULL DEFAULT 'in_app',
    title_code text NOT NULL,
    body_code text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON pm.notifications(user_id, read_at);
CREATE INDEX idx_notifications_unread ON pm.notifications(user_id) WHERE read_at IS NULL;

-- ============================================================
-- HUMAN POSTER WORKING HOURS
-- ============================================================
CREATE TABLE pm.human_poster_working_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    UNIQUE (user_id, day_of_week)
);

-- ============================================================
-- HUMAN POSTER ASSIGNMENTS (which poster for which campaign)
-- ============================================================
CREATE TABLE pm.human_poster_assignments (
    campaign_id uuid NOT NULL REFERENCES pm.campaigns(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, user_id)
);

-- ============================================================
-- SCHEMA: wa (WhatsApp Automation)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS wa;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE wa.instance_status AS ENUM ('active', 'disconnected', 'pairing');
CREATE TYPE wa.message_type AS ENUM ('text', 'image', 'video', 'audio', 'document');
CREATE TYPE wa.match_type AS ENUM ('exact', 'contains', 'starts_with');
CREATE TYPE wa.message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE wa.msg_status AS ENUM ('received', 'processing', 'sent', 'failed');
CREATE TYPE wa.send_job_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE wa.campaign_type AS ENUM ('bulk_distribution', 'broadcast');
CREATE TYPE wa.scheduling_mode AS ENUM ('automatic', 'manual_waves');
CREATE TYPE wa.wa_campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed');
CREATE TYPE wa.event_status AS ENUM ('pending', 'queued', 'sending', 'sent', 'failed');
CREATE TYPE wa.queue_status AS ENUM ('pending', 'processing', 'sent', 'failed');

-- ============================================================
-- WA INSTANCES (WhatsApp sessions)
-- ============================================================
CREATE TABLE wa.wa_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    provider_type text NOT NULL DEFAULT 'watsender',
    api_key text,
    session_id text,
    webhook_url text,
    status wa.instance_status NOT NULL DEFAULT 'disconnected',
    qr_code_data text,
    last_activity_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_instances_org ON wa.wa_instances(organization_id);

-- ============================================================
-- WA SEQUENCES (automation workflows)
-- ============================================================
CREATE TABLE wa.wa_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_sequences_org ON wa.wa_sequences(organization_id);

-- ============================================================
-- WA SEQUENCE STEPS
-- ============================================================
CREATE TABLE wa.wa_sequence_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id uuid NOT NULL REFERENCES wa.wa_sequences(id) ON DELETE CASCADE,
    position int NOT NULL DEFAULT 0,
    message_type wa.message_type NOT NULL DEFAULT 'text',
    message_body text,
    media_url text,
    delay_seconds int DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_sequence_steps_seq ON wa.wa_sequence_steps(sequence_id, position);

-- ============================================================
-- WA TRIGGERS (keyword → sequence)
-- ============================================================
CREATE TABLE wa.wa_triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    instance_id uuid NOT NULL REFERENCES wa.wa_instances(id) ON DELETE CASCADE,
    keyword text NOT NULL,
    match_type wa.match_type NOT NULL DEFAULT 'exact',
    sequence_id uuid NOT NULL REFERENCES wa.wa_sequences(id) ON DELETE CASCADE,
    enabled boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_triggers_org ON wa.wa_triggers(organization_id);
CREATE INDEX idx_wa_triggers_instance ON wa.wa_triggers(instance_id);

-- ============================================================
-- WA MESSAGES (inbox)
-- ============================================================
CREATE TABLE wa.wa_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    instance_id uuid NOT NULL REFERENCES wa.wa_instances(id) ON DELETE CASCADE,
    sender_jid text NOT NULL,
    message_body text,
    matched_keyword text,
    trigger_id uuid REFERENCES wa.wa_triggers(id) ON DELETE SET NULL,
    direction wa.message_direction NOT NULL DEFAULT 'inbound',
    status wa.msg_status NOT NULL DEFAULT 'received',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_org ON wa.wa_messages(organization_id, created_at DESC);
CREATE INDEX idx_wa_messages_instance ON wa.wa_messages(instance_id);

-- ============================================================
-- WA SEND JOBS (multi-step sequence execution tracking)
-- ============================================================
CREATE TABLE wa.wa_send_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    message_id uuid NOT NULL REFERENCES wa.wa_messages(id) ON DELETE CASCADE,
    sequence_id uuid NOT NULL REFERENCES wa.wa_sequences(id) ON DELETE CASCADE,
    current_step int NOT NULL DEFAULT 0,
    total_steps int NOT NULL DEFAULT 0,
    status wa.send_job_status NOT NULL DEFAULT 'running',
    error_message text,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_send_jobs_msg ON wa.wa_send_jobs(message_id);

-- ============================================================
-- WA CAMPAIGNS (bulk send campaigns)
-- ============================================================
CREATE TABLE wa.wa_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    campaign_type wa.campaign_type NOT NULL DEFAULT 'broadcast',
    instance_id uuid NOT NULL REFERENCES wa.wa_instances(id) ON DELETE CASCADE,
    instance_api_key text,
    group_list_id uuid NOT NULL,
    product_ids uuid[] DEFAULT '{}'::uuid[],
    delay_min_seconds int DEFAULT 60,
    delay_max_seconds int DEFAULT 300,
    wave_delay_min_seconds int DEFAULT 60,
    wave_delay_max_seconds int DEFAULT 300,
    scheduling_mode wa.scheduling_mode DEFAULT 'automatic',
    wave_start_times jsonb,
    scheduled_start_at timestamptz,
    start_jitter_seconds int DEFAULT 120,
    status wa.wa_campaign_status NOT NULL DEFAULT 'draft',
    total_events int DEFAULT 0,
    completed_events int DEFAULT 0,
    failed_events int DEFAULT 0,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_campaigns_org ON wa.wa_campaigns(organization_id, status);

-- ============================================================
-- WA CAMPAIGN EVENTS (individual send events within a campaign)
-- ============================================================
CREATE TABLE wa.wa_campaign_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES wa.wa_campaigns(id) ON DELETE CASCADE,
    product_id uuid,
    group_jid text NOT NULL,
    batch_index int NOT NULL DEFAULT 0,
    send_order int NOT NULL DEFAULT 0,
    scheduled_at timestamptz NOT NULL,
    status wa.event_status NOT NULL DEFAULT 'pending',
    actual_sent_at timestamptz,
    api_status_code int,
    api_response text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_campaign_events_status ON wa.wa_campaign_events(campaign_id, status);
CREATE INDEX idx_wa_campaign_events_scheduled ON wa.wa_campaign_events(status, scheduled_at);

-- ============================================================
-- WA SEND QUEUE (serialized message dispatch, partitioned)
-- ============================================================
CREATE TABLE wa.wa_send_queue (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES wa.wa_instances(id) ON DELETE CASCADE,
    instance_api_key text,
    recipient text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    priority int DEFAULT 1,
    attempts int DEFAULT 0,
    max_attempts int DEFAULT 3,
    status wa.queue_status NOT NULL DEFAULT 'pending',
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    executed_at timestamptz,
    error_message text,
    campaign_event_id uuid REFERENCES wa.wa_campaign_events(id) ON DELETE SET NULL,
    message_id uuid REFERENCES wa.wa_messages(id) ON DELETE SET NULL,
    send_job_id uuid REFERENCES wa.wa_send_jobs(id) ON DELETE SET NULL,
    presence_type text,
    presence_duration_seconds int,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, scheduled_at)
) PARTITION BY RANGE (scheduled_at);

CREATE TABLE wa.wa_send_queue_2026_07 PARTITION OF wa.wa_send_queue
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE wa.wa_send_queue_2026_08 PARTITION OF wa.wa_send_queue
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_wa_send_queue_status ON wa.wa_send_queue(status, priority DESC, scheduled_at);
CREATE INDEX idx_wa_send_queue_session ON wa.wa_send_queue(session_id, status);

-- ============================================================
-- WA GROUP LISTS
-- ============================================================
CREATE TABLE wa.wa_group_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_group_lists_org ON wa.wa_group_lists(organization_id);

-- ============================================================
-- WA GROUP LIST ITEMS
-- ============================================================
CREATE TABLE wa.wa_group_list_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_list_id uuid NOT NULL REFERENCES wa.wa_group_lists(id) ON DELETE CASCADE,
    group_jid text NOT NULL,
    group_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_group_list_items_list ON wa.wa_group_list_items(group_list_id);

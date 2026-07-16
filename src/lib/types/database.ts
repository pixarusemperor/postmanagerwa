export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  pm: {
    Tables: {
      organizations: { Row: OrganizationRow; Insert: OrganizationInsert; Update: OrganizationUpdate };
      organization_members: { Row: OrgMemberRow; Insert: OrgMemberInsert; Update: OrgMemberUpdate };
      products: { Row: ProductRow; Insert: ProductInsert; Update: ProductUpdate };
      product_variants: { Row: ProductVariantRow; Insert: ProductVariantInsert; Update: ProductVariantUpdate };
      product_categories: { Row: CategoryRow; Insert: CategoryInsert; Update: CategoryUpdate };
      product_category_members: { Row: { product_id: string; category_id: string }; Insert: { product_id: string; category_id: string }; Update: never };
      suppliers: { Row: SupplierRow; Insert: SupplierInsert; Update: SupplierUpdate };
      product_suppliers: { Row: { product_id: string; supplier_id: string }; Insert: { product_id: string; supplier_id: string }; Update: never };
      parsing_rules: { Row: ParsingRuleRow; Insert: ParsingRuleInsert; Update: ParsingRuleUpdate };
      raw_imports: { Row: RawImportRow; Insert: RawImportInsert; Update: RawImportUpdate };
      extracts: { Row: ExtractRow; Insert: ExtractInsert; Update: ExtractUpdate };
      candidates: { Row: CandidateRow; Insert: CandidateInsert; Update: CandidateUpdate };
      campaigns: { Row: CampaignRow; Insert: CampaignInsert; Update: CampaignUpdate };
      anti_detection_configs: { Row: AntiDetectionRow; Insert: AntiDetectionInsert; Update: AntiDetectionUpdate };
      posts: { Row: PostRow; Insert: PostInsert; Update: PostUpdate };
      media: { Row: MediaRow; Insert: MediaInsert; Update: MediaUpdate };
      media_groups: { Row: MediaGroupRow; Insert: MediaGroupInsert; Update: MediaGroupUpdate };
      media_group_items: { Row: MediaGroupItemRow; Insert: MediaGroupItemInsert; Update: MediaGroupItemUpdate };
      target_lists: { Row: TargetListRow; Insert: TargetListInsert; Update: TargetListUpdate };
      targets: { Row: TargetRow; Insert: TargetInsert; Update: TargetUpdate };
      campaign_target_lists: { Row: { campaign_id: string; target_list_id: string }; Insert: { campaign_id: string; target_list_id: string }; Update: never };
      dispatches: { Row: DispatchRow; Insert: DispatchInsert; Update: DispatchUpdate };
      wa_posters: { Row: WAPosterRow; Insert: WAPosterInsert; Update: WAPosterUpdate };
      contact_numbers: { Row: ContactNumberRow; Insert: ContactNumberInsert; Update: ContactNumberUpdate };
      caption_templates: { Row: CaptionTemplateRow; Insert: CaptionTemplateInsert; Update: CaptionTemplateUpdate };
      prefilled_message_templates: { Row: PrefilledTemplateRow; Insert: PrefilledTemplateInsert; Update: PrefilledTemplateUpdate };
      discount_rules: { Row: DiscountRuleRow; Insert: DiscountRuleInsert; Update: DiscountRuleUpdate };
      discount_rule_products: { Row: { discount_rule_id: string; product_id: string }; Insert: { discount_rule_id: string; product_id: string }; Update: never };
      ai_configs: { Row: AIConfigRow; Insert: AIConfigInsert; Update: AIConfigUpdate };
      ai_usage_logs: { Row: AIUsageRow; Insert: AIUsageInsert; Update: never };
      action_logs: { Row: ActionLogRow; Insert: ActionLogInsert; Update: never };
      notifications: { Row: NotificationRow; Insert: NotificationInsert; Update: NotificationUpdate };
      human_poster_working_hours: { Row: WorkingHourRow; Insert: WorkingHourInsert; Update: WorkingHourUpdate };
      human_poster_assignments: { Row: { campaign_id: string; user_id: string }; Insert: { campaign_id: string; user_id: string }; Update: never };
    };
  };
  wa: {
    Tables: Record<string, any>;
  };
}

// ---- Organization ----
export interface OrganizationRow { id: string; name: string; slug: string; plan: string; settings: Json; created_at: string }
export interface OrganizationInsert { name: string; slug: string; plan?: string; settings?: Json }
export interface OrganizationUpdate { name?: string; plan?: string; settings?: Json }

// ---- Org Members ----
export interface OrgMemberRow { id: string; organization_id: string; user_id: string; role: 'admin' | 'campaign_manager' | 'product_manager'; created_at: string }
export interface OrgMemberInsert { organization_id: string; user_id: string; role?: 'admin' | 'campaign_manager' | 'product_manager' }
export interface OrgMemberUpdate { role?: 'admin' | 'campaign_manager' | 'product_manager' }

// ---- Products ----
export interface ProductRow {
  id: string; organization_id: string; code: string; name: string;
  selling_price: number | null; cost_price: number | null; promotional_price: number | null;
  currency: string; discounted_price: number | null; stock_count: number;
  description: string | null; is_active: boolean; created_at: string; updated_at: string;
}
export interface ProductInsert {
  organization_id: string; code: string; name: string;
  selling_price?: number; cost_price?: number; promotional_price?: number;
  currency?: string; discounted_price?: number; stock_count?: number; description?: string;
}
export interface ProductUpdate {
  name?: string; selling_price?: number; cost_price?: number; promotional_price?: number;
  discounted_price?: number; stock_count?: number; description?: string; is_active?: boolean;
  updated_at?: string;
}

// ---- Product Variants ----
export interface ProductVariantRow { id: string; product_id: string; caption: string | null; display_order: number; created_at: string }
export interface ProductVariantInsert { product_id: string; caption?: string; display_order?: number }
export interface ProductVariantUpdate { caption?: string; display_order?: number }

// ---- Categories ----
export interface CategoryRow { id: string; organization_id: string; name: string; path: string; parent_id: string | null; created_at: string }
export interface CategoryInsert { organization_id: string; name: string; path: string; parent_id?: string }
export interface CategoryUpdate { name?: string; path?: string; parent_id?: string | null }

// ---- Suppliers ----
export interface SupplierRow { id: string; organization_id: string; name: string; contact_info: Json; created_at: string }
export interface SupplierInsert { organization_id: string; name: string; contact_info?: Json }
export interface SupplierUpdate { name?: string; contact_info?: Json }

// ---- Parsing Rules ----
export interface ParsingRuleRow { id: string; supplier_id: string; field_name: string; rule_pattern: string; priority: number; created_at: string }
export interface ParsingRuleInsert { supplier_id: string; field_name: string; rule_pattern: string; priority?: number }
export interface ParsingRuleUpdate { field_name?: string; rule_pattern?: string; priority?: number }

// ---- Raw Imports ----
export interface RawImportRow {
  id: string; organization_id: string; source_type: 'csv' | 'whatsapp_zip' | 'shopify' | 'website' | 'manual';
  file_url: string | null; batch_id: string | null; status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null; created_at: string;
}
export interface RawImportInsert { organization_id: string; source_type: string; file_url?: string; batch_id?: string }
export interface RawImportUpdate { status?: string; error_message?: string }

// ---- Extracts ----
export interface ExtractRow {
  id: string; raw_import_id: string; message_text: string | null; sender_number: string | null;
  timestamp: string | null; status: 'pending' | 'filtered' | 'promoted'; created_at: string;
}
export interface ExtractInsert { raw_import_id: string; message_text?: string; sender_number?: string; timestamp?: string }
export interface ExtractUpdate { status?: string }

// ---- Candidates ----
export interface CandidateRow {
  id: string; extract_id: string | null; product_id: string | null;
  suggested_name: string | null; suggested_price: number | null; suggested_fields: Json;
  status: 'pending_approval' | 'approved' | 'rejected';
  reviewed_by: string | null; review_reason: string | null; reviewed_at: string | null; created_at: string;
}
export interface CandidateInsert { extract_id?: string; suggested_name?: string; suggested_price?: number; suggested_fields?: Json }
export interface CandidateUpdate { suggested_name?: string; suggested_price?: number; suggested_fields?: Json; status?: string; reviewed_by?: string; review_reason?: string; reviewed_at?: string }

// ---- Campaigns ----
export interface CampaignRow {
  id: string; organization_id: string; name: string; description: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  post_mode: 'manual' | 'automated' | 'export'; scheduled_start_at: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}
export interface CampaignInsert {
  organization_id: string; name: string; description?: string; post_mode?: string;
  scheduled_start_at?: string; created_by?: string;
}
export interface CampaignUpdate {
  name?: string; description?: string; status?: string; post_mode?: string;
  scheduled_start_at?: string; updated_at?: string;
}

// ---- Anti-Detection Config ----
export interface AntiDetectionRow {
  id: string; campaign_id: string; max_posts_per_hour: number; min_delay_seconds: number;
  max_delay_seconds: number; randomization_jitter_seconds: number; wa_poster_rotation_count: number;
  product_target_cooldown_hours: number; variant_cycle_strategy: 'sequential' | 'random';
  randomize_target_order_per_wave: boolean; ai_rewrite_per_recipient: boolean;
  forward_grouping: boolean; created_at: string;
}
export interface AntiDetectionInsert {
  campaign_id: string; max_posts_per_hour?: number; min_delay_seconds?: number;
  max_delay_seconds?: number; randomization_jitter_seconds?: number; wa_poster_rotation_count?: number;
  product_target_cooldown_hours?: number; variant_cycle_strategy?: string;
  randomize_target_order_per_wave?: boolean; ai_rewrite_per_recipient?: boolean; forward_grouping?: boolean;
}
export interface AntiDetectionUpdate extends Partial<AntiDetectionInsert> {}

// ---- Posts ----
export interface PostRow {
  id: string; campaign_id: string; position: number; type: string; snapshot: Json;
  caption_override: string | null; created_at: string;
}
export interface PostInsert { campaign_id: string; position?: number; type?: string; snapshot: Json; caption_override?: string }
export interface PostUpdate { position?: number; type?: string; snapshot?: Json; caption_override?: string }

// ---- Media ----
export interface MediaRow {
  id: string; organization_id: string; storage_path: string; bucket_name: string;
  mime_type: string | null; file_size: number | null;
  product_id: string | null; variant_id: string | null; extract_id: string | null; created_at: string;
}
export interface MediaInsert { organization_id: string; storage_path: string; bucket_name?: string; mime_type?: string; file_size?: number; product_id?: string; variant_id?: string; extract_id?: string }
export interface MediaUpdate { product_id?: string; variant_id?: string; extract_id?: string }

// ---- Media Groups ----
export interface MediaGroupRow { id: string; post_id: string | null; created_at: string }
export interface MediaGroupInsert { post_id?: string }
export interface MediaGroupUpdate { post_id?: string }
export interface MediaGroupItemRow { id: string; media_group_id: string; media_id: string; position: number; type: 'image' | 'video' }
export interface MediaGroupItemInsert { media_group_id: string; media_id: string; position?: number; type?: string }
export interface MediaGroupItemUpdate { position?: number; type?: string }

// ---- Targets ----
export interface TargetListRow { id: string; organization_id: string; name: string; description: string | null; created_at: string }
export interface TargetListInsert { organization_id: string; name: string; description?: string }
export interface TargetListUpdate { name?: string; description?: string }
export interface TargetRow { id: string; target_list_id: string; type: 'group' | 'individual'; jid: string; display_name: string | null; created_at: string }
export interface TargetInsert { target_list_id: string; type: string; jid: string; display_name?: string }
export interface TargetUpdate { jid?: string; display_name?: string }

// ---- Dispatches ----
export interface DispatchRow {
  id: string; organization_id: string; campaign_id: string; post_id: string; target_id: string;
  wave_number: number; scheduled_at: string; wa_poster_id: string | null;
  resolved_variant_id: string | null; resolved_caption: string | null;
  status: string; actual_sent_at: string | null; error_message: string | null;
  posted_by: string | null; created_at: string;
}
export interface DispatchInsert {
  organization_id: string; campaign_id: string; post_id: string; target_id: string;
  wave_number?: number; scheduled_at: string; wa_poster_id?: string; resolved_caption?: string;
}
export interface DispatchUpdate {
  status?: string; actual_sent_at?: string; error_message?: string;
  posted_by?: string; wa_poster_id?: string; resolved_caption?: string;
}

// ---- WA Posters ----
export interface WAPosterRow {
  id: string; organization_id: string; name: string; provider_type: string;
  api_key: string | null; base_url: string | null; session_id: string | null;
  status: string; qr_code_data: string | null; last_activity_at: string | null; created_at: string;
}
export interface WAPosterInsert { organization_id: string; name: string; provider_type?: string; api_key?: string; base_url?: string }
export interface WAPosterUpdate { name?: string; api_key?: string; base_url?: string; status?: string }

// ---- Contact Numbers ----
export interface ContactNumberRow {
  id: string; organization_id: string; phone_number: string; country_code: string;
  label: string | null; is_also_wa_poster: boolean; wa_poster_id: string | null; created_at: string;
}
export interface ContactNumberInsert { organization_id: string; phone_number: string; country_code: string; label?: string; is_also_wa_poster?: boolean; wa_poster_id?: string }
export interface ContactNumberUpdate { phone_number?: string; country_code?: string; label?: string }

// ---- Templates ----
export interface CaptionTemplateRow { id: string; organization_id: string; name: string; body: string; created_at: string; updated_at: string }
export interface CaptionTemplateInsert { organization_id: string; name: string; body: string }
export interface CaptionTemplateUpdate { name?: string; body?: string; updated_at?: string }
export interface PrefilledTemplateRow { id: string; organization_id: string; name: string; body: string; created_at: string; updated_at: string }
export interface PrefilledTemplateInsert { organization_id: string; name: string; body: string }
export interface PrefilledTemplateUpdate { name?: string; body?: string; updated_at?: string }

// ---- Discount Rules ----
export interface DiscountRuleRow {
  id: string; organization_id: string; name: string; type: string; discount_type: string;
  discount_value: number; priority: number; starts_at: string | null; ends_at: string | null; created_at: string;
}
export interface DiscountRuleInsert { organization_id: string; name: string; type: string; discount_type: string; discount_value: number; priority?: number; starts_at?: string; ends_at?: string }
export interface DiscountRuleUpdate { name?: string; discount_value?: number; priority?: number; starts_at?: string; ends_at?: string }

// ---- AI ----
export interface AIConfigRow { id: string; organization_id: string; feature_name: string; enabled: boolean; provider: string; api_key: string | null; model_name: string | null; token_limit: number; created_at: string }
export interface AIConfigInsert { organization_id: string; feature_name: string; enabled?: boolean; provider?: string; api_key?: string; model_name?: string; token_limit?: number }
export interface AIConfigUpdate { enabled?: boolean; provider?: string; api_key?: string; model_name?: string; token_limit?: number }
export interface AIUsageRow { id: string; organization_id: string; feature_name: string; model_used: string | null; tokens_consumed: number | null; estimated_cost: number | null; created_at: string }
export interface AIUsageInsert { organization_id: string; feature_name: string; model_used?: string; tokens_consumed?: number; estimated_cost?: number }

// ---- Action Log ----
export interface ActionLogRow {
  id: string; organization_id: string; actor_id: string | null; action_code: string;
  entity_type: string | null; entity_id: string | null; changes: Json;
  reason: string | null; ip_address: string | null; user_agent: string | null; metadata: Json; created_at: string;
}
export interface ActionLogInsert {
  organization_id: string; actor_id?: string; action_code: string; entity_type?: string;
  entity_id?: string; changes?: Json; reason?: string;
}

// ---- Notifications ----
export interface NotificationRow {
  id: string; organization_id: string; user_id: string; channel: string;
  title_code: string; body_code: string; payload: Json; read_at: string | null; created_at: string;
}
export interface NotificationInsert { organization_id: string; user_id: string; channel?: string; title_code: string; body_code: string; payload?: Json }
export interface NotificationUpdate { read_at?: string }

// ---- Human Posters ----
export interface WorkingHourRow { id: string; user_id: string; day_of_week: number; start_time: string; end_time: string }
export interface WorkingHourInsert { user_id: string; day_of_week: number; start_time: string; end_time: string }
export interface WorkingHourUpdate { start_time?: string; end_time?: string }

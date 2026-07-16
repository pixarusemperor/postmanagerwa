# Architecture Decisions & AI Reference

Decisions from database/storage expert review. Feed this to coding agents to prevent hallucinated APIs or wrong patterns.

---

## Storage: Cloudflare R2

**Why:** $0 egress, S3-compatible API, free tier (10GB storage + 1M writes + 10M reads/month). No pricing cliff when exceeding free tier — pay-as-you-go at $0.015/GB-month. Built-in CDN via Cloudflare edge network. Zero migration risk (S3 API compatible).

**SDK:** `@aws-sdk/client-s3` v3 (NOT deprecated `aws-sdk` v2)

**Client init pattern:**
```typescript
import { S3Client } from "@aws-sdk/client-s3";
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});
```

**Presigned upload URLs:** Use `@aws-sdk/s3-request-presigner` → `getSignedUrl(client, new PutObjectCommand(...), { expiresIn: 900 })`

**Image variants:** Do NOT store separate thumbnail rows. Use Cloudflare image transformation via URL params (`?width=150&height=150&resize=contain`). Store high-res once.

**Custom domain:** Do NOT use `.r2.dev` URLs in production (rate-limited). Connect custom subdomain to bucket in Cloudflare dashboard — 2 clicks, free, full CDN.

**Official docs:**
- https://developers.cloudflare.com/r2/api/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/api/s3/extensions/
- https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/
- https://developers.cloudflare.com/r2/llms.txt

---

## Database: Supabase (Postgres)

**Same project as auth.** Keep everything in one Supabase project for native FK references to `auth.users` and RLS across all tables.

### Extensions to enable:
- `pg_cron` — trigger lazy dispatch waves
- `ltree` — hierarchical product categories
- `pg_partman` — time-based partitioning on logs/dispatches
- `pgcrypto` — UUID generation

### RLS (Row-Level Security)
Enable on EVERY table. Store `organization_id` in JWT user metadata for fast policy checks:
```sql
CREATE POLICY tenant_isolation ON campaigns
FOR ALL USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);
```
Do NOT write RLS policies that do deep cross-table joins. Keep them static.

### Migrations
Use Supabase CLI locally. Never raw SQL in production dashboard.
```bash
supabase init
supabase start
supabase migration new create_initial_schema
supabase db diff -f descriptive_name   # capture local changes
supabase db push                        # deploy to remote
```

**Official docs:**
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/local-development/declarative-database-schemas
- https://supabase.com/docs

---

## Key Schema Decisions

### Dispatch Table
- **Materialize lazily per Wave** (not all waves upfront). When campaign runs, insert P×T rows for current wave only.
- **Partition by RANGE on `scheduled_at`** (monthly). Use `pg_partman` to auto-create/drop partitions.
- **Composite index:** `(wa_poster_id, status, scheduled_at)` for "today's pending dispatches" query.

### Product → Post Freeze
- **JSONB column `snapshot` on `posts` table.** Freeze full product state at creation time.
- **GIN index** on snapshot for queries like `WHERE (snapshot->>'selling_price')::numeric > 100`
- Do NOT normalize frozen product fields into separate columns — schema evolves, JSONB doesn't break.

### Action Log Table
- **Same DB, dedicated table, append-only.** Revoke UPDATE/DELETE for app roles.
- **Partition by month** via `pg_partman`.
- Schema: `id, actor_id, organization_id, action_type, entity_type, entity_id, changes (JSONB), reason, ip_address, user_agent, metadata (JSONB), created_at`
- If volume goes parabolic → offload to ClickHouse or time-series DB later.

### Product Categories
- **Use Postgres `ltree` extension.** Stores hierarchy as dot-separated path: `Electronics.Smartwatches.Fitness`
- GiST index for instant descendant queries: `WHERE path <@ 'Electronics'`
- Many-to-many: standard join table `product_categories` between Product and Category.
- Do NOT use nested sets (updates too expensive) or adjacency lists (recursive CTEs don't scale).

### Discount Rules
- **Resolve at application time.** NOT in DB triggers or computed columns.
- Priority: Product-specific > Category-specific > Date-range > Global.
- **Materialize final computed price into `Post.snapshot` JSONB** at campaign creation time.

### Media Table
- **Dedicated `media` table** (NOT JSON arrays on Product).
- Schema: `id, organization_id, storage_path (text, relative path), bucket_name, mime_type, file_size, product_id, variant_id, extract_id, created_at`
- Polymorphic: explicit nullable FKs per entity type (product_id, variant_id, extract_id) with ON DELETE CASCADE.
- Store relative paths (e.g., `uploads/org_123/products/prod_456.jpg`) + bucket_name. Never store full URLs.

### WhatsApp Webhook Handling
- **Put an async queue in front of webhook receiver** (Redis/Upstash or serverless queue).
- WhatsApp delivery receipts will flood your DB if written synchronously. Batch/throttle writes.

---

## MCP Servers

For Claude Code / Cursor / Command Code agent integration:

### Supabase MCP
```json
{
  "supabase-mcp": {
    "command": "npx",
    "args": ["-y", "@supabase/mcp-server"],
    "env": {
      "SUPABASE_ACCESS_TOKEN": "<token>",
      "SUPABASE_PROJECT_REF": "<ref>"
    }
  }
}
```

### Cloudflare MCP
Uses "Code Mode" — only `search()` and `execute()` tools (~1K tokens). Manages R2 buckets, Workers, DNS.

**Official docs:**
- https://supabase.com/docs/guides/ai-tools/mcp
- https://github.com/supabase/mcp
- https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite
- https://github.com/cloudflare/mcp
- https://developers.cloudflare.com/agent-setup/claude-code/
- https://blog.cloudflare.com/code-mode-mcp/
- https://developers.cloudflare.com/changelog/post/2026-03-26-mcp-portal-code-mode/

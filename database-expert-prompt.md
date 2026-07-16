# Database & Storage Design — PostManagerwa

## What We're Building

Multi-tenant SaaS for WhatsApp campaign management. Users import products, organize them into campaigns with templated captions, schedule posts to WhatsApp groups/numbers, and track delivery — both manual (human copy-paste) and automated (WhatsApp API). Think: CMS + scheduling engine for WhatsApp product marketing.

Auth is handled by Supabase. This question is about database schema and file storage.

## Domain Model

### Multi-Tenancy
- **Account** → N Organizations. **Organization** owns everything. Future: parent → sub-Organization franchise hierarchy.
- **Users** belong to Organizations with roles (Admin, Campaign Manager, Product Manager).

### Campaign & Dispatch
- **Campaign** has N **Posts** (ordered), targets N **Targets** (groups/numbers). Lifecycle: draft → scheduled → running ↔ paused → completed | cancelled.
- **Dispatch** = 1 Post × 1 Target. A campaign with P Posts and T Targets generates P×T Dispatches per Wave. Each Dispatch has: scheduled_at, WA Poster assignment, resolved Product Variant, status (pending/in_progress/done/sent/failed/delayed/missed).
- **Wave** = one full pass of all Dispatches.

### Products
- **Product**: code, name, selling price, cost price, promotional price, currency, discounted price, stock count, description, categories (many-to-many, hierarchical), variants (many), suppliers (many).
- **Product Variant**: alternative media + caption for same product (cycled to avoid audience fatigue).
- **Product Category**: hierarchical, product can be in many categories.
- **Discount Rule**: per product, per category, per date range, per import batch, per keyword filter. Fixed or percentage.

### Import Pipeline
- **Raw Import** (CSV, WhatsApp ZIP, Shopify) → **Extract** (raw message + media paired) → **Candidate** (filtered, review) → **Product**.
- **Column Mapping**: CSV columns → Product fields. **Import Formula**: data transformation preview.

### Templates
- **Caption Template**: variables like `{{Selling Price}}`, `{{Margin}}`, `{{WhatsApp Link}}`, formatting (bold/italic/etc).
- **Prefilled Message Template**: `wa.me` link message structure, exportable for chatbots.

### WhatsApp Integration
- **WA Poster**: API connection config (key, URL, provider, session). Multiple for rotation/anti-detection.
- **Contact Number**: number in `wa.me` links for customer orders.
- **Anti-Detection Config**: max posts/hour/WA Poster, min/max delay, randomization jitter, product-target cooldown, WA Poster rotation count.

### AI
- Features: Post ordering suggestions, message rewriting for individual targets, import parsing (fallback after regex rules fail).
- Each toggleable independently. Provider: Vertex AI, global SaaS key, or BYOK. Track token usage + cost per Organization.

### Action Log
- **Everything** is logged: every message sent, campaign edit, dispatch status change, import, login, AI interaction. Immutable. Human actions include who/what/why/when.

## Key Relationships

```
Organization 1──N Campaign
Organization 1──N Product
Organization 1──N WAPoster
Organization 1──N TargetList
Organization 1──N Supplier
Organization 1──N CaptionTemplate

Campaign 1──N Post (ordered, frozen snapshot of Product at creation time)
Campaign 1──1 TargetList ──N Target
Campaign 1──1 AntiDetectionConfig
Campaign 1──N Dispatch (P×T rows per Wave)

Product N──M ProductCategory (hierarchical)
Product 1──N ProductVariant
Product N──M Supplier
Product 1──N DiscountRule

Post 0──1 MediaGroup ──N media files
Dispatch N──1 WAPoster
Dispatch N──1 ProductVariant

RawImport 1──N Extract → Candidate → Product
Supplier 1──N ParsingRule
```

## Questions

### 1. File Storage: Supabase Storage vs S3

We need to store: product images (N per product), product variant images, WhatsApp ZIP media (supplier feeds), and generated export ZIPs. Auth is Supabase. Supabase Storage is simpler (same project, same SDK, built-in auth integration) but has bandwidth/storage limits. S3 is more scalable and cheaper at volume but adds complexity (separate credentials, CORS, URL signing).

- At what scale does Supabase Storage become a bottleneck vs S3?
- Is there a meaningful cost difference for a media-heavy SaaS doing 100GB+ of product images?
- Which gives better performance for frequent reads (displaying product thumbnails in campaign editor)?
- Would you recommend starting with Supabase Storage and migrating to S3 later, or going S3 from day one?
- How should we store file references in the DB? Full URL? Storage path + bucket? Should media records have their own table or be JSON columns on Product/Post?

### 2. Dispatch Table Strategy

A Campaign with 100 Posts × 50 Targets = 5,000 Dispatch rows per Wave. Multiple Waves can be scheduled. A busy Organization might have millions of Dispatch rows.

- Materialize all Dispatches upfront when the campaign is scheduled, or generate them lazily per Wave?
- For read queries ("show today's pending Dispatches for this Human Poster"), what indexes matter?
- Should old Dispatches (completed/cancelled campaigns) be archived or partitioned by organization_id?

### 3. Product → Post Freeze

When a Product is added to a Campaign, the Post stores a frozen copy of the Product data (price, caption, media) so changing the Product later doesn't affect existing Posts.

- JSONB column on Post with the snapshot? Or duplicate Product fields into Post columns?
- If JSONB: how do we query "all Posts that had a selling price > 100" across frozen data?
- Trade-off between schema flexibility (JSONB) and query performance (normalized columns)?

### 4. Action Log — Immutable, High Write Volume

Every action logged: dispatches sent, campaigns edited, imports, logins, AI calls. High write volume, occasional reads (performance dashboard, AI training).

- Separate table from main data? Separate database?
- Append-only design? Partition by organization_id or by month?
- Should we use Supabase's built-in audit features or roll our own table?
- What's the minimal schema: actor_id, organization_id, action_type, entity_type, entity_id, changes (JSONB), reason, created_at? Anything missing?

### 5. Product Category Hierarchy + Many-to-Many

Categories are hierarchical (Electronics → Smartwatches → Fitness). A Product can be in multiple categories. Need to query "all products in Electronics OR any subcategory" efficiently.

- Adjacency list (parent_id), nested sets, or materialized path?
- Performance of "get all descendants" queries for filtering.
- With Supabase/Postgres, what's the simplest approach that scales?

### 6. Discount Rule Resolution

Multiple discount rules can apply to the same Product (per product, per category, per date range, per batch). Most specific wins.

- Store rules in their own table with a priority/precedence column, or resolve at query time?
- If a Product has a direct 20% discount AND its category has a 10% discount AND there's a date-based 15% discount — should the resolver be a DB function, application code, or a materialized computed field?

### 7. General Supabase/Postgres Advice

- We're using Supabase for auth. Should the rest of the DB be in the same Supabase project or separate?
- Row-Level Security: enable it per organization_id, or handle multi-tenancy at the application layer since we already scope queries?
- Any Postgres extensions you'd recommend (pg_cron for scheduling, pg_partman for partitioning)?
- Given this domain, any red flags or "don't do this" patterns you see?

### 8. Media & File Metadata

Products have images. Product Variants have images. Extracts have media files. Export generates ZIPs.

- Should media files have their own `media` table (id, url, type, size, product_id, variant_id, extract_id)?
- Or store media URLs as JSON arrays on Product/Extract?
- How to handle image variants (thumbnails for campaign editor grid view vs full-res for export)?

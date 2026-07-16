# Context

## Glossary

- **Account** — The top-level login. One Account can manage multiple Organizations.

- **Organization** — A business entity under an Account. Owns Campaigns, Products, Contact Numbers, WA Posters, and Target Lists. Users are added at this level with role-based permissions. Designed to support future franchise hierarchy (parent Organization → sub-Organizations with shared/local catalogs and campaign inheritance).

- **User** — A team member with login credentials, added to an Organization with role-based permissions (e.g., Admin, Campaign Manager, Product Manager). Architecture supports role-based permissions but all Users currently operate with full access — a granular permission matrix will be implemented later.

- **Notification** — In-app notification system for Human Posters when Dispatches are pending, late, or missed. Supports push notifications on Android and iOS (phone ring). Architected with a pluggable notification channel interface so additional channels (email, Slack, Telegram) can be connected via API.

- **Billing** — Post-MVP feature. Architecture must support tiered plans and usage limits per Organization from day one (e.g., organization.plan column, usage counters) but no billing UI or payment integration in initial launch.

- **Human Poster** — Any User within an Organization who performs manual posting. A User becomes a Human Poster by taking on or being assigned a posting task. No special role required — any authorized User can post.

- **WA Poster** — A configured WhatsApp API connection used for automated Campaign posting. Stores the API key, base URL, provider type, and associated WhatsApp instance/session. An Organization can have multiple WA Posters — the system rotates them for load balancing and anti-detection. WA Posters are one implementation of the PostingProvider interface.

- **PostingProvider** — A plugin interface abstracting how Posts are delivered. Three built-in implementations: Manual (Human Poster copies/pastes), Automated (WA Poster sends via API), and Export (downloadable ZIP with media + captions + links). New providers can be added without changing core Campaign logic.

- **AI Post Suggestion** — When creating a Campaign, the AI can suggest an optimal Post ordering after the user selects Products. The user reviews, adjusts, reorders via drag-and-drop, or discards entirely. When the user reorders, the AI adapts immediately within the same Campaign. Toggleable per Organization.

- **Campaign** — A goal-driven, chronologically ordered sequence of Posts targeting multiple Targets (groups and/or individual numbers). When Products are bulk-selected, a timeline preview is shown — the user confirms, reorders via drag-and-drop, or adjusts before Posts are created. AI can suggest post ordering within the preview (if enabled). Each Post in the Campaign is dispatched to all Targets, with optional randomization of target order between waves to avoid pattern detection. Editable at any time — changes apply only to future Dispatches, never to already-sent ones. Duplicatable via Campaign Duplication. Lifecycle: draft → scheduled → running ↔ paused → completed | cancelled.

- **Campaign Duplication** — Multiple duplication modes: (1) Full Clone — everything copied, ready to run. (2) Draft Clone — structure only, no Dispatches generated, starts as draft. (3) Reschedule Clone — same Posts and Targets, user sets new start time before creation. (4) Product Refresh Clone — same structure but re-snapshots current Product data instead of copying frozen originals. (5) Save as Campaign Template — reusable across the Organization, other Users can instantiate with different Products or Targets.

- **Post** — A single unit of content in a Campaign timeline. One of these types: text-only, media + text, grouped media with text before/after, audio, or document. Posts contain an optional WhatsApp link. Arranged by drag-and-drop (mouse + touch) within a Campaign. A Product converts into a Post by inheriting its default media and caption as a frozen snapshot — the Post can then be edited independently. Posts are sent to all Campaign Targets.

- **Media Group** — An ordered collection of media (images and/or videos) sent together within a single Post. Separate from the caption text that may precede or follow it.

- **Caption Template** — A reusable text block inserted into a Post's caption. Supports formatting (bold, italic, strikethrough, monospace), emojis, and variables: `{{Selling Price}}`, `{{Cost Price}}`, `{{Promotional Price}}`, `{{Discounted Price}}`, `{{Currency}}`, `{{Product Name}}`, `{{Product Code}}`, `{{WhatsApp Link}}`, plus calculated variables: `{{Margin}}` (Selling - Cost), `{{Discount Amount}}` (Selling - Discounted), `{{Discount Percent}}`.

- **Prefilled Message Template** — Defines the structure of the prefilled message embedded in a WhatsApp link (`https://wa.me/...`). Supports variables like `{{Product Name}}`, `{{Product Code}}`, and `{{Selling Price}}` that resolve per Product. Exportable for use in chatbot/automation builders to enable keyword/regex-based auto-reply routing.

- **Product** — An item being offered for sale. Has a unique Product Code, name, selling price, cost price, promotional price, currency, optional discounted price, optional stock count, description, and one or more Product Variants. Imported via CSV, ZIP, Shopify, website, web image search, or manual entry, then enriched with prices and metadata during/after import. Every price must be classified on entry as selling price, cost price, or promotional price. Products are bulk-selected (by search, date range, or select-all) when creating a Campaign — they convert into Posts as frozen snapshots, inheriting the Product's default media and caption. Changing the Product later does not affect existing Posts.

- **Stock Management** — Per-Product stock tracking module. Toggleable per Organization — disabled by default. Designed to plug into external data sources (inventory systems, ERP, product databases) in the future. When enabled: simple stock counter per Product, manual adjustment via Quick Stock Adjust, auto-hide zero-stock products from Campaign selection. Not built for initial launch — placeholder in schema only.

- **Product Code** — A short unique identifier per Product. Embedded in Prefilled Message Templates so inbound customer messages can be auto-routed to the correct product via keyword or regex detection in a chatbot/automation tool.

- **Product Category** — A hierarchical classification for Products. A Category can have subcategories (e.g., Electronics → Smartwatches). A Product can belong to multiple Categories (e.g., a smartwatch is in both "Electronics" and "Fashion → Accessories"). Used for filtering, bulk operations, and discount rules.

- **Discount Rule** — A discount applied at one of these levels: per Product, per Product Category, per Tag/keyword filter, per date range, per timeframe, or per import batch. Can be a fixed amount or a percentage. Multiple rules can apply to the same Product; the most specific rule wins.

- **Product Variant** — An alternative media-and-caption presentation of the same Product. One Product can have multiple Variants, each with its own media and caption. Used to avoid audience fatigue — the same Product appears fresh by cycling through different Variants across Posts.

- **Image Search** — Feature that takes a text-only product name and searches for matching images from the web. The user selects and attaches the right images to create a Product or Product Variant.

- **Target** — A WhatsApp destination for Campaign Posts. Can be a WhatsApp group or an individual phone number. Imported via CSV, entered manually (one per line or separated by comma/pipe/dot), or synced from a WhatsApp instance. A Campaign targets one Target List containing multiple Targets.

- **Target List** — A named collection of Targets (groups and/or individual numbers) used by a Campaign. Reusable across Campaigns. Example: "Fashion Groups Q2 2026".

- **Contact Number** — A WhatsApp phone number embedded into `https://wa.me/...` prefilled links so customers can message to place orders. An Organization can have multiple Contact Numbers. A Contact Number's phone number can also be used by a WA Poster.

- **Anti-Detection Configuration** — A set of independently activable/deactivable safety constraints per Campaign designed to avoid WhatsApp spam detection. Includes: max posts per hour, minimum/maximum delay between dispatches, randomization range, number of WA Posters to rotate, and cooldown duration before the same Product can reappear in the same Target. Multi-language UI.

- **Supplier** — A tracked entity that supplies products. One Product can have multiple Suppliers. Suppliers send price lists and media (e.g., via WhatsApp ZIP files).

- **Raw Import** — Unprocessed product data from an external source (CSV, Shopify, website, WhatsApp ZIP) that needs review before becoming Products.

- **Column Mapping** — The UI step where users match CSV columns to Product fields (name, selling price, cost price, etc.). If column data needs transformation, the system suggests an Import Formula.

- **Import Formula** — A suggested data transformation for a CSV column (e.g., "multiply column B by 1.2", "remove currency symbol", "split text at comma"). The user previews the result before accepting. Applies during Column Mapping.

- **Extract** — A raw WhatsApp message item pulled from a ZIP Raw Import. Contains media and/or caption text as-is from the supplier's WhatsApp discussion feed. The system automatically pairs each message with its corresponding media file for visual review. Irrelevant Extracts are discarded during review.

- **Candidate** — An Extract kept after filtering, ready for review and promotion to a Product. Users verify data correctness, check images display properly, and can set Candidates to a pending-approval state before they become usable in the system. The review UI highlights probabilistically identified fields (from Parsing Rules) and offers an AI toggle for deeper extraction. AI is invoked only when rule-based Parsing Rules fail.

- **Parsing Rule** — A per-Supplier configuration of regex patterns or extraction rules applied to Extracts to automatically identify product fields (name, price, currency, description). Applied before any AI. AI is used only when non-AI techniques fail, to minimize cost.

- **Action Log** — An immutable record of every action in the system — human and system. Includes every message sent, every Campaign edit, every Dispatch status change, every import, every user login, and every AI interaction. For human actions: who performed it, what was changed, why (user-provided reason), and when. Stores language-agnostic action codes (e.g., `dispatch_marked_done`, `campaign_paused`), never raw text — the display layer renders each code in the viewer's language. Serves dual purpose: (1) feeds the AI learning loop so it learns data processing rules from human corrections, (2) enables Human Poster performance tracking — comparing posting speed, missed Dispatches, and on-time rate across Human Posters for reward purposes.

- **Language** — The Organization defines a default language. Each User can override it with their own preferred language. All system text (UI, notifications, Action Log display, Human Poster prompts) renders in the viewer's language. User data (product descriptions, captions, template text, campaign names) is stored as-is — never auto-translated. Supports currency formats, date formats, number formats, and RTL per language.

- **Wave** — A full pass of all Posts in a Campaign dispatched across all Targets. Example: a Campaign with 5 Posts and 20 Targets = 100 dispatches per Wave. Target order can be randomized per Wave to avoid pattern detection.

- **Dispatch** — A single instance of a Post being sent to one Target. A Campaign with P Posts and T Targets generates P × T Dispatches per Wave. Each Dispatch has its own scheduled time, WA Poster assignment, and resolved Product Variant. Statuses: pending, in_progress, done (manual), sent (automated), failed, delayed, missed.

- **AI Message Rewrite** — When targeting individual numbers (not groups), the AI can rewrite Post captions per recipient to avoid sending identical messages. Controlled per Campaign — togglable. Uses Action Log data to improve personalization quality over time.

- **AI Configuration** — Each AI feature is independently toggleable: AI Post Suggestions, AI Message Rewrite, and AI Import Parsing. The AI learns passively from the Action Log even when features are toggled off — every human correction feeds the learning loop. The AI adapts immediately within a Campaign when the user gives feedback. Supports configurable provider per Organization: built-in Vertex AI, a global SaaS API key, or Bring Your Own Key (BYOK). Tracks token consumption, model used, and cost per Organization.

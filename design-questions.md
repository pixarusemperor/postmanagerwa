# Design Questions — 5 Options Each

---

## Q1. Does the system decide what gets posted, or does the user define campaigns and the system just schedules?

### Option A: User-defined campaigns, system schedules
The user creates Campaigns manually (select products, write captions, choose targets). The system generates a schedule and tells the user when to post. No automation of content decisions.

**Trade-off:** Full user control, but no time saved on content decisions.

### Option B: Auto-pool mode
The system maintains a pool of approved Products. The user sets rules (e.g., "post 3 products per day, never repeat the same product within 7 days"). The system picks products from the pool, applies a Caption Template, and schedules them automatically.

**Trade-off:** Heavy time savings, but less control over exactly what gets posted when.

### Option C: Hybrid — user curates, system fills gaps
The user manually creates "anchor" Posts for a Campaign and positions them. The system fills the gaps between them with auto-selected Products from a pool, using default templates.

**Trade-off:** Balance of control and automation. Complexity in the gap-filling logic.

### Option D: Supplier-feed driven
Posts are generated directly from Supplier Raw Imports. As new products arrive from suppliers, the system auto-generates draft Posts. The user reviews and approves or discards. No manual campaign creation — the feed drives the pipeline.

**Trade-off:** Great for high-volume resellers receiving daily supplier feeds. Loses curated campaign feel.

### Option E: Full editorial calendar
A calendar view where the user drags Products into time slots. The system handles only formatting (applying templates, generating WhatsApp links) and reminders. Posts are 100% manually placed by the user.

**Trade-off:** Maximum control. Feels like a content calendar tool. Least automation.

---

## Q2. Who is the primary user?

### Option A: Solo entrepreneur
One person, one brand, one WhatsApp number. No team. No multi-organization. Simple single-tenant: login → your products → your campaigns → post.

**Trade-off:** Simplest to build. No multi-tenancy. Hits a ceiling fast if the user grows.

### Option B: Solo entrepreneur with multiple side businesses
One Account managing 2-5 small businesses (Organizations). Different product catalogs, different Contact Numbers, different WhatsApp groups per business. No team members — all managed solo.

**Trade-off:** Multi-tenancy justified but lightweight. No permission system needed.

### Option C: Small marketing team (2-10 people)
One Organization with multiple Users. Roles: Admin (full access), Campaign Manager (create/approve campaigns), Product Manager (import/manage products). Team collaboration on campaigns.

**Trade-off:** Requires auth, roles, audit trail. Most realistic for a SaaS.

### Option D: Agency model
One Account manages multiple client Organizations. Each client Organization has its own products, campaigns, and targets. Agency staff are added as Users to each client Organization. Billing per Organization.

**Trade-off:** Most complex multi-tenancy. Requires Organization-level billing, member management, and clear boundaries between client data.

### Option E: Enterprise franchise
A parent Organization with sub-Organizations (franchise locations). Some products are shared across sub-Organizations (global catalog), others are local. Campaigns can be pushed from parent to children.

**Trade-off:** Most powerful but most complex. Shared vs. local product catalogs, campaign inheritance, hierarchical permissions.

---

## Q3. What does the system do with raw supplier data?

### Option A: Store and display only
Supplier data (ZIP messages, price lists) is imported and shown to the user chronologically. The user manually reads each one, extracts product info themselves, and creates Products one by one. The system is a viewer, not a processor.

**Trade-off:** Simple to build. Very little automation. User does all the thinking.

### Option B: Extract with AI parsing
The system uses an LLM to parse each Extract from supplier WhatsApp chats and CSV rows. It extracts: product name, price, currency, description, and media. The user reviews the AI output and confirms or corrects before creating the Product.

**Trade-off:** High value but AI dependency (cost, reliability, occasional hallucinations). The review step is critical.

### Option C: Template-based parsing
The user defines parsing rules per Supplier (e.g., "price always follows 'Prix:' on the same line", "first image is always the product photo"). The system applies these rules to extract structured data from Extracts. No AI needed.

**Trade-off:** Deterministic and cheap. Fragile — supplier formats change, rules break. Maintenance burden.

### Option D: Supplier self-service portal
Suppliers get limited access to upload products directly in a structured format (CSV, form). No parsing needed. The WhatsApp ZIP flow still exists as a fallback for suppliers who only send chat messages.

**Trade-off:** Shifts work to suppliers. Requires supplier onboarding. Not all suppliers will comply.

### Option E: Human-in-the-loop with smart suggestions
The system displays each Extract visually: the image, the raw caption text, and suggested parsed fields (simple regex extraction). The user fills in or corrects fields inline. Over time, the system learns from corrections (simple pattern matching, no AI).

**Trade-off:** Pragmatic middle ground. Saves time vs. completely manual. No AI cost. Learning requires usage data.

---

## Q4. What does the user see on the dashboard after login?

### Option A: Today's posting queue
A list of Posts scheduled for today, in order. Each shows the media thumbnail, caption preview, target group, and scheduled time. Action buttons: "Mark as Done" (manual copy-paste flow) or a status indicator (for automated sending). With a "Copy caption" and "Download media" button per Post.

**Trade-off:** Task-oriented. Good for manual users. If there are no posts today, the dashboard is empty — feels dead.

### Option B: Pipeline overview
Shows four columns: Supplier Feed (Raw Imports), Products (catalog), Campaigns (active), and Today's Posts. Counts and quick actions per column. A bird's eye view of the whole system state.

**Trade-off:** Product-manager style. Shows everything at once. Might overwhelm a simple user.

### Option C: Campaign calendar
A week/month calendar view showing which Campaigns have Posts on which days. Color-coded by Campaign. Click a day to see the Posts. Drag to reschedule. Visual and time-oriented.

**Trade-off:** Best for campaign planning. Less useful if most days have no posts. Requires consistent usage to feel full.

### Option D: Inbox-style feed
A chronological activity feed: "New supplier ZIP from Supplier X (12 extracts)", "Campaign 'Summer Sale' completed — 45 posts sent", "Product Y imported from CSV". The feed is the homepage, and actions branch from it.

**Trade-off:** Great for staying informed. Action-oriented (click into each event). Can feel noisy if there are many events.

### Option E: Quick-launch hub
Minimal dashboard with large action tiles: "Import Products" (CSV/ZIP/Manual), "Create Campaign", "View Today's Posts", "Manage Products". Designed for rapid action entry, not monitoring. Power users who know what they want to do.

**Trade-off:** Fastest to act. No situational awareness — the user must know what needs doing.

---

## Q5. How many Posts per day? What's the volume?

### Option A: Low volume, curated (1-5 posts/day)
A small business posting a few carefully crafted products. Each Post has unique captions, selected media, and manual scheduling. Quality over quantity.

**Trade-off:** The system is a scheduling aid and message composer. Very manual. No need for complex scheduling logic.

### Option B: Medium volume, consistent (10-30 posts/day)
A reseller with 50-200 products rotating on a schedule. Multiple Campaigns to different groups. Mix of automated and manual content. Reasonable send rate for WhatsApp (anti-spam limits respected).

**Trade-off:** Needs a real scheduler with rate limiting, delay randomization. Templates become essential.

### Option C: High volume, firehose (50-200+ posts/day)
A high-frequency reseller blasting products to dozens of groups. Products cycle frequently. Speed and throughput matter. The system must handle queuing, retries, and session management across multiple WhatsApp instances.

**Trade-off:** Requires multiple WhatsApp instances (one number per 50-100 groups to avoid bans). Complex scheduling with anti-spam delays. Scale challenges.

### Option D: Event-driven (bursts)
10-50 posts per Campaign, but Campaigns are infrequent (weekly drops, flash sales). When a Campaign runs, it fires rapidly (with delays). Between campaigns, nothing. Peak load matters more than average.

**Trade-off:** Uneven load. Idle most of the time, then bursts. Scheduler must handle spikes gracefully.

### Option E: Always-on drip
Continuous low-rate posting (1-3 posts/hour, 24/7). Products trickle out to maintain constant presence. No concept of a "campaign" — just a perpetual scheduled stream.

**Trade-off:** Simplest scheduler (constant interval or randomized). Feels less like marketing, more like a product display channel. Less urgency/event-dynamic.

---

## Q6. Are Products posted once or repeatedly over time?

### Option A: One-shot posting
Each Product gets posted exactly once per Campaign. After posting, it's "consumed" for that Campaign. A Product can be used in multiple Campaigns, but each usage is a one-shot.

**Trade-off:** Simple tracking. Products have a finite lifespan in marketing. The user must intentionally re-add a product to a new campaign if they want to repost it.

### Option B: Rotating catalog with cooldown
Products belong to a reusable pool. The system posts from the pool on a schedule, but enforces a cooldown (e.g., "same product can't be posted to the same group within 7 days"). Products cycle perpetually.

**Trade-off:** Products stay alive. System must track post history per product per target. Good for evergreen products.

### Option C: Campaign lifecycle
Products are "added to campaign" and posted once during that campaign. After the campaign ends, products return to the available pool. The user can exclude products from future campaigns manually. Campaigns are discrete marketing pushes.

**Trade-off:** Maps to real marketing thinking. Products have campaign context. Requires explicit campaign lifecycle management.

### Option D: Stock-depletion based
Products have a stock count. They can be posted repeatedly until stock hits zero, then they're automatically deactivated. The user can replenish stock to reactivate. Stock is the gating factor, not a schedule.

**Trade-off:** Tight integration with inventory. Requires stock management features. Mirrors real reseller behavior (post until sold out).

### Option E: Time-window based
Products are active for a defined time window (e.g., "this week's deal"). During the window, they can be posted any number of times. After the window, they're archived. Mix of campaign lifecycle and availability.

**Trade-off:** Good for limited-time offers. Requires scheduling both the product availability window and the posting schedule within it.

---

## Q7. Does the system track what happens after a customer clicks the WhatsApp link?

### Option A: No tracking
The system generates the `wa.me` link. What happens after the customer clicks it is completely outside PostManagerwa. No stock updates, no order tracking, no analytics.

**Trade-off:** Simplest. No integration needed. User manages orders in WhatsApp manually. The system is purely a posting tool.

### Option B: Link click tracking
The system generates a unique tracking link per Post that redirects to the `wa.me` link. Tracks how many times each Product's WhatsApp link was clicked. Provides analytics: "most clicked products", "engagement per campaign".

**Trade-off:** Needs URL shortener/redirector infrastructure. Adds value without deep WhatsApp integration. Privacy consideration — users may dislike click tracking on WhatsApp links.

### Option C: Stock auto-update on interest
When a link is clicked, the system decrements a "reserved stock" counter (optional). The user can review and confirm the actual sale manually. Acts as a lead indicator, not a source of truth.

**Trade-off:** Lightweight stock management. Not real inventory — just a signal. Helps the user gauge interest without requiring order tracking.

### Option D: Full WhatsApp chatbot integration
PostManagerwa integrates with a WhatsApp chatbot (like WassFlow) that handles inbound messages. When a customer clicks the link, the chatbot captures: which product they're asking about, their number, and the order details. This data flows back into PostManagerwa — updates stock, creates an Order entity.

**Trade-off:** Most powerful. Requires a running WhatsApp chatbot backend. Closes the loop between posting and ordering. Scope expansion — now you're building a lightweight order management system.

### Option E: Manual stock adjustment after sale
The system doesn't track anything automatically, but provides a "Quick stock adjust" button on each Product in the dashboard. When the user sells an item via WhatsApp, they manually decrement the stock with one click. No integration. Just a convenient UI.

**Trade-off:** Very simple. Fits manual workflow. User must remember to adjust stock. No analytics or tracking.

---

## Q8. Is manual copy-paste the primary launch method, with automated posting as a future add-on?

### Option A: Manual-first, API later
Launch supports only the manual flow: the user copies the caption, downloads media in order, and posts manually to WhatsApp from phone or desktop. Automated posting via API is designed in the architecture from day one (provider interface) but implemented in a later version.

**Trade-off:** Fastest path to working product. Validates the core value (organizing posts) before tackling WhatsApp API complexity. Manual flow must be excellent UX.

### Option B: Both from day one
Manual flow AND API integration are built together. The user picks per Campaign: "Manual" or "Automated" (via WassFlow/WatsSender). The provider interface abstracts both.

**Trade-off:** Bigger initial build. But full value proposition from launch. Appeals to both solo users (manual) and power users (automated).

### Option C: API-first, manual as fallback
Automated posting is the primary experience. Manual flow exists only as an emergency fallback ("API down? Download and post manually"). The UX is optimized for automation.

**Trade-off:** Best for sophisticated users who already have an API. Manual UX is an afterthought. Limits the initial user base to those with WhatsApp API access.

### Option D: Export-only — no built-in posting
The system never posts or copies. It generates an "Export Package" for each scheduled Post: a ZIP with media files in order + a text file with captions + WhatsApp links. The user downloads and handles posting themselves in whatever tool they prefer.

**Trade-off:** Pure organizational value. No dependency on any WhatsApp integration. Users must bring their own posting method. Cleanest separation of concerns.

### Option E: Provider marketplace model
PostManagerwa ships with the manual flow built-in. Automated posting is a plug-in marketplace — users connect their own WhatsApp API provider (WassFlow, WATI, Twilio, etc.) via an adapter they configure themselves. First-party support for WassFlow, third-party adapters can be community-built.

**Trade-off:** Platform play. Complex to get right. Overkill for an MVP. But most extensible in the long run.

---

## Q9. What's the biggest pain point this software solves?

### Option A: "I forget what to post and when"
The mental load of keeping a posting schedule in your head. You have products to sell but no system to track what was posted when, to which group, and what to post next. PostManagerwa is the external brain — you open it, it tells you exactly what to do today.

**Trade-off:** Focuses on scheduling and task management. Content is user-created. The value is in organization, not creation.

### Option B: "Composing captions is tedious and error-prone"
You spend too much time writing the same kind of captions over and over: product name, price, discount calculation, WhatsApp link. PostManagerwa automates this with Caption Templates and variable interpolation — one template, 200 products, done.

**Trade-off:** Focuses on message composition efficiency. The value is template-driven automation. Less about scheduling, more about formatting.

### Option C: "Supplier data is chaos"
You receive WhatsApp messages, ZIP files, spreadsheets from suppliers — all in different formats. Turning that mess into organized, postable products takes hours. PostManagerwa is the import pipeline that structures the chaos.

**Trade-off:** Focuses on data ingestion/transformation. The value is turning raw supplier output into marketing-ready products. If suppliers send structured data already, this pain point doesn't exist.

### Option D: "I waste time juggling between tools"
You download images from one place, write captions in a note, calculate discounts in a spreadsheet, generate WhatsApp links manually, and post from your phone. PostManagerwa unifies everything in one place — a single workflow from product to post.

**Trade-off:** Focuses on workflow consolidation. The value is integration, not any single feature. Hard to explain in a tagline, but the sum is greater than the parts.

### Option E: "I can't scale my WhatsApp marketing"
You can handle 5 products manually, but not 200. You want to post to 20 groups, not 2. You want to run multiple campaigns simultaneously. The manual method breaks at scale. PostManagerwa is the scaling engine — same effort whether you have 10 products or 1,000.

**Trade-off:** Focuses on throughput and scale. Assumes you already have volume and the manual method is the bottleneck. Less valuable for a very small operation.

---

## Q10. One-sentence description — complete the sentence

PostManagerwa is a tool that takes **X** and turns it into **Y** so that **Z**.

### Option A
Takes **raw product data from suppliers** and turns it into **scheduled, ready-to-post WhatsApp campaigns** so that **you never think about what to post next — you just follow the schedule.**

### Option B
Takes **your product catalog and caption templates** and turns it into **a daily posting agenda with copy-to-clipboard content and prepared media** so that **you spend 5 minutes a day on WhatsApp marketing, not 2 hours.**

### Option C
Takes **chaotic supplier feeds and price lists** and turns it into **organized, formattable, reusable post-ready content** so that **your only job is to review and approve.**

### Option D
Takes **products you want to sell** and turns it into **a systematized, repeatable posting machine** so that **your WhatsApp marketing runs on autopilot — manual or automated.**

### Option E
Takes **the entire marketing workflow — product curation, caption writing, link generation, scheduling, and posting** — and turns it into **one unified workspace** so that **you stop juggling tools and start actually selling.**

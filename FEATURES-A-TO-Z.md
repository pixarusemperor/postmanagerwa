# PostManagerwa — Complete Feature Audit & Implementation Plan

## Executive Summary

**Critical Gap:** Campaign creation does NOT generate dispatches. The campaign builder creates the blueprint (products + target list + template) but never expands targets into individual dispatch rows. The poster queue queries `pm.dispatches` but nothing writes to it. **The core workflow is broken — campaigns exist in a vacuum.**

**Missing Features:** 3 critical features the user explicitly requested that do not exist anywhere:
1. **Prefilled WhatsApp Message Templates** — DB table exists (`pm.prefilled_message_templates`), zero UI
2. **Contact Numbers** — DB table exists (`pm.contact_numbers`), zero UI. These are the sender numbers for `wa.me` links.
3. **wa.me link generation** — Poster page uses target's JID, but design docs specify wa.me links should use **Contact Numbers** as the sender + **Prefilled Message Templates** for the message body.

---

## Feature #1: Dispatch Generation Engine

### User Story
As a user, when I create a campaign, I expect the system to generate individual posting tasks (dispatches) that appear in my poster queue so I know exactly what to post, to whom, and when.

### Current State
- Campaign builder creates campaign table row ✅
- Campaign builder links target list via `campaign_target_lists` ✅
- Campaign builder creates `posts` (frozen product snapshots) ✅
- **Dispatch generation: NOT IMPLEMENTED** ❌

### Required Behavior
When a campaign is created, the system must:
1. Read the linked `target_list_id` from `campaign_target_lists`
2. SELECT all targets from `pm.targets WHERE target_list_id = X`
3. SELECT all posts from `pm.posts WHERE campaign_id = Y` in order of `position`
4. For each Post × Target combination: INSERT one row into `pm.dispatches` with:
   - `organization_id` = campaign's org
   - `campaign_id` = campaign ID
   - `post_id` = post ID
   - `target_id` = target ID
   - `scheduled_at` = calculated from campaign `scheduled_start_at` + post position offset
   - `resolved_caption` = post's `caption_override`
   - `status` = `'pending'`
5. Update campaign status from `'draft'` to `'scheduled'`

### Implementation
- **New API route:** `src/app/api/pm/campaigns/[id]/generate-dispatches/route.ts`
- **Call from:** campaign builder after creation succeeds
- **Schedule calculation:** Each post gets `scheduled_start_at + (position * 300 seconds)`. For manual posting, this means tasks are spaced 5 minutes apart.

---

## Feature #2: Contact Numbers Management

### User Story
As a user, I need to register my WhatsApp business numbers (the numbers I send FROM) so the system can embed them into `wa.me/` links. Each of my organizations may use different phone numbers.

### Domain Context (from CONTEXT.md)
> **Contact Number** — A WhatsApp phone number embedded into `https://wa.me/...` prefilled links so customers can message to place orders. An Organization can have multiple Contact Numbers. A Contact Number's phone number can also be used by a WA Poster.

### Current Schema
```sql
CREATE TABLE pm.contact_numbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id),
    phone_number text NOT NULL,
    country_code text NOT NULL,
    label text,
    is_also_wa_poster boolean DEFAULT false,
    wa_poster_id uuid REFERENCES pm.wa_posters(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
```

### Required UI
A new page at `/contacts` accessible from the sidebar in the "Settings" group.

**List view:**
- Show all contact numbers for the current org
- Each card shows: label, formatted phone number, country code, creation date
- "Add Contact Number" button

**Add/Edit form:**
- Country code (text input, e.g. `237`, `33`)
- Phone number (text input, e.g. `691234567`)
- Label (optional, e.g. "Main Sales Line", "Support")
- "Use as WA Poster" checkbox (not functional yet, placeholder)

**wa.me link preview:**
- Show live preview: `https://wa.me/{country_code}{phone_number}?text=Hello`
- This shows users exactly what customers will see

### Sidebar Addition
Add "Contacts" link to the Settings group in `dashboard-layout.tsx`.

---

## Feature #3: Prefilled WhatsApp Message Templates

### User Story
As a user, I want to create reusable templates for the prefilled WhatsApp message that appears in `wa.me` links, so customers see a professional, product-specific opening message when they click to order.

### Domain Context (from CONTEXT.md)
> **Prefilled Message Template** — Defines the structure of the prefilled message embedded in a WhatsApp link (`https://wa.me/...`). Supports variables like `{{Product Name}}`, `{{Product Code}}`, and `{{Selling Price}}` that resolve per Product. Exportable for use in chatbot/automation builders to enable keyword/regex-based auto-reply routing.

### User's Design Decisions (from response Q7):
> we will keep native wa.me link to avoid friction because with native wa.me link, the sending process is faster because the customer are not redirected out of whatsapp before it comes back ... we will keep it simple ... the prefilled message structure must be exportable to use in the chatbot builder or automation builder to make the creation of automated reply based on specific product easier.

### Current Schema
```sql
CREATE TABLE pm.prefilled_message_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES pm.organizations(id),
    name text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Required UI
Extend the existing `/templates` page with a second tab/section for "Prefilled Message Templates" alongside "Caption Templates".

**Tab 1: Caption Templates** (already built ✅)
- CRUD for `pm.caption_templates`
- Variables: `{{Product Name}}`, `{{Selling Price}}`, etc.
- Live preview with sample data

**Tab 2: Prefilled Message Templates** (NEW — needs building)
- CRUD for `pm.prefilled_message_templates`
- Variables: `{{Product Name}}`, `{{Product Code}}`, `{{Selling Price}}`, `{{Currency}}`
- Live preview: shows the resolved message text
- wa.me link preview: `https://wa.me/{country_code}{phone_number}?text={resolved_message}`
- Export button: copy the raw template body for use in chatbot builders

### How Templates Flow Into wa.me Links

**Full wa.me link construction:**
```
https://wa.me/{contact_number.country_code}{contact_number.phone_number}?text={url_encoded_resolved_prefilled_message}
```

**Resolution chain:**
1. Campaign has a `prefilled_message_template_id` (or default org-level template)
2. Each post resolves template variables using the frozen snapshot data
3. Each dispatch concatenates: `wa.me base` + `contact number` + `resolved message body`

---

## Feature #4: wa.me Link Generation — Complete Flow

### User Story
As a manual poster, when I open a dispatch in my poster queue, I want to tap a WhatsApp link that opens directly to the right contact number with a prefilled message containing the product name, code, and price — so my customer sees immediately "I want to order [Product Name] ([Product Code]) at [Price]".

### How It Works Today (broken)
```typescript
// poster/page.tsx — current code
const waLink = jid.includes('@') ? '#' : `https://wa.me/${jid.replace(/[^0-9]/g, '')}`;
```
This uses the **recipient's JID** as the phone number. It doesn't use Contact Numbers at all. No prefilled message is appended.

### How It Must Work
```
wa.me link = base URL + contact number + ?text= + url_encoded(prefilled message with resolved variables)
```

**Example:**
```
https://wa.me/237691234567?text=Salut%20je%20veux%20commander%20IP15PRO%20(iPhone%2015%20Pro)%20%C3%A0%20150000%20XOF
```

Which decodes to:
```
Salut je veux commander IP15PRO (iPhone 15 Pro) à 150000 XOF
```

### Required Changes

**poster/page.tsx updates:**
1. Fetch the organization's contact numbers
2. Let user select which contact number to use for sending (default: first one)
3. Fetch the campaign's prefilled message template (or use org default)
4. Resolve the template variables using the dispatch's post snapshot
5. Build the complete wa.me URL:
   ```
   https://wa.me/{country_code}{phone_number}?text={encodeURIComponent(resolved_message)}
   ```
6. Show the link as a tappable button

**Contact number selector:**
- Dropdown at top of poster queue page
- Shows all org contact numbers
- Selection persists in session storage

**Prefilled template resolution:**
- If the campaign has a `prefilled_message_template_id`, use it
- Otherwise, use a default template: `Salut je veux commander {{Product Code}} ({{Product Name}}) à {{Selling Price}} {{Currency}}`
- Template variables are resolved per dispatch using the post's frozen snapshot

---

## Feature #5: Sidebar Navigation Completion

### Current State
- Main group: Products, Campaigns, Templates, Targets, Imports, Poster Queue — all functional
- WhatsApp group: 4 stubs
- Settings group: Discounts stub, AI Config stub, Settings stub

### What's Missing From Sidebar
- **Contact Numbers** — links to the new `/contacts` page
- **Wa.me Link Templates** — links to `/templates?tab=prefilled` tab
- The design doc says prefilled templates should be exportable for chatbot/automation use

### Sidebar Update
```typescript
{
  label: 'Settings',
  items: [
    { href: '/contacts', label: 'Contacts', icon: Phone },
    { href: '/settings/discounts', label: 'Discounts', icon: Tag },
    { href: '/settings/ai', label: 'AI Config', icon: Brain },
    { href: '/settings', label: 'Settings', icon: Settings },
  ],
}
```

---

## Complete User Flow (A → Z)

### Phase 1: Setup (one-time per org)
```
1. Create account → auto-creates organization
2. Navigate to /contacts → add WhatsApp numbers (the numbers you send FROM)
3. Navigate to /templates → create caption templates (what goes in the post body)
4. Navigate to /templates → create prefilled message templates (what goes in wa.me links)
```

### Phase 2: Product Management (ongoing)
```
5. Navigate to /products → "Add Product"
6. Fill form: name, prices, currency, stock
7. Upload product images (from phone camera roll or desktop)
8. Product appears in list with thumbnail
9. Click product to view detail panel with all images
```

### Phase 3: Campaign Creation (per campaign)
```
10. Navigate to /targets → create target list
11. Add targets: WhatsApp groups (by JID) and individual numbers
12. Import via CSV if bulk
13. Navigate to /campaigns → "New Campaign"
14. Name the campaign, set start date, select post mode (manual)
15. Click "Add products" → search → multi-select → reorder by drag/arrows
16. Select target list from dropdown
17. Select caption template (optional)
18. Click "Create Campaign" → system generates dispatches → redirects to poster queue
```

### Phase 4: Daily Posting (the core workflow)
```
19. Navigate to /poster → see today's dispatch queue
20. Each dispatch shows: product image, resolved caption, target name, scheduled time
21. Tap "Copy" to copy caption to clipboard
22. Tap wa.me link → opens WhatsApp with prefilled message
23. Open WhatsApp → paste caption → attach product image → send
24. Back in PostManagerwa → tap "Mark Done"
25. Dispatch disappears, action logged
26. Next dispatch appears, repeat
```

### Phase 5: Performance & Archive (future)
```
27. Action log tracks: who posted what, when, to whom
28. Performance dashboard: compare human posters
29. Archive: search past dispatches by campaign, date, product
```

---

## Implementation Order

| # | Feature | Files | Priority |
|---|---|---|---|
| 1 | **Dispatch Generation Engine** — the missing link between campaigns and poster queue | `api/pm/campaigns/[id]/generate-dispatches/route.ts` + update `campaigns/page.tsx` | 🔴 P0 |
| 2 | **Contact Numbers Page** — CRUD, sidebar link, wa.me preview | `contacts/page.tsx` + `dashboard-layout.tsx` | 🔴 P0 |
| 3 | **Prefilled Message Templates** — add tab to `/templates` page | `templates/page.tsx` | 🔴 P0 |
| 4 | **wa.me Link Generation** — fix poster queue to use contacts + prefilled templates | `poster/page.tsx` | 🔴 P0 |
| 5 | **Campaign → Prefilled Template Link** — add `prefilled_message_template_id` to campaign creation | `campaigns/page.tsx` | 🟡 P1 |
| 6 | **wa.me Link Template Export** — export button on prefilled templates | `templates/page.tsx` | 🟢 P2 |
| 7 | **Working Hours** — human poster availability definition | New page | 🟢 P2 |
| 8 | **Performance Tracking** — human poster stats from action logs | New page | 🟢 P2 |

---

## Files to Create/Modify in This Session

| File | Action | What |
|------|--------|-----|
| `src/app/api/pm/campaigns/[id]/generate-dispatches/route.ts` | CREATE | POST endpoint: reads campaign, targets, posts → inserts dispatches |
| `src/app/(dashboard)/campaigns/page.tsx` | MODIFY | Call dispatch generation API after campaign creation, add prefilled template selector, redirect to poster queue |
| `src/app/(dashboard)/contacts/page.tsx` | CREATE | Contact numbers CRUD with wa.me link preview |
| `src/components/dashboard/dashboard-layout.tsx` | MODIFY | Add "Contacts" to sidebar |
| `src/app/(dashboard)/templates/page.tsx` | MODIFY | Add tab for prefilled message templates + export button |
| `src/app/(dashboard)/poster/page.tsx` | MODIFY | Contact number selector, prefilled template resolution, proper wa.me links |

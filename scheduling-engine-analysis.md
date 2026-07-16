# Scheduling Engine Analysis

## WassFlow's Campaign Engine — What It Does

WassFlow's `campaign-engine.ts` is a **single-tenant, API-only dispatcher**:

1. `engineTick()` — runs on a cron timer, finds the oldest pending campaign event whose `scheduled_at` has passed, locks it (optimistic concurrency), loads the product + group JID, and inserts into `wf_send_queue`.
2. `queueTick()` — processes pending queue items one at a time, serialized per session, with a 5-second minimum gap between sends per session. Calls WatsSender API.
3. `campaign-scheduler.ts` — generates campaign events from products × groups with randomized delays. Two modes: Broadcast (one product → all groups, then next product) and Bulk Distribution (stub, not fully implemented). No concept of working hours, no Sender Number rotation, no anti-detection beyond a simple delay range.

### What WassFlow's engine does NOT have:

| Missing | Needed by PostManagerwa |
|---|---|
| Working hours / Human Poster availability | Human Posters define when they work. No dispatches scheduled outside hours. |
| Sender Number rotation | Multiple WA Posters (Sender Numbers), load-balanced, rotated to avoid detection. |
| Anti-Detection constraints | Max posts/hour, cooldown per product per target, randomization jitter. |
| Manual posting mode | Human Poster marks "Done" — system tracks actual vs. scheduled time. |
| Dynamic rescheduling | If a Human Poster is late, upcoming dispatches shift forward. |
| Product Variant rotation | Same product, different media/caption each appearance. |
| Action Log integration | Every schedule adjustment logged for AI learning. |
| Multi-tenant isolation | All events scoped to Organization. |

---

## Proposed PostManagerwa Scheduling Engine Design

### Core Loop

```
1. Scheduler runs every 60 seconds
2. For each active Campaign:
   a. Check current time against Human Poster working hours
   b. If outside hours → skip
   c. Find next pending Dispatch whose scheduled_at ≤ now
      (Dispatch = Post × Target pair. All Posts → all Targets per Wave)
   d. Check Anti-Detection constraints:
      - Max posts this hour not exceeded for this WA Poster (Sender Number)
      - Cooldown on this Product × this Target not violated
   e. If constraints pass → select least-busy WA Poster (Sender Number)
   f. Resolve Product Variant (cycle to next unused variant)
   g. If targeting individual numbers and AI Rewrite enabled → rewrite caption per recipient
   h. Resolve Caption Template + Prefilled Message Template variables
   i. If automated → dispatch via WA Poster (PostingProvider)
   j. If manual → mark Dispatch status as "pending_manual", notify Human Poster
   k. Log action to Action Log
3. Human Poster workflow:
   a. Human Poster sees today's dispatch queue → marks Dispatches as "done" after posting
   b. If late → system asks reason, logs it, recalculates remaining schedule
   c. If Human Poster misses a dispatch entirely → flagged, next dispatch times adjusted
4. Per Wave: Target order can be randomized (toggle per Campaign) to avoid pattern detection
5. Forward optimization (manual mode):
   - WhatsApp allows forwarding to 5 recipients at once
   - System can suggest grouping: send to Target 1, then forward to Targets 2-6, etc.
   - Togglable per Campaign; disabled at high volumes to avoid ban risk
```

### New Entities for the Scheduling Engine

| Entity | Purpose |
|---|---|
| **Target List** | Named collection of Targets (groups + individual numbers). Imported via CSV or manual entry. Reusable across Campaigns. |
| **Dispatch** | A single Post × Target pair. A Campaign with P Posts and T Targets generates P × T Dispatches per Wave. Each Dispatch has its own resolved time, WA Poster assignment, Product Variant, and status. |
| **Wave** | One full pass of all Dispatches. Post order is fixed; Target order can be randomized per Wave. |
| **Human Poster Working Hour** | Day-of-week + time range when a Human Poster is available. Per User. |
| **Human Poster Assignment** | Which Human Poster is responsible for which Campaign's manual Dispatches. |
| **WA Poster Load** | Running counter of how many Dispatches each WA Poster has sent in the current hour. Reset hourly. |

### Anti-Detection Constraint Model (per Campaign)

| Constraint | Type | Default | Can be disabled |
|---|---|---|---|
| `max_posts_per_hour` | Per WA Poster | 10 | Yes |
| `min_delay_seconds` | Between any two Dispatches | 60 | Yes |
| `max_delay_seconds` | Between any two Dispatches | 300 | Yes |
| `randomization_jitter_seconds` | Random ±N added to each delay | 30 | Yes |
| `wa_poster_rotation_count` | How many WA Posters to use | 1 | Yes (1 = no rotation) |
| `product_target_cooldown_hours` | Hours before same Product can Dispatch to same Target again | 24 | Yes |
| `variant_cycle_strategy` | "sequential" or "random" for Product Variant selection | "sequential" | N/A |
| `randomize_target_order_per_wave` | Shuffle Target order each Wave | false | Yes |
| `ai_rewrite_per_recipient` | AI rewrites captions for individual number Targets | false | Yes |
| `forward_grouping` | Group Dispatches by 5 for WhatsApp forward optimization (manual mode) | false | Yes (disabled at high volume)

### Manual vs. Automated Flows

```
                    ┌─────────────────────────┐
                    │  Dispatch is scheduled    │
                    │  (Post × Target pair)     │
                    └─────────┬───────────────┘
                              │
                    ┌─────────▼───────────────┐
                    │ Campaign.post_mode?     │
                    └──┬───────────────────┬──┘
                       │                   │
              "manual" │                   │ "automated"
                       │                   │
   ┌───────────────────▼──┐    ┌───────────▼──────────────┐
   │ Human Poster queue    │    │ WA Poster (Posting      │
   │ "Mark as Done"        │    │ Provider) sends via API │
   │ (optionally: forward  │    │ (WatsSender, etc.)      │
   │  to 5 at a time)      │    └───────────┬──────────────┘
   └───────────┬───────────┘                │
               │                   ┌────────▼──────────┐
   ┌───────────▼───────────┐       │ Status: sent/failed│
   │ Status: done          │       │ actual_sent_at      │
   │ actual_sent_at        │       │ retry if failed     │
   └───────────────────────┘       └─────────────────────┘

   Both paths log to Action Log.
   Both update WA Poster load counter.
   Both update Product → Target cooldown.
```

### Dynamic Rescheduling (Human Poster Late / Miss)

When a Human Poster doesn't mark a Dispatch as done by `scheduled_at + grace_period`:

1. Dispatch status → `delayed`
2. System prompts Human Poster: "You're late on {Dispatch}. Reason?"
3. Human Poster response logged in Action Log with reason
4. Remaining Dispatches in the Campaign shift forward by the delay amount
5. If delay pushes Dispatches outside working hours → they slide to next working window
6. If Human Poster is consistently late → flagged in performance dashboard
7. If Human Poster does NOT respond → after `max_delay_threshold`, status → `missed`. Human Poster flagged. Campaign skips to next Dispatch.

### Export Package

Each Campaign can generate an export ZIP containing:
- Media files in post order (renamed: `01_product_name.jpg`, `02_product_name.jpg`, ...)
- `captions.txt` — full captions with resolved variables, one per line
- `whatsapp_links.txt` — resolved `wa.me` links, one per line
- `schedule.json` — machine-readable schedule for import into other tools

---

## Recommendation: Rewrite, Don't Adapt WassFlow

WassFlow's engine is ~400 lines of single-tenant, single-mode dispatch code. PostManagerwa needs a fundamentally different engine:

1. **Multi-tenant from schema up** — every query scoped to `organization_id`
2. **Mixed manual/automated** — not just API dispatch
3. **Human Poster-aware scheduling** — working hours, delay tracking, performance
4. **Rich constraint model** — not just delay_min/delay_max
5. **AI feedback loop** — Action Log → AI learning

Adapting WassFlow's engine to support all this would require rewriting most of it anyway. The WatsSender API integration code (`wasender.ts`, `whatsapp/client.ts`) is worth referencing but the scheduler should be built fresh with the PostManagerwa domain model.

### What to Keep from WassFlow

- **WatsSender API client** (`src/lib/whatsapp/client.ts`, `src/lib/wasender.ts`) — wraps the WatsSender REST API. Can be used as one PostingProvider implementation.
- **Optimistic locking pattern** — the `eq('status', 'pending')` update trick to prevent race conditions in a concurrent scheduler.
- **Queue serialization per session** — the 5-second gap enforcement and per-session processing ordering is sound.
- **Campaign completion detection** — `checkCampaignCompletion()` logic is straightforward and reusable.

### What to Build Fresh

- Everything else: the scheduler loop, Human Poster integration, Anti-Detection constraints, export, Action Log, Product Variant rotation, dynamic rescheduling, and multi-tenant scoping.

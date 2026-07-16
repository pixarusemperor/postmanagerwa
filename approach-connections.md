# Connection Mechanisms — How PostManager Talks to WhatsApp

---

## Approach 1: Monolith + Feature Flags

**Connection:** Direct function call (same process, same memory space)

```
PostManager dispatch engine
        │
        │  import { sendViaWatsender } from '@/lib/whatsapp/wasender'
        │  await sendViaWatsender(apiKey, payload)
        ▼
WhatsApp sending module (same codebase)
```

**How it works:** Both modules live in the same Next.js app. The dispatch engine imports and calls the WhatsApp sender function directly. No network, no serialization, no authentication between them — they're the same application. Feature flags (`organization.plan === 'pro'`) control whether the automated posting option appears in the UI.

**Connection mechanism:** `import { ... } from '@/lib/whatsapp/...'` — standard TypeScript module import. Direct in-process function call.

**Coupling level:** Maximum. Cannot separate without extracting the imported module.

---

## Approach 2: Turborepo + Separate Next.js Apps

**Connection:** Shared npm package (same monorepo, same build pipeline)

```
apps/post-manager/                    apps/whatsapp-marketing/
        │                                      │
        │  import { WatsSenderProvider }       │  // implements PostingProvider
        │  from '@repo/posting-provider'       │  // using same package
        ▼                                      ▼
packages/posting-provider/
   ├── PostingProvider.ts         ← interface
   ├── WatsSenderProvider.ts      ← WatsSender implementation
   ├── ManualProvider.ts
   └── ExportProvider.ts
```

**How it works:** The `@repo/posting-provider` package defines the `PostingProvider` interface and all implementations. Both apps import it. PostManager's dispatch engine calls `provider.send(dispatch)`. WhatsApp app uses the same package to expose its own API routes, but PostManager never calls WhatsApp app directly — it calls the provider, which internally uses the WatsSender HTTP client.

Wait — correction. In Approach 2, the apps are independent. PostManager can't import a provider that lives in another app. Let me think again.

**Actual connection for Approach 2:**

```
apps/post-manager/                          apps/whatsapp-marketing/
   lib/posting-providers/                       // Exposes REST API:
      WatsSenderProvider.ts  ──HTTP POST──►   POST /api/send-message
      (makes HTTP call to                      (receives dispatch payload,
       WhatsApp app's API)                      forwards to WatsSender,
                                                returns status)
```

OR: PostManager includes its own WatsSender client (from shared `@repo/whatsapp-client` package) and calls WatsSender directly. The WhatsApp app is for chatbot/sequences/inbox — not for sending.

**Two sub-patterns in Approach 2:**

**2a. Direct to WatsSender:** PostManager's `WatsSenderProvider` calls WatsSender API directly (shared `@repo/whatsapp-client` package). WhatsApp app is for chatbot features only. No inter-app communication for sending.

**2b. Via WhatsApp app API:** PostManager calls WhatsApp app's REST API. WhatsApp app proxies to WatsSender. WhatsApp app owns the API keys and session management.

**Connection mechanism:** (2a) Shared package import → direct HTTP to WatsSender. (2b) HTTP REST call between apps, authenticated with shared JWT.

**Coupling level:** (2a) Low — only the `@repo/whatsapp-client` package is shared. (2b) Medium — network dependency between apps.

---

## Approach 3: Separate Repos + npm Packages

**Connection:** Published npm package (versioned, installed from registry)

```
postmanagerwa-repo/                         whatsapp-marketing-repo/
   node_modules/                              node_modules/
     @postmanagerwa/whatsapp-client/            @postmanagerwa/whatsapp-client/
       ↑ published to npm registry               ↑ same package, same version
       │                                          │
   lib/posting-providers/                    
      WatsSenderProvider.ts                  
      import { WhatsAppClient }              
      from '@postmanagerwa/whatsapp-client'  
```

**How it works:** Same as Approach 2a — PostManager's WatsSenderProvider calls WatsSender directly using the shared `@postmanagerwa/whatsapp-client` npm package. The difference: the package is published to a registry (npm/GitHub Packages), not linked via monorepo workspace. PostManager installs it like any dependency.

If PostManager needs to talk to WhatsApp app's API (for chatbot features), it's an HTTP REST call with service-to-service auth.

**Connection mechanism:** npm install → import → direct HTTP to WatsSender (for sending). HTTP REST between apps (for chatbot integration). Version drift is the main risk — PostManager on `whatsapp-client@2.1.0`, WhatsApp app on `2.0.0`.

**Coupling level:** Low for sending (shared package is an independent artifact). Medium for cross-app features (HTTP).

---

## Approach 4: PostManager-First Plugin

**Connection:** Plugin registry (in-process, same deployable)

```
postmanagerwa/
   lib/plugins/
      registry.ts
         │
         │  plugins.register('whatsapp-chatbot', WhatsAppChatbotPlugin)
         │  plugins.register('whatsapp-sequences', WhatsAppSequencesPlugin)
         ▼
      whatsapp-chatbot/
         index.ts    ← implements Plugin interface
         ...
      whatsapp-sequences/
         index.ts
         ...
```

**How it works:** WhatsApp features are plugins inside PostManager. The plugin system defines interfaces (`Plugin`, `PostingProvider`). Plugins register themselves at startup. PostManager's core doesn't know about WhatsApp — it calls `pluginRegistry.getPostingProvider('watsender')` which returns the WatsSender implementation registered by the WhatsApp plugin.

**Connection mechanism:** In-process plugin registration. No network. Plugins are just directories in the monorepo. The plugin registry is the coupling point — it knows about all plugins, but PostManager core only depends on the registry interface, not individual plugins.

**Coupling level:** Medium. PostManager core is clean (depends only on plugin interfaces). But plugins live in the same codebase. Extracting a plugin means moving a directory to a new repo and adding an HTTP adapter.

---

## Approach 5: Microservices

**Connection:** REST API + Service-to-Service Auth

```
PostManager API                              WhatsApp API
        │                                          │
        │  POST /api/v1/dispatch/send              │
        │  Authorization: Bearer <service_token>   │
        │  Body: {                                  │
        │    target: "123456@g.us",                │
        │    message: { text: "...", media: [...] },│
        │    session_id: "wa_poster_xyz",           │
        │    callback_url: "https://pm/api/webhook" │
        │  }                                        │
        ├──────────────────────────────────────────►│
        │                                          │
        │  ← 202 Accepted { dispatch_id: "d_123" } │
        │                                          │
        │  POST /api/webhook/dispatch-status       │
        │◄──────────────────────────────────────────┤
        │  Body: { dispatch_id: "d_123",            │
        │          status: "sent",                  │
        │          message_id: "wa_msg_456" }       │
```

**How it works:** PostManager and WhatsApp API are fully separate services with their own databases. They communicate exclusively via REST APIs. PostManager sends a dispatch request. WhatsApp API processes it, returns 202 Accepted, then calls back via webhook when the send completes/fails. Each service has its own Supabase project or separate schema. Auth is handled via shared Supabase JWT or service-to-service API keys.

**Connection mechanism:** HTTP REST with JWT or API key auth. Async webhook for status. Network boundary on every interaction.

**Coupling level:** Low (contract-based, any WhatsApp API can implement the interface). But operational coupling is high — both services must be up, network latency on every dispatch, distributed transaction complexity on failures.

---

## Approach 6: Schema Separation

**Connection:** Database function call (same Postgres instance, different schemas)

```
PostManager code                            WhatsApp code
   lib/posting-providers/                      (same Next.js app)
      WatsSenderProvider.ts                    
         │                                     
         │  SELECT wa.send_message(             
         │    p_session_id => 'wa_poster_xyz',  
         │    p_target => '123456@g.us',        
         │    p_payload => '{...}'::jsonb       
         │  );                                  
         ▼                                     
Supabase Postgres
   ├── pm schema (PostManager tables)
   └── wa schema (WhatsApp tables + functions)
        wa.send_message() ← Postgres function wrapping WatsSender HTTP call
```

**How it works:** Both modules live in the same Next.js app and same Supabase project, but their tables are in separate Postgres schemas (`pm.*` and `wa.*`). PostManager code calls Postgres functions in the `wa` schema (e.g., `wa.send_message()`) which internally make HTTP calls to WatsSender via `pg_net` extension or a Supabase Edge Function.

Alternatively, PostManager's WatsSenderProvider calls WatsSender directly (shared HTTP client) and the `wa` schema is only for chatbot/sequences/inbox data.

**Connection mechanism:** Postgres function call (same DB connection, different schema). OR shared HTTP client in application code calling WatsSender directly. Both modules share the same Supabase client and auth context.

**Coupling level:** Medium. DB-level coupling (same Postgres instance) but schema-level isolation. Easier to extract later than Approach 1.

---

## Approach 7: PostManager Only + External WhatsApp

**Connection:** No direct connection — file export + webhook (loose coupling)

```
PostManager                                     External System
        │                                       (WassFlow, Manual, Any)
        │                                       
        │── Export ZIP ─────────────────────────► Manual Poster
        │   (media/*.jpg, captions.txt,          (downloads ZIP, posts manually)
        │    whatsapp_links.txt, schedule.json)   
        │                                       
        │── POST /api/webhook/dispatch-status ◄── WassFlow / Any API
        │   (external system reports             (calls PostManager webhook
        │    send completion/failure)             after posting each dispatch)
        │                                       
        │── Export API ─────────────────────────► Integration Script
        │   GET /api/campaigns/:id/export         (fetches dispatch list,
        │   (JSON with all dispatch details)       pushes to WatsSender/Twilio/...)
```

**How it works:** PostManager has NO WhatsApp integration. It produces:

1. **Export ZIP** — Media files renamed in order + `captions.txt` + `whatsapp_links.txt` + `schedule.json`. Downloaded by the Human Poster for manual posting.

2. **Export API** — REST endpoint that returns all Dispatches for a Campaign as JSON. Any external system (WassFlow, custom script, Zapier) fetches this and handles sending.

3. **Status Webhook** — External systems POST back to PostManager to report dispatch status. PostManager updates the Dispatch status and Action Log.

The connection is **one-directional**: PostManager produces, external systems consume. PostManager never initiates a WhatsApp API call.

**Connection mechanism:** ZIP file (manual) + REST JSON export (automated) + incoming webhook (status callback). File-based and HTTP. Zero runtime dependency between PostManager and any WhatsApp system.

**Coupling level:** Minimum possible. PostManager knows nothing about WhatsApp. Any system can consume the export. WassFlow stays untouched.

---

## Approach 8: Gradual Extraction

**Connection:** Evolves over time

```
Phase 1 (Monolith):     Direct import (same as Approach 1)
Phase 2 (Package):      Shared npm package (same as Approach 3)
Phase 3 (Turborepo):    Shared package in monorepo (same as Approach 2)
Phase 4 (Independent):  Export API + webhook (same as Approach 7)
```

**How it works at each phase:**

**Phase 1** — Everything in one app. Direct function calls. `import { sendViaWatsender } from '@/lib/whatsapp'`.

**Phase 2** — Extract `whatsapp-client` and `posting-provider` as packages in the same monorepo. PostManager imports them via workspace protocol. Connection is `import` but the dependency boundary is explicit.

**Phase 3** — Extract WhatsApp app to a separate deployable in Turborepo. PostManager still imports `@repo/whatsapp-client` to call WatsSender directly. WhatsApp app handles chatbot/sequences.

**Phase 4** — Full separation. PostManager drops the direct WatsSender client. It only produces exports. WhatsApp app (or any system) consumes them via REST API. Webhook for status.

**Connection mechanism:** Evolves: import → workspace package → REST export → full independence. Each phase changes the connection mechanism but the PostingProvider interface stays the same.

**Coupling level:** Starts high, ends low. The key risk is Phase 1 → Phase 2 never happening.

---

## Approach 9: Supabase-Only

**Connection:** Supabase Edge Function call + Realtime channel

```
PostManager Edge Function                   WhatsApp Edge Function
        │                                          │
        │  const { data } = await supabase         │
        │    .functions.invoke('wa-send', {         │
        │      body: { dispatch }                   │
        │    })                                     │
        ├──────────────────────────────────────────►│
        │                                          │
        │  // OR: listen on Realtime channel        │
        │  supabase                                 │
        │    .channel('dispatches')                 │
        │    .on('broadcast', { event: 'send' },    │
        │      (payload) => { ... })                │
        │◄──────────────────────────────────────────┤
        │                                          │
        │  // WhatsApp Edge Function broadcasts     │
        │  // status back                           │
        │  supabase.channel('dispatch-status')      │
        │    .send({ type: 'broadcast',             │
        │            event: 'sent',                 │
        │            payload: { dispatch_id } })    │
```

**How it works:** Both modules are Supabase Edge Functions. PostManager's dispatch engine invokes the `wa-send` Edge Function. Alternatively, they communicate via Supabase Realtime broadcast channels — PostManager inserts a row in `dispatch_queue`, WhatsApp Edge Function listens on that table, picks up the job, processes it, and broadcasts status back.

**Connection mechanism:** `supabase.functions.invoke()` (HTTP between Edge Functions) OR Supabase Realtime broadcast (WebSocket) OR database trigger (wa Edge Function triggered by INSERT on dispatch_queue table).

**Coupling level:** Medium. Tightly coupled to Supabase platform features. Hard to migrate away. But clean separation between function implementations.

---

## Approach 10: Split Backend + Shared Frontend

**Connection:** Frontend orchestrates both APIs (client-side composition)

```
Browser (React SPA)
        │
        ├── fetch('/pm-api/campaigns/123/dispatches') ──► PostManager API
        │                                                    ← [{ dispatch }]
        │
        │   // Frontend calls WhatsApp API for each dispatch
        │
        ├── fetch('/wa-api/send', {                          ──► WhatsApp API
        │     method: 'POST',                                     ← { status: "queued" }
        │     body: { target, message, media }
        │   })
        │
        │   // Frontend calls PostManager to update status
        │
        └── fetch('/pm-api/dispatches/d_123/status', {       ──► PostManager API
               method: 'PATCH',                                   ← { status: "updated" }
               body: { status: "sent" }
             })
```

**How it works:** The React frontend is the integration point. It fetches dispatches from PostManager API, then calls WhatsApp API to send each one, then calls PostManager API to update the status. The backend services never talk to each other. The browser orchestrates the workflow.

Alternative (better): A backend-for-frontend (BFF) layer that sits in front of both APIs and orchestrates the flow server-side, avoiding client-side cross-API calls.

**Connection mechanism:** Client-side HTTP orchestration (bad) or BFF server-side HTTP orchestration (better). Both APIs expose REST. No direct API-to-API communication.

**Coupling level:** Backend APIs are uncoupled from each other. But the frontend/BFF is tightly coupled to both. Changes in either API may break the frontend integration logic.

---

## Summary Table

| Approach | Connection | Latency | Failure Mode | Extractability |
|---|---|---|---|---|
| 1 Monolith | `import` / function call | Zero | App crash | Hard — must extract module |
| 2 Turborepo | Shared package `import` or HTTP REST | Zero (import) or ~50ms (HTTP) | Build failure (import) or network timeout (HTTP) | Medium — already separate apps |
| 3 Separate Repos | npm install → `import` | Zero | Version mismatch | Easy — already separate |
| 4 Plugin | Plugin registry → `import` | Zero | Plugin load failure | Medium — extract plugin dir |
| 5 Microservices | REST + webhook | ~50-200ms per call | Network timeout, 5xx, webhook missed | Easy — already separate |
| 6 Schema Separation | Postgres function or shared HTTP client | ~5ms (DB) or ~50ms (HTTP) | DB function error or network timeout | Medium — extract schema |
| 7 PM Only + External | ZIP export + REST JSON + webhook | Zero (PM doesn't call) | External system unavailable | Already separate — nothing to extract |
| 8 Gradual Extraction | Evolves: import → package → REST | Evolves | Evolves | Designed for extraction |
| 9 Supabase-Only | Edge Function invoke or Realtime | ~10-50ms (Edge-to-Edge) | Edge Function cold start or timeout | Hard — platform-coupled |
| 10 Split Backend | BFF/Client HTTP orchestration | ~100-300ms (3 HTTP calls) | Any API down breaks the chain | Easy — already separate APIs |

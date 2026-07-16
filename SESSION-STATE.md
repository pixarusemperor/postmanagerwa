# PostManagerwa — Session State for Next Session

## Quick Resume

**What:** Multi-tenant SaaS for WhatsApp campaign management. Brandable posting queue with product management, campaign scheduling, and dispatch tracking.

**Live:** `https://postmanager.orizongroup.online`

**Repo:** `https://github.com/pixarusemperor/postmanagerwa`

---

## Deploy Command (Copy-Paste)

```bash
cd /home/stevenjossu/PostManagerwa && \
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://gkuubgqwjusexpwaroif.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_JJzB28Bpzv90vs9lNZMLrA_qaKbNnSa \
  --build-arg NEXT_PUBLIC_APP_URL=https://postmanager.orizongroup.online \
  --build-arg NEXT_PUBLIC_R2_PUBLIC_URL=https://acc1d94d7b1a1b0bfdf773f548c6bf04.r2.cloudflarestorage.com/postmanagerwa-media \
  -t ghcr.io/pixarusemperor/postmanagerwa:latest . && \
sudo docker rm -f postmanagerwa 2>/dev/null && \
sudo docker run -d \
  --name postmanagerwa \
  --network coolify \
  -e NEXT_PUBLIC_SUPABASE_URL="https://gkuubgqwjusexpwaroif.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_JJzB28Bpzv90vs9lNZMLrA_qaKbNnSa" \
  -e SUPABASE_SERVICE_ROLE_KEY="from .env" \
  -e CLOUDFLARE_ACCOUNT_ID="acc1d94d7b1a1b0bfdf773f548c6bf04" \
  -e R2_ACCESS_KEY_ID="f0929d65e2ef6753acec47140169af6b" \
  -e R2_SECRET_ACCESS_KEY="13d17b7bf55769938e49d4a42f043c3588a2d9247a465ab18229c3d7ee1d1c2e" \
  -e R2_BUCKET_NAME="postmanagerwa-media" \
  -e NEXT_PUBLIC_R2_PUBLIC_URL="https://acc1d94d7b1a1b0bfdf773f548c6bf04.r2.cloudflarestorage.com/postmanagerwa-media" \
  -e NEXT_PUBLIC_APP_URL="https://postmanager.orizongroup.online" \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.postmanagerwa.rule=Host(\`postmanager.orizongroup.online\`)" \
  -l "traefik.http.routers.postmanagerwa.tls=true" \
  -l "traefik.http.routers.postmanagerwa.tls.certresolver=letsencrypt" \
  -l "traefik.http.services.postmanagerwa.loadbalancer.server.port=3000" \
  ghcr.io/pixarusemperor/postmanagerwa:latest
```

---

## Current State

| Layer | Status |
|---|---|
| **Deployment** | Running — Docker container on VPS, Traefik routing, TLS via Let's Encrypt |
| **Auth (signup)** | Working — creates user + org + membership. `mailer_autoconfirm=true` (no email verification) |
| **Auth (login)** | Working — password and magic link |
| **RLS** | Enabled on all 50 tables across `pm.*` and `wa.*` schemas |
| **Schema exposure** | PostgREST configured for `public,graphql_public,pm,wa` |
| **Signup RLS deadlock** | Fixed — first member can insert themselves |
| **Products page** | Reads from Supabase, shows table/card view |
| **Poster queue** | Reads dispatches, "Mark Done" button |
| **Skills installed** | 14 Supabase + Cloudflare skills for Claude Code / Cursor |

---

## Remaining Known Issues

### 1. Signup page uses `select('id')` implicitly via `.single()` — potential RLS fail

**File:** `src/app/signup/page.tsx` (line ~55)  
**Issue:** The org SELECT after insert might fail if RLS policies prevent non-members from reading orgs.  
**Quick fix:** Already patched — split into separate insert + select. Not yet committed to git. **Commit this before next session.**

```bash
cd /home/stevenjossu/PostManagerwa && git add -A && git commit -m "Fix signup: split insert/select to avoid RLS SELECT-on-INSERT deadlock" && git push
```

### 2. Email verification is off (`mailer_autoconfirm=true`)

**Decision needed:** Turn on email verification before production use? If yes: enable mailer, update signup flow to show "check your email" page.

### 3. organizations SELECT policy missing

**Issue:** The `org_member_read_final` policy was created via direct SQL (not migration). Not in any migration file. Will be lost on DB reset.  
**Fix:** Run `supabase migration new` and add the policy to a migration file.

### 4. Coolify auto-deploy not working

The `instant_deploy:true` approach doesn't trigger an initial build for new apps. Current workaround: manual `docker build + docker run`. GitHub Actions workflow is set up but untested.

---

## Key Files Changed This Session

| File | What changed |
|---|---|
| `src/app/signup/page.tsx` | Split insert/select to fix RLS deadlock |
| `supabase/migrations/*rls*.sql` | Created RLS enable + policy fix migration |
| `supabase/config.toml` | Added `pm, wa` to exposed schemas, disabled storage |
| `src/lib/auth/auth-context.tsx` | Added redirect, error handling, stale closure fix |
| `src/components/dashboard/dashboard-layout.tsx` | Responsive mobile hamburger menu |
| `Dockerfile` | Added build ARGs for Next.js static generation |
| `.github/workflows/deploy.yml` | GitHub Actions → GHCR → Coolify deploy |
| `src/middleware.ts` | Re-enabled route protection |
| `.agents/skills/` | Installed 14 Supabase + Cloudflare skills |

---

## Services & Credentials

| Service | URL / Ref | Key notes |
|---|---|---|
| **Supabase project** | `https://gkuubgqwjusexpwaroif.supabase.co` | Project ref: `gkuubgqwjusexpwaroif` |
| **Supabase anon key** | `sb_publishable_JJzB28Bpzv90vs9lNZMLrA_qaKbNnSa` | Public, safe for frontend |
| **Supabase service_role** | `sb_secret_...` (in `.env`) | Secret — API routes only |
| **Supabase access token** | `sbp_...` (in `.env`) | Management API |
| **Cloudflare R2** | Account `acc1d94d7b1a1b0bfdf773f548c6bf04` | Bucket: `postmanagerwa-media` |
| **Coolify** | `https://coolifyone.orizongroup.online` | API token: `1|cool_1244fb...` |
| **GitHub** | `pixarusemperor/postmanagerwa` | Branch: `main` |
| **VPS** | `34.155.88.118` | Ubuntu 24.04 |

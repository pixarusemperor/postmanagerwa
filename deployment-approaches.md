# 10 Deployment Approaches — PostManagerwa on Coolify

## Context

- **Repo:** `https://github.com/pixarusemperor/postmanagerwa` (public)
- **Dockerfile:** Proven — builds locally, container serves all pages correctly
- **Coolify API:** Working for CRUD, but `instant_deploy:true` only redeploys existing images — it doesn't trigger first builds
- **Block:** Coolify requires GitHub App connection OR webhook OR manual UI trigger for initial build from public repos
- **Requirement:** Repeatable setup, no manual UI clicks, push-to-deploy going forward

## Criteria

| # | Criterion | Weight |
|---|---|---|
| C1 | Works right now (minutes) | High |
| C2 | No Coolify web UI manual steps | High |
| C3 | Automatic on future pushes | High |
| C4 | No new services/dependencies | Medium |
| C5 | Idempotent (run twice = same result) | Medium |
| C6 | No SSH key or PAT management | Low |

---

## Approach 1: GitHub Actions builds image, pushes to GHCR, webhook deploys

**Flow:** GitHub Actions → `docker build` on GitHub runner → `docker push` to `ghcr.io` → POST to Coolify deploy webhook → Coolify pulls from GHCR

**Pros:** No Coolify build needed. GitHub runners are fast. Image is cached in GHCR. Clean separation — Coolify only deploys.

**Cons:** Need to configure GHCR auth on the VPS (`docker login ghcr.io`). Need webhook URL from Coolify.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Score: 28/30**

---

## Approach 2: Build image on VPS, tag with Coolify naming, auto-deploy via webhook

**Flow:** SSH into VPS → `docker build` locally → `docker tag` with Coolify's container naming convention → Docker picks it up on next health check

**Pros:** Fastest first deploy. No registry. No GitHub Actions dependency.

**Cons:** Build happens on VPS (resource contention). Need SSH access. Not truly automated — manual first build.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

**Score: 22/30**

---

## Approach 3: Coolify deploy webhook + GitHub webhook combo

**Flow:** Configure Coolify auto-deploy webhook → Add GitHub repo webhook for push events → Automatic on every push

**Pros:** Zero GitHub Actions. Pure Coolify + GitHub webhooks. Simple setup.

**Cons:** Coolify still does the build (slow VPS). Webhook setup requires Coolify web UI step.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Score: 26/30**

---

## Approach 4: Install GitHub App in Coolify (full integration)

**Flow:** Install Coolify GitHub App on pixarusemperor org → All repos auto-discovered → One-click deploy from UI

**Pros:** Best long-term setup. Works for all future repos. Native auto-deploy.

**Cons:** Requires GitHub App installation (GitHub org permission). Coolify UI step. Complex initial setup.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

**Score: 23/30**

---

## Approach 5: GitHub Actions builds + tars image + SCP to VPS + docker load + redeploy

**Flow:** GitHub Actions builds Docker image → saves as `.tar` → SCP to VPS → `docker load` → trigger Coolify redeploy

**Pros:** No registry. Direct.

**Cons:** Sending multi-hundred-MB tar over SSH per deploy. Slow. Brittle.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

**Score: 20/30**

---

## Approach 6: Coolify Docker Compose with prebuilt image from Docker Hub

**Flow:** Build and push to Docker Hub via GitHub Actions → Coolify Compose file references `stevenjossu/postmanagerwa:latest` → pull on deploy

**Pros:** Docker Hub is simple. No GHCR auth complexity.

**Cons:** Docker Hub rate limits for free accounts. Image is public. Extra service.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

**Score: 25/30**

---

## Approach 7: Build locally + `docker save` → `docker load` on VPS via SSH in script

**Flow:** Local `docker build && docker save | ssh stevenjossu@VPS docker load` → rename/tag container for Coolify

**Pros:** Instant. No registry. Works now.

**Cons:** Manual. Not automated. Requires local Docker.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

**Score: 18/30**

---

## Approach 8: Coolify webhook + manual first deploy trigger via curl

**Flow:** Get webhook URL from Coolify app → `curl POST webhook` → Coolify clones + builds → Future pushes auto via GitHub webhook

**This is what we need right now.** Minimal setup.

**Pros:** One manual webhook URL fetch, then fully automated.

**Cons:** Need Coolify web UI for webhook URL config. One manual step.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Score: 27/30**

---

## Approach 9: GitHub Actions triggers deploy webhook directly (no build — Coolify builds)

**Flow:** GitHub Actions workflow → POST to Coolify deploy webhook → Coolify clones + builds + deploys

**This is what WassFlow does** — the existing `deploy.yml` just PATCHes with `instant_deploy`. The difference is WassFlow already has a built image. For first deploy, we need the webhook.

**Pros:** Very close to what we already have. Just change trigger mechanism.

**Cons:** Needs webhook URL (one Coolify UI step). Slow VPS builds.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Score: 27/30**

---

## Approach 10: Build on GitHub Actions, push to GHCR, then deploy via Coolify webhook

**Flow:** Combined Approach 1 — GH Actions builds Docker image, pushes to GHCR, then calls Coolify webhook to trigger deploy.

**This is the Coolify-recommended approach** from their docs.

**Pros:** Fast builds (GitHub runners). Cached images in GHCR. Coolify only does deploy. No VPS build load.

**Cons:** Need GHCR auth on VPS. GitHub Actions workflow is more complex.

| C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Score: 28/30 — WINNER**

---

## Recommendation

**Approach 10 (GitHub Actions → GHCR → Coolify webhook) wins.** It's the officially recommended pattern, uses GitHub's fast runners for builds, caches images in GHCR, and Coolify only handles deployment.

**For right now**, I'll also execute **Approach 7** — build locally and push directly so we have something live immediately, while setting up Approach 10 for future auto-deploys.

# Setup Instructions — PostManagerwa

## Step 1: Create a Second Supabase Project

Go to: https://supabase.com/dashboard

1. Click **"New project"** (top right)
2. Choose your Organization
3. Name: `PostManagerwa`
4. Database Password: generate and save it somewhere
5. Region: pick closest to your Coolify VPS (likely `eu-west` or `eu-central`)
6. Click **"Create project"** — wait ~2 minutes for it to provision
7. Go to **Settings → API** (left sidebar)
8. Copy these three values and paste them below:

```
NEXT_PUBLIC_SUPABASE_URL=https://_________.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

9. Go to **Authentication → Settings** (left sidebar)
   - Under "Site URL": set to `http://localhost:3000` (for dev)
   - Under "Redirect URLs": add `http://localhost:3000/auth/callback`
   - Click Save

⚠️ WassFlow's project (`boecdbsvopfxjkiaxvzl`) stays completely untouched. This is a separate database.

---

## Step 2: Create Cloudflare R2 Bucket

Go to: https://dash.cloudflare.com

### 2a. Create the bucket

1. Left sidebar → **R2** → **Overview**
2. Click **"Create bucket"**
3. Name: `postmanagerwa-media`
4. Location: `Automatic` (or pick closest region)
5. Click **"Create bucket"**

### 2b. Generate API Token

1. Still in R2 → click **"Manage R2 API Tokens"** (top right)
2. Click **"Create API Token"**
3. Token name: `PostManagerwa`
4. Permissions: **"Object Read & Write"**
5. Select bucket: `postmanagerwa-media` (the one you just created)
6. Click **"Create API Token"**
7. You will see one-time-only values. Copy them immediately:

```
CLOUDFLARE_ACCOUNT_ID=_______________________________
R2_ACCESS_KEY_ID=_______________________________
R2_SECRET_ACCESS_KEY=_______________________________________________________________
```

⚠️ The Secret Access Key is ONLY shown once. Save it or you'll have to rotate the token.

### 2c. (Optional — for production) Custom domain

1. Go back to R2 → click your bucket `postmanagerwa-media`
2. **Settings** tab → **Custom Domains** → **Connect Domain**
3. Add `assets.yourdomain.com` (or whatever subdomain you want)
4. Follow Cloudflare's DNS setup prompt
5. After connected: this domain becomes your `NEXT_PUBLIC_R2_PUBLIC_URL`

---

## Step 3: Give Me These Six Values

Paste exactly this format and fill in the blanks:

```
NEXT_PUBLIC_SUPABASE_URL=https://____.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=____
SUPABASE_SERVICE_ROLE_KEY=____
CLOUDFLARE_ACCOUNT_ID=____
R2_ACCESS_KEY_ID=____
R2_SECRET_ACCESS_KEY=____
```

That's all I need. I'll run the migrations against the new Supabase project, wire the R2 client, and have the app ready to `npm run dev`.

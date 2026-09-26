# "Storage by Iswar" — Google Drive Auto-Save Setup

Print dabate hi invoice ka PDF tumhare **Google Drive** ke **"Arup Invoices"** folder
me auto-save hoga. Iske liye Google se "Login with Google" connect karna hota hai.

## Step 1 — Google Cloud project (2 min)

1. https://console.cloud.google.com par jao → top me project dropdown → **New Project**
   (Naam: `arup-invoice`; purana Firebase project bhi select kar sakte ho)
2. Left menu → **APIs & Services → Library** → search **"Google Drive API"** → **Enable** karo

## Step 2 — OAuth consent screen

1. **APIs & Services → OAuth consent screen** → User type **External** → Create
2. App name: `Arup Invoice`, support email: apna Gmail → Save and Continue
3. **Scopes** → Add or Remove Scopes → ye wali add karo:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
   (sirf app dwara banayi files ka access — tumhara baaki Drive chhoo nahi sakta)
4. **Test users** → **Add Users** → apna Gmail add karo → Save

## Step 3 — OAuth Client ID banao

1. **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**
2. Application type: **Web application**, naam: `arup-invoice-web`
3. **Authorized redirect URIs** me ye add karo (apna Vercel URL daal kar):
   ```
   https://tumhara-app.vercel.app/api/auth/callback/google
   ```
   > ⚠️ URL bilkul exact hona chahiye — aage `/api/auth/callback/google` zaroor lage.
4. **Create** → **Client ID** aur **Client secret** copy karo

## Step 4 — Vercel env vars

Vercel → Project → **Settings → Environment Variables** me ye 4 add karo:

```
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
NEXTAUTH_SECRET=<koi lambi random string — terminal me `openssl rand -base64 32` chalakar banao>
NEXTAUTH_URL=https://tumhara-app.vercel.app
```

Phir **Deployments → ⋯ → Redeploy** karo.

## Step 5 — App me Connect karo

1. App kholo → Editor tab me sabse upar **☁️ Storage by Iswar** card
2. **🔗 Connect with Google** dabao → apna Gmail chuno → Allow karo
3. ✅ Connected dikhega. Ab har **🖨️ Print / PDF** par PDF Drive par save hoga.

## Zaroori notes

- **Testing mode:** consent screen "Testing" me rehta hai to Google har **7 din** baad
  token expire kar deta hai — phir card me dobara **Connect** dabana padega (10 second ka kaam).
  Hamesha ke liye chahiye to OAuth consent screen ko **Publish App** kar do
  (unverified warning aayega, par chalega — sirf tum use kar rahe ho).
- PDFs Drive me **"Arup Invoices"** folder me `Invoice-A00067.pdf` naam se save honge.
- Drive connect kiye bina bhi Print kaam karega (sirf Drive save skip hoga).

# Firebase (Firestore) Setup — Arup Invoice Generator

Supabase hata diya hai — ab database **Firebase Firestore** par chalega
(free plan kabhi pause nahi hota).

## Step 1 — Firebase project banao
1. https://console.firebase.google.com par jao → **Add project**
2. Naam do (jaise `arup-invoice`) → Google Analytics OFF kar sakte ho → Create

## Step 2 — Firestore Database banao
1. Left menu → **Build → Firestore Database** → **Create database**
2. **Start in production mode** chuno → **Enable**
3. Location: `asia-south1 (Mumbai)` chuno (India ke sabse paas)

## Step 3 — Security Rules (copy-paste)
Firestore Database → **Rules** tab → neeche wala paste karke **Publish** karo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sab kuch sirf server (Admin SDK) se — browser se direct access band
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> Collections (`invoices`, `counters`) pehli save par **khud ban jayengi**.
> Counter purane bills ka sabse bada number dekh kar uske aage se start hoga.

## Step 4 — Service Account Key nikalo
1. Project Settings (⚙️) → **Service accounts** tab
2. **Generate new private key** → **Generate key** → JSON file download hogi
3. JSON kholo — usme se ye 3 values nikalo:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (poori `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` wali value, `\n` sameet)

## Step 5 — Env vars set karo
- **Local test:** `.env.example` ko copy karke `.env.local` banao, values bhoro, `npm run dev`
- **Vercel:** Project → Settings → Environment Variables me teeno add karo → Redeploy

## Step 6 — Verify
App kholo → Invoice Number section me **↻ DB Sync 🟢** dikhna chahiye.
Pehla bill save karte hi Firestore me `invoices` aur `counters` collections ban jayengi.

## Note
- Purana Supabase data migrate karna ho to batao — script bana dunga.
- Ye JSON key **kisi se share mat karna** — ye poora database access deti hai.

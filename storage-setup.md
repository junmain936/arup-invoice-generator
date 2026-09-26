# "Storage by Iswar" — Auto-Save Setup

Print dabate hi invoice ka PDF tumhare **apne Storage by Iswar**
(https://ishwar-storage.vercel.app) par auto-save hoga.
**Google login ki zaroorat nahi** — bas ek key paste karni hai.

## Step 1 — Personal API key nikalo

1. Apna **Storage by Iswar** app kholo: https://ishwar-storage.vercel.app
2. **Settings** tab me jao → **"Your personal API key"** wala card
3. Key **copy** karo (agar key nahi dikh rahi to Regenerate kar lo)

## Step 2 — Invoice app me Connect karo

1. Invoice app kholo → Editor tab me sabse upar **☁️ Storage by Iswar** card
2. Key **paste** karo → **🔗 Connect** dabao
3. ✅ Connected dikhega — ho gaya!

Ab har **🖨️ Print / PDF** dabane par `Invoice-A00067.pdf` jaisi file
tumhare storage par khud save ho jayegi.

## Dusra tarika (Vercel env)

Agar app me paste nahi karna to Vercel → Project → **Settings → Environment Variables** me:

```
ISHWAR_STORAGE_USER_KEY=<tumhari personal key>
```

Phir **Redeploy** karo. App khulne par khud ✅ Connected dikhega.

## Notes

- Key sirf **tumhari apni files** tak access deti hai — kisi aur ka data chhoo nahi sakti.
- Key **Regenerate** karoge to invoice app me dobara Connect karna padega.
- Storage connect kiye bina bhi Print kaam karega (sirf auto-save skip hoga).
- Disconnect: card me **Disconnect** dabao (env wali key Vercel se hatani padegi).

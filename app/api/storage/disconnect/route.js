import { getDb } from '@/lib/firebase'

// POST /api/storage/disconnect — app me save ki hui key hatao
export async function POST() {
  try {
    if (process.env.ISHWAR_STORAGE_USER_KEY) {
      return Response.json(
        { error: 'Key Vercel env me lagi hai — Vercel → Settings → Environment Variables se hatao' },
        { status: 400 }
      )
    }
    await getDb().collection('storage_config').doc('main').delete()
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

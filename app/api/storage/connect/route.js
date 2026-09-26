import { getDb } from '@/lib/firebase'
import { validateStorageKey } from '@/lib/storage'

// POST /api/storage/connect — { user_key } : key verify karke save karo
export async function POST(request) {
  try {
    const { user_key } = await request.json()
    const key = (user_key || '').trim()
    if (!key) return Response.json({ error: 'Key khaali hai' }, { status: 400 })

    const ok = await validateStorageKey(key)
    if (!ok) {
      return Response.json(
        { error: 'Ye key kaam nahi kar rahi — Storage app ke Settings → "Your personal API key" se sahi key copy karo' },
        { status: 401 }
      )
    }

    await getDb().collection('storage_config').doc('main').set({
      user_key: key,
      connected_at: new Date().toISOString(),
    })

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

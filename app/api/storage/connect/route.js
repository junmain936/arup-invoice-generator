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

    const ref = getDb().collection('storage_config').doc('main')
    await ref.set({
      user_key: key,
      connected_at: new Date().toISOString(),
    })
    // Write confirm: wapas padhkar pakka karo key save hui
    const check = await ref.get()
    if (!check.data()?.user_key) {
      throw new Error('Firestore me key save confirm nahi hui — dobara try karo')
    }

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

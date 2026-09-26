import { getStorageKey, validateStorageKey } from '@/lib/storage'

// GET /api/storage/status — storage connected hai ya nahi?
export async function GET() {
  try {
    const { key, source } = await getStorageKey()
    if (!key) return Response.json({ connected: false })
    const ok = await validateStorageKey(key)
    return Response.json({ connected: ok, source })
  } catch (e) {
    return Response.json({ connected: false, error: e.message })
  }
}

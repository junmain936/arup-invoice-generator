import { getDb } from '@/lib/firebase'
import { validateStorageKey } from '@/lib/storage'

// Hamesha fresh check — browser/CDN cache se purana status na aaye
export const dynamic = 'force-dynamic'

// GET /api/storage/status — storage connected hai ya nahi? (diagnostics ke saath)
//   keySaved : key env/Firestore me maujood hai (valid ho ya na ho)
//   keyValid : key abhi Storage API par kaam kar rahi hai (live check)
//   connected: keySaved && keyValid
export async function GET() {
  try {
    const db = getDb()
    let key = null
    let source = null
    let readError = null

    if (process.env.ISHWAR_STORAGE_USER_KEY) {
      key = process.env.ISHWAR_STORAGE_USER_KEY
      source = 'env'
    } else {
      try {
        const snap = await db.collection('storage_config').doc('main').get()
        key = snap.data()?.user_key || null
        source = key ? 'app' : null
      } catch (e) {
        readError = e.message
      }
    }

    const keySaved = !!key
    let keyValid = false
    if (keySaved) {
      keyValid = await validateStorageKey(key)
    }

    return Response.json({
      connected: keySaved && keyValid,
      keySaved,
      keyValid,
      source,
      readError,
    })
  } catch (e) {
    return Response.json({
      connected: false, keySaved: false, keyValid: false,
      error: e.message,
    })
  }
}

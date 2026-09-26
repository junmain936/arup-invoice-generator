import { getDb } from './firebase'

// Tumhara apna "Storage by Ishwar" — https://ishwar-storage.vercel.app
export const STORAGE_BASE =
  process.env.ISHWAR_STORAGE_BASE_URL || 'https://ishwar-storage.vercel.app/api/telegram'

// Key kahan se aayegi: pehle Vercel env, nahi to app me Connect karke save ki hui (Firestore)
export async function getStorageKey() {
  if (process.env.ISHWAR_STORAGE_USER_KEY) {
    return { key: process.env.ISHWAR_STORAGE_USER_KEY, source: 'env' }
  }
  try {
    const snap = await getDb().collection('storage_config').doc('main').get()
    const key = snap.data()?.user_key
    if (key) return { key, source: 'app' }
  } catch (e) {
    console.error('storage_config read fail:', e.message)
  }
  return { key: null, source: null }
}

// Key sahi hai ya nahi — Storage API par test call
export async function validateStorageKey(key) {
  try {
    const res = await fetch(`${STORAGE_BASE}/files?limit=1`, {
      headers: { 'x-user-key': key },
    })
    return res.ok
  } catch {
    return false
  }
}

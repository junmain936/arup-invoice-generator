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

// Storage se file delete karo.
// fileId ho to seedha delete, nahi to invoice number se naam match karke dhoondho.
// Kabhi throw nahi karta — hamesha { deleted, note } deta hai.
export async function deleteStorageFile({ fileId, invoiceNo }) {
  const { key } = await getStorageKey()
  if (!key) return { deleted: false, note: 'Storage connected nahi' }
  const auth = { 'x-user-key': key }

  const doDelete = async (fid) => {
    try {
      const res = await fetch(`${STORAGE_BASE}/delete`, {
        method: 'DELETE',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fid }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // 1) fileId pata hai → seedha delete
  if (fileId) {
    const ok = await doDelete(fileId)
    return ok
      ? { deleted: true, note: 'Storage se PDF delete ho gaya' }
      : { deleted: false, note: 'Storage delete fail' }
  }

  // 2) naam se dhoondho: Invoice-<no>.pdf
  if (!invoiceNo) return { deleted: false, note: 'Invoice number nahi mila' }
  try {
    const lr = await fetch(`${STORAGE_BASE}/files?limit=100`, { headers: auth })
    if (!lr.ok) return { deleted: false, note: 'Storage list fail' }
    const data = await lr.json().catch(() => ({}))
    const arr = Array.isArray(data) ? data : data.files || data.data || data.items || []
    const target = `invoice-${String(invoiceNo).toLowerCase()}`
    const matches = arr
      .map((f) => ({
        id: f.fileId || f.file_id || f.id,
        name: String(f.fileName || f.file_name || f.name || f.originalName || ''),
      }))
      .filter((f) => f.id && f.name.toLowerCase().includes(target))
    if (!matches.length) return { deleted: false, note: 'Storage me PDF nahi mili' }
    let n = 0
    for (const m of matches) if (await doDelete(m.id)) n++
    return n > 0
      ? { deleted: true, note: `${n} PDF storage se delete` }
      : { deleted: false, note: 'Storage delete fail' }
  } catch (e) {
    return { deleted: false, note: 'Storage error: ' + e.message }
  }
}

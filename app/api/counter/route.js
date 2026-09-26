import { getDb } from '@/lib/firebase'

const COUNTER_ID = 'main'

function formatNo(prefix, num, pad) {
  return prefix + (pad > 0 ? String(num).padStart(pad, '0') : String(num))
}

// Pehli baar: counter doc nahi hai to seed karo.
// User ne 66 tak ke bill manually bana liye hain → 67 se start hoga.
// (DB me agar isse bada number mila to wahi jeetega — purana number repeat nahi hoga.)
const MANUAL_LAST_NUM = 66

async function ensureCounter(db) {
  const ref = db.collection('counters').doc(COUNTER_ID)
  const snap = await ref.get()
  if (snap.exists) return snap.data()

  let maxNum = MANUAL_LAST_NUM
  const invSnap = await db.collection('invoices').orderBy('invoice_no', 'desc').limit(100).get()
  for (const d of invSnap.docs) {
    const m = String(d.data().invoice_no || '').match(/(\d+)$/)
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
  }

  const seed = {
    prefix: 'A',
    last_num: maxNum,
    pad: 5,
    updated_at: new Date().toISOString(),
  }
  await ref.set(seed)
  return seed
}

// GET /api/counter — agla number dekho (bina reserve kiye)
export async function GET() {
  try {
    const db = getDb()
    const c = await ensureCounter(db)
    const next = (c.last_num || 0) + 1
    return Response.json({
      prefix: c.prefix,
      next_num: next,
      pad: c.pad,
      next_no: formatNo(c.prefix, next, c.pad),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/counter
//   { action: 'reserve' }                → agla number pakka karo (transaction — kabhi repeat nahi)
//   { action: 'set', prefix, num, pad }  → counter manually set karo (num = agla number)
export async function POST(request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { action } = body

    if (action === 'reserve') {
      await ensureCounter(db)
      // Firestore transaction: do device ek saath bhi same number nahi paayenge
      const result = await db.runTransaction(async (t) => {
        const ref = db.collection('counters').doc(COUNTER_ID)
        const snap = await t.get(ref)
        const data = snap.data() || { prefix: 'A', last_num: 0, pad: 5 }
        const next = (data.last_num || 0) + 1
        t.update(ref, { last_num: next, updated_at: new Date().toISOString() })
        return {
          prefix: data.prefix,
          num: next,
          pad: data.pad,
          invoice_no: formatNo(data.prefix, next, data.pad),
        }
      })
      return Response.json(result)
    }

    if (action === 'set') {
      const { prefix, num, pad } = body
      if (!prefix || !(num >= 1)) {
        return Response.json({ error: 'prefix aur num (≥1) chahiye' }, { status: 400 })
      }
      await ensureCounter(db)
      await db.collection('counters').doc(COUNTER_ID).update({
        prefix,
        last_num: num - 1, // num = agla istemal hone wala number
        pad: pad ?? 5,
        updated_at: new Date().toISOString(),
      })
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

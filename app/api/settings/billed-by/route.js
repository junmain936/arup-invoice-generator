import { getDb } from '@/lib/firebase'

// Firestore doc: settings/billedBy
// Sidebar (☰) se seller details edit karke yahan save hoti hain —
// code khole bina future updates ke liye. Pehli baar doc nahi hai
// to null aayega aur app hardcoded DEFAULT_BILLED_BY use karega.
const DOC_ID = 'billedBy'

// GET /api/settings/billed-by — saved Billed By lao (ya null)
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('settings').doc(DOC_ID).get()
    if (!snap.exists) return Response.json({ billedBy: null })
    return Response.json({ billedBy: snap.data().data || null })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/settings/billed-by — { billedBy: {...} } save karo
export async function POST(request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { billedBy } = body
    if (!billedBy || typeof billedBy !== 'object') {
      return Response.json({ error: 'billedBy object chahiye' }, { status: 400 })
    }
    await db.collection('settings').doc(DOC_ID).set({
      data: {
        name: billedBy.name || '',
        address: billedBy.address || '',
        gstin: billedBy.gstin || '',
        pan: billedBy.pan || '',
        email: billedBy.email || '',
        phone: billedBy.phone || '',
        bank: billedBy.bank || '',
      },
      updated_at: new Date().toISOString(),
    })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

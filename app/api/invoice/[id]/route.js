import { getDb } from '@/lib/firebase'
import { deleteStorageFile } from '@/lib/storage'

// 66 tak ke bill user ne manually bana liye hain — counter kabhi isse neeche nahi jayega
const MANUAL_LAST_NUM = 66

// GET /api/invoice/[id]
export async function GET(request, { params }) {
  try {
    const { id } = params
    const snap = await getDb().collection('invoices').doc(id).get()

    if (!snap.exists) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 })
    }
    return Response.json({ invoice: { id: snap.id, ...snap.data() } })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/invoice/[id] — invoice delete + number free (agar latest tha) + storage PDF delete
export async function DELETE(request, { params }) {
  try {
    const db = getDb()
    const { id } = params
    const docRef = db.collection('invoices').doc(id)
    const snap = await docRef.get()
    if (!snap.exists) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 })
    }
    const inv = snap.data()
    const invNo = inv.invoice_no
    const fileId = inv.storage_file_id || null
    await docRef.delete()

    // Number wapas free karo — SIRF tab jab ye sabse latest number tha.
    // (Purana invoice delete karne se numbering nahi hilti — gap safe hai, reuse nahi.)
    let numberFreed = null
    const m = String(invNo || '').match(/(\d+)$/)
    if (m) {
      const num = parseInt(m[1], 10)
      const cRef = db.collection('counters').doc('main')
      const cSnap = await cRef.get()
      const lastNum = cSnap.exists ? cSnap.data().last_num || 0 : 0
      if (num === lastNum && num > MANUAL_LAST_NUM) {
        await cRef.update({ last_num: num - 1, updated_at: new Date().toISOString() })
        numberFreed = invNo
      }
    }

    // Storage by Iswar se PDF bhi delete karo (best effort — fail bhi ho to invoice delete hua mana jayega)
    let storage = { deleted: false, note: '' }
    try {
      storage = await deleteStorageFile({ fileId, invoiceNo: invNo })
    } catch (e) {
      storage = { deleted: false, note: 'Storage error: ' + e.message }
    }

    return Response.json({ success: true, numberFreed, storage })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

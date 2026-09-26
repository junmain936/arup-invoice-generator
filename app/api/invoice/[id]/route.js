import { getDb } from '@/lib/firebase'

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

// DELETE /api/invoice/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    await getDb().collection('invoices').doc(id).delete()
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

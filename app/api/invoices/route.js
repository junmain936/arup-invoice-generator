import { getDb } from '@/lib/firebase'

// GET /api/invoices — saare invoices (naye pehle)
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection('invoices').orderBy('created_at', 'desc').get()

    const invoices = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        invoice_no: data.invoice_no,
        invoice_date: data.invoice_date,
        billed_to: data.billed_to,
        grand_total: data.grand_total,
        currency: data.currency,
        created_at: data.created_at,
      }
    })

    return Response.json({ invoices })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/invoices — naya invoice save karo
export async function POST(request) {
  try {
    const db = getDb()
    const body = await request.json()

    const {
      invoice_no, invoice_date, due_date,
      billed_by, billed_to, items,
      gst_type, subtotal, total_gst, grand_total, currency
    } = body

    // Basic validation
    if (!invoice_no || !invoice_date || !billed_by || !billed_to || !items?.length) {
      return Response.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // Duplicate invoice_no check
    const dup = await db.collection('invoices').where('invoice_no', '==', invoice_no).limit(1).get()
    if (!dup.empty) {
      return Response.json({ error: `Invoice ${invoice_no} already exists` }, { status: 409 })
    }

    const docRef = await db.collection('invoices').add({
      invoice_no,
      invoice_date,
      due_date: due_date || null,
      billed_by,
      billed_to,
      items,
      gst_type,
      subtotal,
      total_gst,
      grand_total,
      currency,
      created_at: new Date().toISOString(),
    })

    const saved = await docRef.get()
    return Response.json({ invoice: { id: docRef.id, ...saved.data() } }, { status: 201 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

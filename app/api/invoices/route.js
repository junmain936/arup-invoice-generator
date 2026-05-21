import { supabaseAdmin } from '@/lib/supabase'

// GET /api/invoices — list all invoices (latest first)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_no, invoice_date, billed_to, grand_total, currency, created_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ invoices: data })
}

// POST /api/invoices — save new invoice
export async function POST(request) {
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

  // Check duplicate invoice_no
  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('invoice_no', invoice_no)
    .single()

  if (existing) {
    return Response.json({ error: `Invoice ${invoice_no} already exists` }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert([{
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
      currency
    }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ invoice: data }, { status: 201 })
}

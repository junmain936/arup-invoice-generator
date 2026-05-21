import { supabaseAdmin } from '@/lib/supabase'

// GET /api/invoice/[id]
export async function GET(request, { params }) {
  const { id } = params

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: 'Invoice not found' }, { status: 404 })
  return Response.json({ invoice: data })
}

// DELETE /api/invoice/[id]
export async function DELETE(request, { params }) {
  const { id } = params

  const { error } = await supabaseAdmin
    .from('invoices')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

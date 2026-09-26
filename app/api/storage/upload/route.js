import { getStorageKey, STORAGE_BASE } from '@/lib/storage'

// POST /api/storage/upload — FormData: file (PDF blob), invoice_no
// Invoice app se PDF lekar tumhare "Storage by Ishwar" par upload karta hai
export async function POST(request) {
  try {
    const { key } = await getStorageKey()
    if (!key) {
      return Response.json({ error: 'Storage connected nahi hai' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const invoiceNo = form.get('invoice_no') || 'invoice'
    if (!file) return Response.json({ error: 'PDF file missing' }, { status: 400 })

    const fd = new FormData()
    fd.append('file', file, `Invoice-${invoiceNo}.pdf`)
    fd.append('uploadedBy', 'arup-invoice')

    const res = await fetch(`${STORAGE_BASE}/upload`, {
      method: 'POST',
      headers: { 'x-user-key': key },
      body: fd,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Storage upload fail')

    return Response.json({ ok: true, file: data.file || null })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

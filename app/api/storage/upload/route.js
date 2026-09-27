import { getStorageKey, STORAGE_BASE } from '@/lib/storage'
import { getDb } from '@/lib/firebase'

// Storage API ke alag-alag response shape se fileId / fileName nikalo
function pickFileId(data) {
  const f = data?.file || data?.data || data || {}
  return f.fileId || f.file_id || f.id || null
}
function pickFileName(data, fallback) {
  const f = data?.file || data?.data || data || {}
  return f.fileName || f.file_name || f.name || f.originalName || fallback
}

// POST /api/storage/upload — FormData: file (PDF blob), invoice_no, invoice_id?
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
    const invoiceId = form.get('invoice_id') || null
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

    // fileId invoice doc par stamp karo taaki delete ke time seedha delete ho sake
    const fileId = pickFileId(data)
    const fileName = pickFileName(data, `Invoice-${invoiceNo}.pdf`)
    if (invoiceId && fileId) {
      try {
        await getDb().collection('invoices').doc(String(invoiceId)).update({
          storage_file_id: fileId,
          storage_file_name: fileName,
        })
      } catch { /* stamp fail → delete time naam se dhoondh lenge */ }
    }

    return Response.json({ ok: true, file: data.file || null, fileId, fileName })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

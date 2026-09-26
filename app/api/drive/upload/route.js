import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getDb } from '@/lib/firebase'

const FOLDER_NAME = 'Arup Invoices'

// Refresh token se naya access token lo
async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || 'Google token refresh fail')
  return data.access_token
}

// "Arup Invoices" folder ka ID nikalo (nahi hai to banao)
async function getFolderId(accessToken) {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`
  )
  const sRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const sData = await sRes.json()
  if (sData.files?.length) return sData.files[0].id

  const cRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const cData = await cRes.json()
  if (!cData.id) throw new Error('Drive folder banane me fail')
  return cData.id
}

// POST /api/drive/upload — FormData: file (PDF blob), invoice_no
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) return Response.json({ error: 'Google se connect karo pehle' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('file')
    const invoiceNo = form.get('invoice_no') || 'invoice'
    if (!file) return Response.json({ error: 'PDF file missing' }, { status: 400 })

    // User ka refresh token Firestore se
    const tokSnap = await getDb().collection('drive_tokens').doc(email).get()
    const refreshToken = tokSnap.data()?.refresh_token
    if (!refreshToken) {
      return Response.json({ error: 'Drive token nahi mila — dobara Connect karo' }, { status: 400 })
    }

    const accessToken = await getAccessToken(refreshToken)
    const folderId = await getFolderId(accessToken)

    // Multipart upload
    const arrayBuf = await file.arrayBuffer()
    const boundary = 'drive_upload_' + Date.now()
    const metadata = JSON.stringify({
      name: `Invoice-${invoiceNo}.pdf`,
      parents: [folderId],
      mimeType: 'application/pdf',
    })
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from(arrayBuf),
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const upRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      }
    )
    const upData = await upRes.json()
    if (!upData.id) throw new Error(upData.error?.message || 'Drive upload fail')

    return Response.json({ ok: true, fileId: upData.id, link: upData.webViewLink })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

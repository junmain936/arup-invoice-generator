'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── COLLAPSIBLE CARD ──────────────────────────────────────────
function CollapsibleCard({ icon, title, children, defaultOpen = false, headerExtra }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <div className="card-header card-header-toggle" onClick={() => setOpen(o => !o)}>
        <span className="icon">{icon}</span>
        <h2>{title}</h2>
        {headerExtra && <div onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto' }}>{headerExtra}</div>}
        <span className={`card-chevron${open ? ' open' : ''}`}>▾</span>
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  )
}

// ── DEFAULTS ──────────────────────────────────────────────────
const DEFAULT_BILLED_BY = {
  name: 'M/S Arup Enterprise',
  address: 'Na,Falfali Biswanath Chariali, Biswanath, Assam, India - 784176',
  gstin: '18BVHPT5295B2Z6',
  pan: 'BVHPT5295B',
  email: 'aruptimchine12@gmail.com',
  phone: '+91 93985 79293',
  bank: 'PUNJAB NATIONAL BANK | A/C: ARUP TIMSINA | A/C No: 2051202100001172 | IFSC: PUNB0205120',
}

// Billed To (Client) — har invoice me client alag ho sakta hai,
// isliye koi preset nahi; har baar blank se start hoga.
const DEFAULT_BILLED_TO = {
  name: '',
  address: '',
  gstin: '',
  state: '',
}

// Items start empty — user adds via "＋ Add Item" (no preset item)
const EMPTY_ITEM = { desc: '', hsn: '', qty: 1, rate: 0, gstRate: 18 }

// Delete PIN — invoice delete karne se pehle mangta hai (soft lock: code me dikhta hai)
const DELETE_PIN = '939857'

// ── HELPERS ───────────────────────────────────────────────────
function toISOLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function numberToWords(n) {
  n = Math.round(n)
  if (n === 0) return 'ZERO RUPEES'
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
  function w(num) {
    if (num === 0) return ''
    if (num < 20) return ones[num] + ' '
    if (num < 100) return tens[Math.floor(num / 10)] + ' ' + (num % 10 ? ones[num % 10] + ' ' : '')
    if (num < 1000) return ones[Math.floor(num / 100)] + ' HUNDRED ' + (num % 100 ? w(num % 100) : '')
    if (num < 100000) return w(Math.floor(num / 1000)) + 'THOUSAND ' + w(num % 1000)
    if (num < 10000000) return w(Math.floor(num / 100000)) + 'LAKH ' + w(num % 100000)
    return w(Math.floor(num / 10000000)) + 'CRORE ' + w(num % 10000000)
  }
  return w(n).trim() + ' RUPEES'
}

function calcTotals(items, gstType, roundType) {
  let subtotal = 0
  const gstByRate = {}
  items.forEach(item => {
    // item.rate is GST-INCLUSIVE. Back out the taxable base from it.
    const totalIncl = item.qty * item.rate
    const base = totalIncl / (1 + item.gstRate / 100)
    subtotal += base
    const r = item.gstRate
    if (!gstByRate[r]) gstByRate[r] = 0
    gstByRate[r] += totalIncl - base
  })
  const totalGST = Object.values(gstByRate).reduce((a, b) => a + b, 0)
  const withGST = subtotal + totalGST
  let rounded = roundType === 'nearest' ? Math.round(withGST)
    : roundType === 'up' ? Math.ceil(withGST) : withGST
  const roundOff = rounded - withGST
  const rateLabel = Object.keys(gstByRate).length === 1
    ? Object.keys(gstByRate)[0] + '%' : 'Mixed'
  return { subtotal, totalGST, withGST, rounded, roundOff, rateLabel }
}

function fmt(cur, v) {
  return cur + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── LS KEY ────────────────────────────────────────────────────
const LS_KEY = 'arup_inv_counter'

// ══════════════════════════════════════════════════════════════
export default function InvoicePage() {
  // Tabs: editor | preview | history
  const [tab, setTab] = useState('editor')
  // ── Storage by Iswar connection ──
  const [storageConnected, setStorageConnected] = useState(false)
  const [storageKeySaved, setStorageKeySaved] = useState(false) // key DB me hai (valid ho ya na ho)
  const [storageChecking, setStorageChecking] = useState(true)
  const [storageKeyInput, setStorageKeyInput] = useState('')
  const [storageBusy, setStorageBusy] = useState(false)
  // ── Profile menu + Settings modal ──
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [billedByOpen, setBilledByOpen] = useState(false)
  const [billedBySaving, setBilledBySaving] = useState(false)
  const [billedByLoading, setBilledByLoading] = useState(true) // DB se aane tak skeleton

  // Billed By
  const [billedBy, setBilledBy] = useState(DEFAULT_BILLED_BY)

  // Billed To
  const [billedTo, setBilledTo] = useState(DEFAULT_BILLED_TO)

  // Invoice meta
  const [invPrefix, setInvPrefix] = useState('A')
  const [invNum, setInvNum] = useState(67) // 66 tak manual ho chuke — 67 se start
  const [invPad, setInvPad] = useState(5) // 5 digits → A00011
  const [dbSync, setDbSync] = useState(false) // true = counter DB se synced hai
  const [counterLoading, setCounterLoading] = useState(true) // DB se number aane tak skeleton
  const [counterDirty, setCounterDirty] = useState(false) // user ne number manually badla
  const [counterPushing, setCounterPushing] = useState(false) // manual number DB par push ho raha
  const [invDate, setInvDate] = useState(toISOLocal(new Date()))
  const [dueDate, setDueDate] = useState('')
  const [countrySupply, setCountrySupply] = useState('India')
  const [placeSupply, setPlaceSupply] = useState('Assam (18)')
  const [currency, setCurrency] = useState('₹')
  const [gstType, setGstType] = useState('intra')
  const [roundType, setRoundType] = useState('nearest')
  const [datePreset, setDatePreset] = useState('today')
  const [lastSavedNo, setLastSavedNo] = useState('—')

  // Items
  const [items, setItems] = useState([])

  // History
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // UI state
  const [toast, setToast] = useState(null)
  const [printProg, setPrintProg] = useState(null) // { pct, label } — print processing overlay
  const printRef = useRef(null)

  // Delete PIN popup
  const [savedInvoice, setSavedInvoice] = useState(null) // { id, no } — abhi save hui invoice (preview me delete ke liye)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinTarget, setPinTarget] = useState(null) // { id, no }
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', ''])
  const [pinError, setPinError] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const pinRefs = useRef([])

  // ── Invoice No computed ──────────────────────────────────
  const invNo = invPrefix + (invPad > 0 ? String(invNum).padStart(invPad, '0') : String(invNum))
  // Save / Print tabhi active jab saare required fields bhare hon (GSTIN + HSN/SAC optional)
  // Preview hamesha khula rehta hai
  const canSavePrint =
    (billedTo.name || '').trim() !== '' &&
    (billedTo.address || '').trim() !== '' &&
    (billedTo.state || '').trim() !== '' &&
    items.length > 0 &&
    items.every(it => (it.desc || '').trim() !== '' && Number(it.qty) > 0 && Number(it.rate) > 0)
  const savePrintHint = canSavePrint ? '' : 'Saare required fields bharo (GSTIN / HSN optional hai)'

  // ── Load counter: pehle DB se, fail ho to localStorage fallback ──
  useEffect(() => {
    let cancelled = false
    async function loadCounter() {
      try {
        const res = await fetch('/api/counter')
        if (!res.ok) throw new Error('counter api fail')
        const c = await res.json()
        if (cancelled) return
        setInvPrefix(c.prefix)
        setInvNum(c.next_num)
        setInvPad(c.pad)
        setDbSync(true)
        setCounterDirty(false)
        try { localStorage.setItem(LS_KEY, JSON.stringify({ prefix: c.prefix, num: c.next_num, pad: c.pad })) } catch {}
        if (!cancelled) setCounterLoading(false)
        return
      } catch { /* DB nahi mila — neeche LS fallback */ }
      try {
        const s = JSON.parse(localStorage.getItem(LS_KEY))
        if (s && !cancelled) {
          setInvPrefix(s.prefix)
          setInvNum(s.num)
          setInvPad(s.pad)
          setLastSavedNo(s.lastNo || '—')
        }
      } catch {}
      if (!cancelled) setCounterLoading(false)
    }
    loadCounter()
    // Storage by Iswar connection status (hamesha fresh — cache nahi)
    ;(async () => {
      try {
        const r = await fetch('/api/storage/status', { cache: 'no-store' })
        const s = await r.json()
        if (!cancelled) {
          setStorageConnected(!!s.connected)
          setStorageKeySaved(!!s.keySaved)
        }
      } catch {}
      if (!cancelled) setStorageChecking(false)
    })()
    // Billed By: database me saved hai to wahi lao
    // (☰ sidebar se update hota hai — code kholne ki zaroorat nahi)
    ;(async () => {
      try {
        const r = await fetch('/api/settings/billed-by')
        const s = await r.json()
        if (!cancelled && s.billedBy) setBilledBy(b => ({ ...b, ...s.billedBy }))
      } catch {}
      if (!cancelled) setBilledByLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // ── Print ke baad auto-next: DB se agla number lao ──
  useEffect(() => {
    async function onAfterPrint() {
      try {
        const res = await fetch('/api/counter')
        if (!res.ok) throw new Error('counter api fail')
        const c = await res.json()
        setInvPrefix(c.prefix)
        setInvNum(c.next_num)
        setInvPad(c.pad)
        setDbSync(true)
        setCounterDirty(false)
        showToast(`🖨️ Print ho gaya — agla number: ${c.next_no}`, 'info')
      } catch {
        setInvNum(n => n + 1) // DB nahi mila to local +1
        showToast('🖨️ Print ho gaya — agla number (local)', 'info')
      }
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  // ── Persist counter to LS on change ─────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY)) || {}
      localStorage.setItem(LS_KEY, JSON.stringify({ ...stored, prefix: invPrefix, num: invNum, pad: invPad }))
    } catch {}
  }, [invPrefix, invNum, invPad])

  // ── Toast helper ─────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Totals ───────────────────────────────────────────────
  const totals = calcTotals(items, gstType, roundType)

  // ── Items helpers ────────────────────────────────────────
  function updateItem(i, key, val) {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [key]: val }
      return next
    })
  }

  function addItem() {
    setItems(prev => [...prev, { ...EMPTY_ITEM }])
  }

  function delItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Date presets ─────────────────────────────────────────
  function applyPreset(preset) {
    setDatePreset(preset)
    if (preset === 'custom') return
    const now = new Date()
    let d = new Date(now)
    if (preset === 'yesterday') d.setDate(d.getDate() - 1)
    else if (preset === 'weekstart') d.setDate(d.getDate() - d.getDay() + 1)
    else if (preset === 'monthstart') d = new Date(now.getFullYear(), now.getMonth(), 1)
    setInvDate(toISOLocal(d))
  }

  // ── Auto increment (local skip — save par DB se pakka hoga) ──
  function autoIncrement() {
    const next = invNum + 1
    setInvNum(next)
    setCounterDirty(true)
    setLastSavedNo(invNo)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ prefix: invPrefix, num: next, pad: invPad, lastNo: invNo }))
    } catch {}
    showToast(`Invoice number → ${invPrefix}${invPad > 0 ? String(next).padStart(invPad, '0') : next}`, 'info')
  }

  // ── DB se counter dobara sync karo ──
  // ── Manual number DB par set karo (test reset ka jugaad) ──
  async function pushCounterToDb() {
    setCounterPushing(true)
    try {
      const res = await fetch('/api/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', prefix: invPrefix, num: invNum, pad: invPad }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'fail')
      setCounterDirty(false)
      setDbSync(true)
      showToast(`Counter DB me set — agla number: ${invNo}`, 'success')
    } catch (e) {
      showToast('Counter set fail: ' + e.message, 'error')
    } finally {
      setCounterPushing(false)
    }
  }

  async function resyncCounter() {
    try {
      const res = await fetch('/api/counter')
      if (!res.ok) throw new Error('counter api fail')
      const c = await res.json()
      setInvPrefix(c.prefix)
      setInvNum(c.next_num)
      setInvPad(c.pad)
      setDbSync(true)
      setCounterDirty(false)
      showToast(`DB se sync ho gaya — agla number: ${c.next_no}`, 'success')
    } catch {
      showToast('DB se connect nahi ho paya', 'error')
    }
  }

  // ── Save to Supabase (number DB se reserve — kabhi repeat nahi) ──
  // ── Invoice DB me save karo (helper — toast nahi, caller progress dikhata hai) ──
  // 409 (same number pehle se) aaye to purana delete karke naya save — DB hamesha latest rahe
  // Returns { ok, id, no } — fail par throw
  async function persistInvoiceToDb(onStage, opts = {}) {
    // 1) Invoice number DB se pakka karo (dobara print par naya number waste mat karo)
    let useNo = invNo
    let reserved = null
    if (!opts.skipReserve) {
      try {
        if (counterDirty) {
          // User ne number haath se badla tha — pehle DB ko usi se align karo
          await fetch('/api/counter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set', prefix: invPrefix, num: invNum, pad: invPad }),
          })
        }
        onStage && onStage('num')
        const r = await fetch('/api/counter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reserve' }),
        })
        if (!r.ok) throw new Error('reserve fail')
        const c = await r.json()
        reserved = c
        useNo = c.invoice_no
        setInvPrefix(c.prefix)
        setInvNum(c.num) // save ke baad yehi number dikhega (print ke liye)
        setInvPad(c.pad)
        setDbSync(true)
        setCounterDirty(false)
      } catch {
        throw new Error('DB se number reserve nahi hua — net check karo')
      }
    }

    // 2) Invoice save karo (upsert: 409 aaye to purana hata ke naya)
    const payload = {
      invoice_no: useNo,
      invoice_date: invDate,
      due_date: dueDate || null,
      billed_by: billedBy,
      billed_to: billedTo,
      items,
      gst_type: gstType,
      subtotal: totals.subtotal,
      total_gst: totals.totalGST,
      grand_total: totals.rounded,
      currency,
    }

    onStage && onStage('save')
    const postOnce = () => fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    let res = await postOnce()
    let data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const lr = await fetch('/api/invoices')
      const ld = await lr.json().catch(() => ({}))
      const old = (ld.invoices || []).find(i => i.invoice_no === useNo)
      if (old?.id) await fetch(`/api/invoice/${old.id}`, { method: 'DELETE' })
      res = await postOnce()
      data = await res.json().catch(() => ({}))
    }
    if (!res.ok) throw new Error(data.error || 'DB save fail')

    // Save counter to LS (backup)
    try {
      const bk = reserved || { prefix: invPrefix, num: invNum, pad: invPad }
      localStorage.setItem(LS_KEY, JSON.stringify({ prefix: bk.prefix, num: bk.num, pad: bk.pad, lastNo: useNo }))
      setLastSavedNo(useNo)
    } catch {}
    const rec = data.invoice?.id ? { id: data.invoice.id, no: useNo } : null
    setSavedInvoice(rec) // preview me delete button ke liye
    return { ok: true, id: rec?.id || null, no: useNo }
  }

  // ── Storage upload (XHR — REAL upload % ke liye) ──
  function uploadPdfBlob(blob, no, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/storage/upload')
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({}) }
        } else reject(new Error('Storage upload fail (' + xhr.status + ')'))
      }
      xhr.onerror = () => reject(new Error('Network error — upload nahi hua'))
      const fd = new FormData()
      fd.append('file', blob, `Invoice-${no}.pdf`)
      fd.append('invoice_no', no)
      xhr.send(fd)
    })
  }

  // ── PRINT: pehle DB save → phir storage upload → uske baad hi print dialog ──
  async function handlePrint() {
    if (!canSavePrint) { showToast('Pehle saare required fields bharo (GSTIN / HSN optional hai)', 'error'); return }
    if (printProg) return // already chal raha hai
    let finalNo = invNo
    try {
      setPrintProg({ pct: 3, label: 'Taiyaar ho raha...' })
      // 1) DB save (dobara print par same number → reserve skip, upsert se DB update)
      const alreadySaved = savedInvoice && savedInvoice.id && savedInvoice.no === invNo
      setPrintProg({ pct: 8, label: alreadySaved ? 'Database me update ho raha...' : 'Invoice number reserve ho raha...' })
      const saved = await persistInvoiceToDb(stage => {
        if (stage === 'save') setPrintProg({ pct: 24, label: 'Database me save ho raha...' })
      }, { skipReserve: !!alreadySaved })
      finalNo = saved.no
      setPrintProg({ pct: 44, label: `Database me save ho gaya ✓ (${finalNo})` })
      // 2) Storage by Iswar par PDF upload
      if (storageConnected) {
        setPrintProg({ pct: 52, label: 'PDF ban raha...' })
        const blob = await generatePdfBlob()
        if (!blob || blob.size < 1000) throw new Error('PDF blank bana — dobara try karo')
        setPrintProg({ pct: 60, label: 'Storage par upload ho raha... 0%' })
        await uploadPdfBlob(blob, finalNo, up => {
          const pct = Math.round(60 + up * 36)
          setPrintProg({ pct, label: `Storage par upload ho raha... ${Math.round(up * 100)}%` })
        })
        setPrintProg({ pct: 98, label: 'Storage par save ho gaya ✓' })
      } else {
        setPrintProg({ pct: 96, label: 'Storage connected nahi — seedha print hoga' })
      }
      setPrintProg({ pct: 100, label: 'Ho gaya! 🎉' })
      await new Promise(r => setTimeout(r, 450))
    } catch (e) {
      setPrintProg(null)
      showToast('❌ ' + (e.message || 'Print fail'), 'error')
      return
    }
    setPrintProg(null)
    setTimeout(() => window.print(), 150)
  }

  // ── Load history ──────────────────────────────────────────
  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/invoices')
      const data = await res.json()
      if (res.ok) setHistory(data.invoices || [])
      else showToast(data.error, 'error')
    } catch (e) {
      showToast('Error loading history', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  // ── Delete invoice (PIN popup ke saath) ──────────────────
  function askDelete(id, no) {
    setPinTarget({ id, no })
    setPinDigits(['', '', '', '', '', ''])
    setPinError('')
    setPinOpen(true)
    setTimeout(() => pinRefs.current[0]?.focus(), 60)
  }

  function closePin() {
    if (pinBusy) return
    setPinOpen(false)
    setPinTarget(null)
    setPinError('')
  }

  function handlePinChange(i, v) {
    const d = v.replace(/\D/g, '').slice(-1) // sirf ak digit
    const next = [...pinDigits]
    next[i] = d
    setPinDigits(next)
    setPinError('')
    if (d && i < 5) pinRefs.current[i + 1]?.focus()
    if (d && i === 5) {
      const full = next.join('')
      if (full.length === 6) setTimeout(() => submitPin(full), 120)
    }
  }

  function handlePinKeyDown(i, e) {
    if (e.key === 'Backspace' && !pinDigits[i] && i > 0) {
      pinRefs.current[i - 1]?.focus()
    }
    if (e.key === 'Enter') {
      const full = pinDigits.join('')
      if (full.length === 6) submitPin(full)
    }
  }

  function handlePinPaste(e) {
    e.preventDefault()
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!t) return
    const next = ['','','','','',''].map((_, i) => t[i] || '')
    setPinDigits(next)
    setPinError('')
    const last = Math.min(t.length, 6) - 1
    pinRefs.current[last]?.focus()
    if (t.length === 6) setTimeout(() => submitPin(t), 120)
  }

  function submitPin(override) {
    const full = override || pinDigits.join('')
    if (full.length !== 6 || pinBusy) return
    if (full === DELETE_PIN) {
      doDelete()
    } else {
      setPinError('❌ Galat PIN — dobara try karo')
      setPinDigits(['', '', '', '', '', ''])
      const box = document.querySelector('.pin-boxes')
      if (box) { box.classList.remove('pin-shake'); void box.offsetWidth; box.classList.add('pin-shake') }
      setTimeout(() => pinRefs.current[0]?.focus(), 60)
    }
  }

  async function doDelete() {
    if (!pinTarget) return
    setPinBusy(true)
    try {
      const res = await fetch(`/api/invoice/${pinTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setHistory(prev => prev.filter(inv => inv.id !== pinTarget.id))
      if (savedInvoice?.id === pinTarget.id) setSavedInvoice(null)
      showToast(`${pinTarget.no} deleted`, 'info')
      setPinOpen(false)
      setPinTarget(null)
    } catch (e) {
      setPinError('❌ ' + e.message)
    } finally {
      setPinBusy(false)
    }
  }

  // ── Switch to history tab → load ─────────────────────────
  function handleTabChange(t) {
    setTab(t)
    if (t === 'history') loadHistory()
  }

  // ── Storage by Iswar: Connect / Disconnect ─────────────────
  async function connectStorage() {
    if (!storageKeyInput.trim()) { showToast('Pehle key paste karo', 'error'); return }
    setStorageBusy(true)
    try {
      const res = await fetch('/api/storage/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_key: storageKeyInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) showToast(data.error || 'Connect fail', 'error')
      else {
        setStorageConnected(true)
        setStorageKeySaved(true)
        setStorageKeyInput('')
        showToast('☁️ Storage by Iswar connected!', 'success')
      }
    } catch (e) {
      showToast('Connect fail: ' + e.message, 'error')
    } finally {
      setStorageBusy(false)
    }
  }

  async function disconnectStorage() {
    if (!confirm('Storage disconnect karna hai?')) return
    setStorageBusy(true)
    try {
      const res = await fetch('/api/storage/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) showToast(data.error || 'Disconnect fail', 'error')
      else {
        setStorageConnected(false)
        setStorageKeySaved(false)
        showToast('Storage disconnected', 'info')
      }
    } catch (e) {
      showToast('Disconnect fail: ' + e.message, 'error')
    } finally {
      setStorageBusy(false)
    }
  }

  // ── Billed By → database save (☰ sidebar se, code khole bina) ──
  async function saveBilledBy() {
    setBilledBySaving(true)
    try {
      const res = await fetch('/api/settings/billed-by', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billedBy }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'save fail')
      showToast('✅ Billed By database me save ho gaya', 'success')
    } catch (e) {
      showToast('❌ Save nahi hua: ' + e.message, 'error')
    } finally {
      setBilledBySaving(false)
    }
  }

  // ── Print ─────────────────────────────────────────────────
  // Pehle invoice ka PDF banao → Storage by Iswar par save karo → phir print dialog
  async function generatePdfBlob() {
    // NOTE: html2pdf.js is intentionally NOT used here. It clones the source node
    // into its own container, and an absolutely-positioned source makes that
    // container collapse to height 0 -> html2canvas renders an empty canvas ->
    // blank PDF in Storage. Direct html2canvas + jsPDF avoids the clone entirely.
    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')
    const el = document.createElement('div')
    el.innerHTML = printHTML
    el.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;display:block;box-sizing:border-box;background:#ffffff;padding:36px;'
    document.body.appendChild(el)
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const M = 10, pageW = 210 - M * 2, pageH = 297 - M * 2
      const pxPerMm = canvas.width / pageW
      const pagePxH = Math.floor(pageH * pxPerMm)
      let rendered = 0, first = true
      while (rendered < canvas.height) {
        const sliceH = Math.min(pagePxH, canvas.height - rendered)
        const page = document.createElement('canvas')
        page.width = canvas.width
        page.height = sliceH
        page.getContext('2d').drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
        if (!first) pdf.addPage()
        pdf.addImage(page.toDataURL('image/jpeg', 0.95), 'JPEG', M, M, pageW, sliceH / pxPerMm)
        first = false
        rendered += sliceH
      }
      return pdf.output('blob')
    } finally {
      document.body.removeChild(el)
    }
  }

  // (print flow upar handlePrint me hai — DB save → storage upload → print dialog)

  // ── BUILD PRINT HTML ─────────────────────────────────────
  const { subtotal, totalGST, rounded, roundOff, rateLabel } = totals
  const cur = currency

  const itemRowsHtml = items.map((item, i) => {
    const total = item.qty * item.rate // rate is GST-inclusive
    const base = total / (1 + item.gstRate / 100)
    const gstAmt = total - base
    return `<tr>
      <td>${i + 1}</td>
      <td>${item.desc}${item.hsn ? `<br><small style="color:#999">HSN: ${item.hsn}</small>` : ''}</td>
      <td>${item.gstRate}%</td>
      <td class="right">${item.qty}</td>
      <td class="right">${fmt(cur, item.rate)}</td>
      <td class="right">${fmt(cur, base)}</td>
      ${gstType === 'intra'
        ? `<td class="right">${fmt(cur, gstAmt / 2)}</td><td class="right">${fmt(cur, gstAmt / 2)}</td>`
        : `<td class="right" colspan="2">${fmt(cur, gstAmt)}</td>`}
      <td class="right">${fmt(cur, total)}</td>
    </tr>`
  }).join('')

  const gstHeaders = gstType === 'intra'
    ? `<th class="right">CGST</th><th class="right">SGST</th>`
    : `<th class="right" colspan="2">IGST</th>`

  const gstSummaryHtml = gstType === 'intra'
    ? `<div class="pv-sum-row"><span>CGST (${rateLabel}/2)</span><span class="v">${fmt(cur, totalGST / 2)}</span></div>
       <div class="pv-sum-row"><span>SGST (${rateLabel}/2)</span><span class="v">${fmt(cur, totalGST / 2)}</span></div>`
    : `<div class="pv-sum-row"><span>IGST (${rateLabel})</span><span class="v">${fmt(cur, totalGST)}</span></div>`

  const printHTML = `
    <div class="pv-header">
      <div>
        <div class="pv-title">INVOICE</div>
        <div class="supply-row">
          <span>Country of Supply: <strong>${countrySupply}</strong></span>
          <span>Place of Supply: <strong>${placeSupply}</strong></span>
        </div>
      </div>
      <div class="pv-invoice-no">
        <div class="no"># ${invNo}</div>
        <div style="font-size:0.82rem;color:#666;margin-top:4px">${fmtDate(invDate)}</div>
        ${dueDate ? `<div style="font-size:0.8rem;color:#999">Due: ${fmtDate(dueDate)}</div>` : ''}
      </div>
    </div>
    <div class="pv-parties">
      <div class="pv-party">
        <h3>Billed By</h3>
        <div class="name">${billedBy.name}</div>
        <p>${billedBy.address.replace(/\n/g, '<br>')}</p>
        ${billedBy.gstin ? `<p style="margin-top:6px"><strong>GSTIN:</strong> ${billedBy.gstin}</p>` : ''}
        ${billedBy.pan ? `<p><strong>PAN:</strong> ${billedBy.pan}</p>` : ''}
        ${billedBy.email ? `<p><strong>Email:</strong> ${billedBy.email}</p>` : ''}
        ${billedBy.phone ? `<p><strong>Phone:</strong> ${billedBy.phone}</p>` : ''}
      </div>
      <div class="pv-party">
        <h3>Billed To</h3>
        <div class="name">${billedTo.name}</div>
        <p>${billedTo.address.replace(/\n/g, '<br>')}</p>
        ${billedTo.gstin ? `<p style="margin-top:6px"><strong>GSTIN:</strong> ${billedTo.gstin}</p>` : ''}
        ${billedTo.state ? `<p><strong>State:</strong> ${billedTo.state}</p>` : ''}
      </div>
    </div>
    <table class="pv-table">
      <thead><tr><th>#</th><th>Description</th><th>GST%</th><th class="right">Qty</th><th class="right">Rate (incl. GST)</th><th class="right">Taxable Amount</th>${gstHeaders}<th class="right">Total</th></tr></thead>
      <tbody>${itemRowsHtml}</tbody>
    </table>
    <div class="pv-summary">
      <div class="pv-sum-box">
        <div class="pv-sum-row"><span>Subtotal (excl. GST)</span><span class="v">${fmt(cur, subtotal)}</span></div>
        ${gstSummaryHtml}
        <div class="pv-sum-row"><span>Total GST</span><span class="v">${fmt(cur, totalGST)}</span></div>
        ${Math.abs(roundOff) > 0.001 ? `<div class="pv-sum-row"><span>Round Off</span><span class="v">${roundOff >= 0 ? '+' : ''}${fmt(cur, Math.abs(roundOff))}</span></div>` : ''}
        <div class="pv-sum-row grand"><span>GRAND TOTAL</span><span class="v">${fmt(cur, rounded)}</span></div>
      </div>
    </div>
    <div class="pv-words">Amount in Words: <strong>${numberToWords(rounded)}</strong></div>
    ${billedBy.bank ? `<div class="pv-bank"><h4>Bank / Payment Details</h4><p>${billedBy.bank}</p></div>` : ''}
    <div class="pv-footer"><p>This is an electronically generated document, no signature is required.</p></div>
  `

  // ══════════════════════════════════════════════════════════
  return (
    <>
      {/* ── PRINT VIEW (hidden, shows on print) ── */}
      <div className="print-view show" ref={printRef} dangerouslySetInnerHTML={{ __html: printHTML }} />

      {/* ── MAIN APP ── */}
      <div className="app no-print">
        {/* ── STICKY TOP BAR ── */}
        <div className="topbar">
          <button className="icon-btn" onClick={() => setBilledByOpen(true)} title="Billed By (Seller)" aria-label="Menu">
            ☰
          </button>
          <h1>⚡ Invoice Generator</h1>
          {/* ── Profile (Google style) : menu → Settings → Storage connect ── */}
          <div className="profile-wrap">
            <button className="profile-btn" onClick={() => setProfileOpen(o => !o)} title="Profile" aria-label="Profile menu">
              <span className="profile-avatar">A</span>
              {storageConnected && <span className="profile-dot" title="Storage connected" />}
            </button>
            {profileOpen && (
              <>
                <div className="menu-scrim" onClick={() => setProfileOpen(false)} />
                <div className="profile-menu">
                  <button className="menu-item" onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}>
                    ⚙️ Settings
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── SETTINGS MODAL ── */}
        {settingsOpen && (
          <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
            <div className="modal-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <h2>⚙️ Settings</h2>
                <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close">✕</button>
              </div>
              <div className="modal-body">
                

                {/* ── STORAGE CARD ── */}
                <div className="settings-card">
                  <div className="settings-card-head-static">
                    <span className="settings-card-icon">☁️</span>
                    <h3>Storage by Iswar</h3>
                    {storageConnected
                      ? <span className="settings-badge">Connected</span>
                      : (!storageChecking && storageKeySaved && <span className="settings-badge settings-badge-warn">Key saved</span>)}
                  </div>
                  <div className="settings-card-body">
                  {storageChecking ? (
                    <div className="skeleton" style={{ height: 42, borderRadius: 9 }}>&nbsp;</div>
                  ) : storageConnected ? (
                    <div className="storage-row">
                      <span className="settings-note">Print par PDF auto-save hoga.</span>
                      <button className="btn btn-outline" disabled={storageBusy} onClick={disconnectStorage}>
                        {storageBusy ? '⏳...' : 'Disconnect'}
                      </button>
                    </div>
                  ) : storageKeySaved ? (
                    <>
                      <div className="settings-note" style={{ marginBottom: 10 }}>
                        ⚠️ Key database me <strong>save hai</strong>, par abhi verify nahi ho rahi — Storage app me
                        <strong> Settings → Your personal API key</strong> check karo. Badal gayi ho to neeche nayi paste karo.
                      </div>
                      <div className="storage-row">
                        <input
                          type="password"
                          placeholder="Nayi API key"
                          value={storageKeyInput}
                          onChange={e => setStorageKeyInput(e.target.value)}
                          style={{ flex: 1, minWidth: 180 }}
                        />
                        <button className="btn btn-primary" disabled={storageBusy} onClick={connectStorage}>
                          {storageBusy ? '⏳...' : '🔗 Connect'}
                        </button>
                      </div>
                      <div className="storage-row" style={{ marginTop: 10 }}>
                        <button className="btn btn-outline" disabled={storageBusy} onClick={disconnectStorage}>
                          {storageBusy ? '⏳...' : 'Disconnect'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="settings-note" style={{ marginBottom: 10 }}>
                        Storage app → <strong>Settings → Your personal API key</strong> se key copy karke yahan paste karo.
                      </div>
                      <div className="storage-row">
                        <input
                          type="password"
                          placeholder="API key"
                          value={storageKeyInput}
                          onChange={e => setStorageKeyInput(e.target.value)}
                          style={{ flex: 1, minWidth: 180 }}
                        />
                        <button className="btn btn-primary" disabled={storageBusy} onClick={connectStorage}>
                          {storageBusy ? '⏳...' : '🔗 Connect'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── BILLED BY SIDEBAR ── */}
        {billedByOpen && (
          <div className="sidebar-overlay" onClick={() => setBilledByOpen(false)}>
            <div className="sidebar-panel" onClick={e => e.stopPropagation()}>
              <div className="sidebar-head">
                <h2>🏢 Billed By (Seller)</h2>
                <button className="modal-close" onClick={() => setBilledByOpen(false)} aria-label="Close">✕</button>
              </div>
              <div className="sidebar-body">
                {billedByLoading ? (
                  <>
                    {['Business Name', 'Address', 'GSTIN', 'PAN', 'Email', 'Phone', 'Bank Details'].map(f => (
                      <div className="field" key={f}>
                        <label>{f}</label>
                        <div className="skeleton" style={{ height: f === 'Address' ? 66 : 40, borderRadius: 9 }}>&nbsp;</div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                  <div className="field">
                  <label>Business Name</label>
                  <input value={billedBy.name} onChange={e => setBilledBy(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="field">
                  <label>Address</label>
                  <textarea rows={3} value={billedBy.address} onChange={e => setBilledBy(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="field">
                  <label>GSTIN</label>
                  <input value={billedBy.gstin} onChange={e => setBilledBy(p => ({ ...p, gstin: e.target.value }))} />
                  </div>
                  <div className="field">
                  <label>PAN</label>
                  <input value={billedBy.pan} onChange={e => setBilledBy(p => ({ ...p, pan: e.target.value }))} />
                  </div>
                  <div className="field">
                  <label>Email</label>
                  <input value={billedBy.email} onChange={e => setBilledBy(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="field">
                  <label>Phone</label>
                  <input value={billedBy.phone} onChange={e => setBilledBy(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="field">
                  <label>Bank Details</label>
                  <input value={billedBy.bank} onChange={e => setBilledBy(p => ({ ...p, bank: e.target.value }))} />
                  </div>
                <button className="btn btn-primary" disabled={billedBySaving} onClick={saveBilledBy} style={{ marginTop: 6 }}>
                  {billedBySaving ? '⏳ Saving...' : '💾 Database me Save karo'}
                </button>
                <div className="settings-note">Ye details database me save hongi — har device par same dikhengi, code kholne ki zaroorat nahi.</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="tabs">
          {['editor', 'preview', 'history'].map(t => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => handleTabChange(t)}>
              {t === 'editor' ? '✏️ Editor' : t === 'preview' ? '👁️ Preview' : '🗂️ History'}
            </button>
          ))}
        </div>

        {/* ══ EDITOR TAB ══ */}
        {tab === 'editor' && (
          <>
            {/* INVOICE DETAILS */}
            <CollapsibleCard icon="📄" title="Invoice Details" defaultOpen={true}>

                {/* Invoice Number */}
                <div style={{ background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>Invoice Number</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="field" style={{ flex: 1, minWidth: 100 }}>
                      <label>Prefix</label>
                      <input value={invPrefix} onChange={e => { setInvPrefix(e.target.value); setCounterDirty(true) }} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 90 }}>
                      <label>Number</label>
                      <input type="number" value={invNum} min={1} onChange={e => { setInvNum(parseInt(e.target.value) || 1); setCounterDirty(true) }} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 90 }}>
                      <label>Padding</label>
                      <select value={invPad} onChange={e => { setInvPad(parseInt(e.target.value)); setCounterDirty(true) }} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        <option value={3}>3 → 001</option>
                        <option value={4}>4 → 0001</option>
                        <option value={5}>5 → 00001</option>
                        <option value={0}>None → 1</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Preview</label>
                      {counterLoading ? (
                        <div className="skeleton" style={{ height: 40, borderRadius: 7 }}>&nbsp;</div>
                      ) : (
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.05rem', fontWeight: 600, color: 'var(--accent)', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', letterSpacing: 1 }}>
                          {invNo}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-outline" style={{ height: 38, whiteSpace: 'nowrap' }} onClick={autoIncrement}>⚡ Next No.</button>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Last saved:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--ink)', background: '#fff', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px' }}>{lastSavedNo}</span>
                    <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={resyncCounter}>↻ DB Sync {dbSync ? '🟢' : '🟠'}</button>
                    {counterDirty && (
                      <button className="btn btn-accent" style={{ padding: '4px 10px', fontSize: '0.75rem' }} disabled={counterPushing} onClick={pushCounterToDb}>
                        {counterPushing ? '⏳...' : '💾 DB par set karo'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div style={{ background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>Invoice Date</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {['today', 'yesterday', 'weekstart', 'monthstart', 'custom'].map(p => (
                      <button key={p} className={`date-preset-btn${datePreset === p ? ' active' : ''}`} onClick={() => applyPreset(p)}>
                        {{ today: 'Today', yesterday: 'Yesterday', weekstart: 'Week Start', monthstart: 'Month Start', custom: 'Custom ✏️' }[p]}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className="field" style={{ flex: 1, minWidth: 160 }}>
                      <label>Selected Date</label>
                      <input type="date" value={invDate} onChange={e => { setInvDate(e.target.value); setDatePreset('custom') }} />
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 160 }}>
                      <label>Due Date (optional)</label>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="grid3">
                  <div className="field">
                    <label>Country of Supply</label>
                    <input value={countrySupply} onChange={e => setCountrySupply(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Place of Supply</label>
                    <input value={placeSupply} onChange={e => setPlaceSupply(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}>
                      <option value="₹">₹ INR</option>
                      <option value="$">$ USD</option>
                      <option value="€">€ EUR</option>
                    </select>
                  </div>
                </div>
            </CollapsibleCard>

            {/* BILLED TO */}
            <CollapsibleCard icon="🏛️" title="Billed To (Client)">
                <div className="grid2">
                  <div className="field col-span2">
                    <label>Client / Organisation Name</label>
                    <input value={billedTo.name} onChange={e => setBilledTo(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="field col-span2">
                    <label>Address</label>
                    <textarea value={billedTo.address} onChange={e => setBilledTo(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>GSTIN (optional)</label>
                    <input value={billedTo.gstin} onChange={e => setBilledTo(p => ({ ...p, gstin: e.target.value }))} placeholder="Client GSTIN if applicable" />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <input value={billedTo.state} onChange={e => setBilledTo(p => ({ ...p, state: e.target.value }))} />
                  </div>
                </div>
            </CollapsibleCard>

            {/* ITEMS */}
            <CollapsibleCard icon="📦" title="Items / Services" defaultOpen={true}>
                <div className="items-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}>#</th>
                        <th>Description</th>
                        <th style={{ width: 90 }}>HSN/SAC</th>
                        <th style={{ width: 70 }}>Qty</th>
                        <th style={{ width: 110 }}>Rate (incl. GST)</th>
                        <th style={{ width: 90 }}>GST%</th>
                        <th style={{ width: 120 }}>Amount (incl. GST)</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--muted)', fontSize: '0.9rem' }}>
                            Koi item nahi — neeche <b>＋ Add Item</b> dabakar item jodo
                          </td>
                        </tr>
                      )}
                      {items.map((item, i) => {
                        const total = item.qty * item.rate // rate is GST-inclusive
                        return (
                          <tr key={i}>
                            <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                            <td><input value={item.desc} onChange={e => updateItem(i, 'desc', e.target.value)} /></td>
                            <td><input value={item.hsn} onChange={e => updateItem(i, 'hsn', e.target.value)} /></td>
                            <td><input type="number" value={item.qty} min={0} step={0.01}
                              onFocus={e => e.target.select()}
                              onChange={e => { const v = e.target.value; updateItem(i, 'qty', v === '' ? '' : (parseFloat(v) || 0)) }}
                              onBlur={e => { if (e.target.value === '') updateItem(i, 'qty', 0) }} /></td>
                            <td><input type="number" value={item.rate} min={0} step={0.01}
                              onFocus={e => e.target.select()}
                              onChange={e => { const v = e.target.value; updateItem(i, 'rate', v === '' ? '' : (parseFloat(v) || 0)) }}
                              onBlur={e => { if (e.target.value === '') updateItem(i, 'rate', 0) }} /></td>
                            <td>
                              <select value={item.gstRate} onChange={e => updateItem(i, 'gstRate', parseFloat(e.target.value))}>
                                {[0, 3, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                            <td className="td-num">{fmt(cur, total)}</td>
                            <td><button className="btn-del" onClick={() => delItem(i)}>✕</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="btn-row">
                  <button className="btn btn-outline" onClick={addItem}>＋ Add Item</button>
                </div>
            </CollapsibleCard>

            {/* GST SUMMARY */}
            <CollapsibleCard icon="🧮" title="Tax & Total Summary" defaultOpen={true}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="field" style={{ marginBottom: 14 }}>
                      <label>GST Type</label>
                      <select value={gstType} onChange={e => setGstType(e.target.value)}>
                        <option value="intra">Intra-State (CGST + SGST)</option>
                        <option value="inter">Inter-State (IGST)</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Round Off</label>
                      <select value={roundType} onChange={e => setRoundType(e.target.value)}>
                        <option value="nearest">Round to nearest ₹</option>
                        <option value="up">Round up</option>
                        <option value="none">No rounding</option>
                      </select>
                    </div>
                  </div>
                  <div className="summary-box" style={{ flex: 1, minWidth: 260 }}>
                    <div className="summary-row">
                      <span>Subtotal (without GST)</span>
                      <span className="val">{fmt(cur, subtotal)}</span>
                    </div>
                    {gstType === 'intra' ? (<>
                      <div className="summary-row">
                        <span>CGST <span className="gst-badge">{rateLabel}/2</span></span>
                        <span className="val">{fmt(cur, totalGST / 2)}</span>
                      </div>
                      <div className="summary-row">
                        <span>SGST <span className="gst-badge">{rateLabel}/2</span></span>
                        <span className="val">{fmt(cur, totalGST / 2)}</span>
                      </div>
                    </>) : (
                      <div className="summary-row">
                        <span>IGST <span className="gst-badge">{rateLabel}</span></span>
                        <span className="val">{fmt(cur, totalGST)}</span>
                      </div>
                    )}
                    <div className="summary-row">
                      <span>Total GST</span>
                      <span className="val">{fmt(cur, totalGST)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Round Off</span>
                      <span className="val">{roundOff >= 0 ? '+' : ''}{fmt(cur, Math.abs(roundOff))}</span>
                    </div>
                    <div className="summary-row total">
                      <span>GRAND TOTAL</span>
                      <span className="val">{fmt(cur, rounded)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 4 }}>Amount in Words</div>
                  <div style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>{numberToWords(rounded)}</div>
                </div>
            </CollapsibleCard>

            {/* bottom spacer for fixed footer */}
            <div style={{ height: 80 }} />
          </>
        )}

        {/* ══ PREVIEW TAB ══ */}
        {tab === 'preview' && (
          <>
            <div className="btn-row" style={{ marginBottom: 16 }}>
              <button className="btn btn-outline" onClick={() => setTab('editor')}>← Back</button>
            </div>
            <div className="card">
              <div className="card-body">
                {(counterLoading || billedByLoading) ? (
                  <div style={{ padding: 8 }}>
                    <div className="skeleton" style={{ height: 28, width: '55%', marginBottom: 14, borderRadius: 6 }}>&nbsp;</div>
                    <div className="skeleton" style={{ height: 90, marginBottom: 14, borderRadius: 8 }}>&nbsp;</div>
                    <div className="skeleton" style={{ height: 90, marginBottom: 14, borderRadius: 8 }}>&nbsp;</div>
                    <div className="skeleton" style={{ height: 160, marginBottom: 14, borderRadius: 8 }}>&nbsp;</div>
                    <div className="skeleton" style={{ height: 60, borderRadius: 8 }}>&nbsp;</div>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: printHTML }} />
                )}
              </div>
            </div>
            {/* bottom spacer for fixed footer */}
            <div style={{ height: 80 }} />
          </>
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab === 'history' && (
          <div className="card">
            <div className="card-header">
              <span className="icon">🗂️</span>
              <h2>Saved Invoices</h2>
              <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: '0.78rem' }} onClick={loadHistory}>🔄 Refresh</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {historyLoading ? (
                <div style={{ padding: '14px 16px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skeleton" style={{ height: 46, marginBottom: 10, borderRadius: 8 }}>&nbsp;</div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="history-empty">Koi invoice save nahi hai abhi.</div>
              ) : (
                <div className="history-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Billed To</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(inv => (
                      <tr key={inv.id}>
                        <td className="mono">{inv.invoice_no}</td>
                        <td>{fmtDate(inv.invoice_date)}</td>
                        <td>{inv.billed_to?.name || '—'}</td>
                        <td className="mono">{inv.currency || '₹'}{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>
                          <button className="btn-del" onClick={() => askDelete(inv.id, inv.invoice_no)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed-action-bar no-print">
        {tab === 'editor' && (
          <>
            <button className="btn btn-primary" onClick={() => handleTabChange('preview')}>👁️ Preview</button>
            <button className="btn btn-outline" disabled={!canSavePrint} title={savePrintHint} onClick={handlePrint}>🖨️ Print / PDF</button>
          </>
        )}
        {tab === 'preview' && (
          <>
            <button className="btn btn-outline" onClick={() => setTab('editor')}>← Editor</button>
            <button className="btn btn-primary" disabled={!canSavePrint} title={savePrintHint} onClick={handlePrint}>🖨️ Print / PDF</button>
            {savedInvoice && (
              <button className="btn-del" style={{ padding: '10px 14px', fontSize: '1rem' }} title={`${savedInvoice.no} delete karo`} onClick={() => askDelete(savedInvoice.id, savedInvoice.no)}>🗑</button>
            )}
          </>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}

      {/* PRINT PROCESSING OVERLAY — blur + real % bar */}
      {printProg && (
        <div className="proc-overlay no-print">
          <div className="proc-card">
            <span className="proc-icon">⚙️</span>
            <div className="proc-label">{printProg.label}</div>
            <div className="proc-bar">
              <div className="proc-fill" style={{ width: `${printProg.pct}%` }} />
            </div>
            <div className="proc-pct">{printProg.pct}%</div>
          </div>
        </div>
      )}

      {/* DELETE PIN POPUP */}
      {pinOpen && pinTarget && (
        <div className="modal-overlay" onClick={closePin}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-head">
              <h2>🗑️ Delete Invoice</h2>
              <button className="modal-close" onClick={closePin} aria-label="Close">✕</button>
            </div>
            <div style={{ padding: '18px 20px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 4 }}>
                Invoice <strong className="mono">{pinTarget.no}</strong> delete karna hai?
              </div>
              <div className="settings-note" style={{ marginBottom: 4 }}>Ye action wapas nahi hoga. Confirm karne ke liye 6-digit PIN dalo:</div>
              <div className="pin-boxes" onPaste={handlePinPaste}>
                {pinDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => (pinRefs.current[i] = el)}
                    className="pin-box"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    disabled={pinBusy}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    onFocus={e => e.target.select()}
                    aria-label={`PIN digit ${i + 1}`}
                  />
                ))}
              </div>
              <div className="pin-error">{pinError || '\u00A0'}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} disabled={pinBusy} onClick={closePin}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, background: '#b91c1c', borderColor: '#b91c1c' }}
                  disabled={pinBusy || pinDigits.join('').length !== 6}
                  onClick={() => submitPin()}
                >
                  {pinBusy ? '⏳...' : '🗑️ Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


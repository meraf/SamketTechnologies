// Check.et payment verification (https://check.et). The API key is a SERVER secret (CHECK_ET_API_KEY), never sent to the browser.
//   POST {base}/verify
//     JSON      { bank, transaction_number, account_number? }        verify by bank + reference
//     multipart receipt_file (+ receipt_text for JPG/PNG/WEBP, bank?, account_number?)   verify a receipt PDF / screenshot
//
// Per-bank rules (the cause of the old "hit-or-miss" results):
//   telebirr  reference only
//   cbe       reference only (receipt link or FT... id). Legacy FT receipts also need OUR receiving account, last 8+ digits
//   cbebirr   reference + the payer's phone as 251XXXXXXXXX (NOT a bank account)
//   boa       reference + OUR receiving account number (Bank of Abyssinia)
//   awash / dashen / mpesa   reference (account sent when we have one, retried without it)
// CBE and CBE Birr are two separate platforms with separate codes and separate rules.
import { normPhone } from './phone.js'

const BASE = () => (process.env.CHECK_ET_URL || 'https://api.check.et/api/v1').replace(/\/+$/, '')

/** Our bank names -> Check.et bank codes. Banks without a code cannot be verified by reference. */
export const BANK_CODE = {
  'Telebirr': 'telebirr',
  'CBE': 'cbe',
  'CBE Birr': 'cbebirr',
  'M-Pesa': 'mpesa',
  'Bank of Abyssinia': 'boa',
  'Awash Bank': 'awash',
  'Dashen Bank': 'dashen',
}

// Accept the common spellings staff / older sales may have saved ("Commercial Bank of Ethiopia" is CBE, never CBE Birr).
const ALIAS = {
  'telebirr': 'Telebirr', 'tele birr': 'Telebirr',
  'cbe': 'CBE', 'commercial bank of ethiopia': 'CBE', 'cbe bank': 'CBE',
  'cbe birr': 'CBE Birr', 'cbebirr': 'CBE Birr', 'cbe-birr': 'CBE Birr',
  'm-pesa': 'M-Pesa', 'mpesa': 'M-Pesa', 'm pesa': 'M-Pesa',
  'bank of abyssinia': 'Bank of Abyssinia', 'abyssinia': 'Bank of Abyssinia', 'boa': 'Bank of Abyssinia',
  'awash': 'Awash Bank', 'awash bank': 'Awash Bank',
  'dashen': 'Dashen Bank', 'dashen bank': 'Dashen Bank',
}
export const bankCode = (name) => {
  const n = String(name || '').trim()
  if (BANK_CODE[n]) return BANK_CODE[n]
  const a = ALIAS[n.toLowerCase().replace(/\s+/g, ' ')]
  return a ? BANK_CODE[a] : null
}

export const configured = () => !!process.env.CHECK_ET_API_KEY

const digits = (s) => String(s || '').replace(/\D/g, '')
const cleanRef = (s) => String(s || '').trim().replace(/\s+/g, '')

/** Every `account_number` worth trying for this bank, best first ('' = send none).
 *  CBE Birr uses the payer phone. Everything else uses OUR saved receiving accounts (all of them, FULL number first,
 *  then the last 8 digits), so a saved account on the Cash page is always passed on, never "missing". */
function accountsFor(code, x) {
  if (code === 'cbebirr') {
    const p = normPhone(x.phone) // 09XXXXXXXX -> 251 9XXXXXXXX
    return [p ? '251' + String(p).replace(/^0+/, '').replace(/^251/, '') : '']
  }
  const list = [...(Array.isArray(x.accounts) ? x.accounts : []), x.account].map(digits).filter((a) => a.length >= 4)
  const full = [...new Set(list)]
  const tail = [...new Set(full.map((a) => a.slice(-8)).filter((a) => a.length >= 4))]
  return [...full, ...tail]
}

async function call(init) {
  const r = await fetch(BASE() + '/verify', { ...init, signal: AbortSignal.timeout(25000) })
  const body = await r.json().catch(() => ({ success: false, message: 'Unreadable response from the verification service' }))
  return { http: r.status, body }
}

const failMsg = (code, b, http) => {
  const m = (b && (b.message || b.error)) || ''
  const hint =
    code === 'cbebirr' ? ' CBE Birr needs the customer phone number on the sale (the payer).' :
    code === 'cbe' ? ' The saved CBE account was tried; check that its number on the Cash page is the full receiving account.' :
    code === 'boa' ? ' Bank of Abyssinia needs our receiving account saved on the Cash page.' : ''
  return (m || `Transaction not verified (HTTP ${http})`) + (m && /account|phone/i.test(m) ? hint : '')
}

/** x = { bank, ref, account, phone, file: { b64, type, name }, text }. Returns { http, body } (body = Check.et JSON). */
export async function verify(x) {
  const code = bankCode(x.bank)
  const headers = { Authorization: 'Bearer ' + process.env.CHECK_ET_API_KEY, Accept: 'application/json' }
  const accts = accountsFor(code, x)
  const account = accts[0] || ''

  if (x.file && x.file.b64) {
    const buf = Buffer.from(x.file.b64, 'base64')
    const upload = (acct) => {
      const fd = new FormData() // a FormData body can only be sent once, so rebuild it per attempt
      fd.append('receipt_file', new Blob([buf], { type: x.file.type || 'application/octet-stream' }), x.file.name || 'receipt')
      if (x.text) fd.append('receipt_text', String(x.text).slice(0, 50000))
      if (code) fd.append('bank', code)
      if (acct) fd.append('account_number', acct)
      return call({ method: 'POST', headers, body: fd })
    }
    // CBE: receipt alone first, then with each saved account (full number, then last 8). Others: account first.
    const order = [...new Set(code === 'cbe' ? ['', ...accts] : code === 'cbebirr' ? accts : [...accts, ''])].slice(0, 6)
    let out = null
    for (const acct of order.length ? order : ['']) {
      try {
        out = await upload(acct)
      } catch (e) {
        out = { http: 0, body: { success: false, message: 'Could not reach the verification service' } }
      }
      if (out.body && out.body.success) break
      if (out.http === 401 || out.http === 403 || out.http === 429) break
    }
    if (out.body && out.body.success === false) out.body = { ...out.body, message: failMsg(code, out.body, out.http), bank_code: code }
    return out
  }

  if (!code) return { http: 400, body: { success: false, message: `${x.bank || 'This bank'} is not supported for automatic reference checks. Upload the receipt image or PDF instead, or complete the sale unverified.` } }
  const ref = cleanRef(x.ref)
  if (!ref) return { http: 400, body: { success: false, message: 'Enter the transaction reference number.' } }

  const send = (acct) => {
    const body = { bank: code, transaction_number: ref }
    if (acct) body.account_number = acct
    return call({ method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }
  // CBE: reference alone first (modern receipts), then with our account for legacy FT references.
  // Other banks: with the account first, then without it. A failed first try never ends the check early.
  const tries = [...new Set(code === 'cbe' ? ['', ...accts] : code === 'cbebirr' ? accts : [...accts, ''])].slice(0, 6)
  let last = null
  for (const acct of tries) {
    try {
      last = await send(acct)
    } catch (e) {
      last = { http: 0, body: { success: false, message: 'Could not reach the verification service' } }
    }
    if (last.body && last.body.success) break
    if (last.http === 401 || last.http === 403 || last.http === 429) break // retrying cannot help
  }
  if (last.body && last.body.success === false) last.body = { ...last.body, message: failMsg(code, last.body, last.http), bank_code: code }
  return last
}

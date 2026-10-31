// Check.et payment verification (https://docs.check.et). The API key is a SERVER secret (CHECK_ET_API_KEY), never sent to the browser.
//   POST {base}/verify
//     JSON      { bank, transaction_number, account_number? }        verify by bank + reference
//     multipart receipt_file (+ receipt_text for JPG/PNG/WEBP, bank?, account_number?)   verify a receipt PDF / screenshot
import { normPhone } from './phone.js'

const BASE = () => (process.env.CHECK_ET_URL || 'https://api.check.et/api/v1').replace(/\/+$/, '')

/** Our bank names -> Check.et bank codes. Banks without a code cannot be verified by reference. */
export const BANK_CODE = {
  'Telebirr': 'telebirr',
  'CBE Birr': 'cbebirr',
  'M-Pesa': 'mpesa',
  'Bank of Abyssinia': 'boa',
  'Awash Bank': 'awash',
  'Dashen Bank': 'dashen',
}

export const configured = () => !!process.env.CHECK_ET_API_KEY

/** x = { bank, ref, account, phone, file: { b64, type, name }, text }. Returns { http, body } (body = Check.et JSON). */
export async function verify(x) {
  const code = BANK_CODE[x.bank] || null
  const headers = { Authorization: 'Bearer ' + process.env.CHECK_ET_API_KEY, Accept: 'application/json' }
  // CBE Birr wants the payer's phone as 251XXXXXXXXX; CBE and Abyssinia want OUR receiving account number.
  const account = code === 'cbebirr' ? (normPhone(x.phone) ? '251' + normPhone(x.phone).slice(1) : '') : String(x.account || '').replace(/\s+/g, '')
  let init
  if (x.file && x.file.b64) {
    const fd = new FormData()
    fd.append('receipt_file', new Blob([Buffer.from(x.file.b64, 'base64')], { type: x.file.type || 'application/octet-stream' }), x.file.name || 'receipt')
    if (x.text) fd.append('receipt_text', String(x.text).slice(0, 50000))
    if (code) fd.append('bank', code)
    if (account) fd.append('account_number', account)
    init = { method: 'POST', headers, body: fd }
  } else {
    if (!code) return { http: 400, body: { success: false, message: `${x.bank || 'This bank'} is not supported for reference checks. Upload the receipt instead.` } }
    const body = { bank: code, transaction_number: String(x.ref || '').trim() }
    if (account) body.account_number = account
    init = { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  }
  const r = await fetch(BASE() + '/verify', { ...init, signal: AbortSignal.timeout(25000) })
  const body = await r.json().catch(() => ({ success: false, message: 'Unreadable response from the verification service' }))
  return { http: r.status, body }
}

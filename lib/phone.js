// Shared by the browser (src/) and the server (lib/): one definition of "the same phone number".
// 0924598198, +251 92 459 8198, 251924598198 and 924598198 all normalise to 0924598198.
export const normPhone = v => {
  let d = String(v || '').replace(/\D/g, '')
  if (d.startsWith('251') && d.length === 12) d = '0' + d.slice(3)
  else if (d.length === 9 && /^[79]/.test(d)) d = '0' + d
  return d
}
export const phoneOk = v => normPhone(v).length >= 9

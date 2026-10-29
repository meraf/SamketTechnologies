const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** SKT-XXXXXXXX: random, unguessable ticket numbers (32 symbols, no 0/O/1/I). fill() must write random bytes. */
export const newTicketCode = (fill = b => globalThis.crypto.getRandomValues(b), n = 8) => {
  const b = new Uint8Array(n); fill(b)
  return 'SKT-' + [...b].map(x => A[x & 31]).join('')
}

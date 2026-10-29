// Shared by the browser (src/) and the server (lib/).
// Bootstrap sync key: used when a device has no key of its own and the server has no SYNC_KEY / rotated key.
export const DEFAULT_SYNC_KEY = '50d86f9a1edc45c8a0b0180ea9245db4b50fd175d1baea60157a8eebe6cb2501'
// After an admin rotates the key, devices still holding the previous key can sync (and learn the new key) for this long.
export const KEY_GRACE_MS = 14 * 864e5

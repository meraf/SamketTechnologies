import fs from 'fs'

/** Minimal .env loader (no dependency). Real environment variables always win. */
export function loadEnv(file = '.env') {
  try {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(l => {
      const m = l.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
  } catch {}
}

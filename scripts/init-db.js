// npm run db:init  -> creates the tables in the database named by DATABASE_URL
import { loadEnv } from '../lib/env.js'
loadEnv()
const { ready, getPool } = await import('../lib/db.js')
await ready()
console.log('Tables are ready.')
await getPool().end()

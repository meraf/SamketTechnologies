// Vercel serverless entry: every /api/* request lands here.
import { handle } from '../lib/handler.js'

export default function handler(req, res) {
  return handle(req, res)
}

import { destroySession } from '../_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' })
    return
  }
  try {
    await destroySession(req, res)
    res.status(204).end()
  } catch (error) {
    console.error('logout failed:', error.message)
    res.status(500).json({ error: 'Server error' })
  }
}

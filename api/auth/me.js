import { getUserFromRequest } from '../_lib/session.js'

// Returns the logged-in user, or 401.
export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      res.status(401).json({ error: 'Not logged in' })
      return
    }
    res.status(200).json({
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url },
    })
  } catch (error) {
    console.error('me failed:', error.message)
    res.status(500).json({ error: 'Server error' })
  }
}

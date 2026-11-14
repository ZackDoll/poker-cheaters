import { getUserFromRequest } from './session.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Reads a query-string id and rejects anything that is not a UUID, so a bad id is a 400
// rather than a database error.
export function idFrom(value, label = 'id') {
  const id = Array.isArray(value) ? value[0] : value
  if (typeof id !== 'string' || !UUID.test(id)) throw new HttpError(400, `Invalid ${label}`)
  return id
}

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value)
}

// Wraps a set of method handlers into one Vercel function that requires a login.
//   export default route({ GET: async ({ user, query }) => data, POST: ... })
// A handler gets { user, body, query, res } and returns the JSON to send. Call
// res.statusCode = 201 first to change the status. Throw HttpError for expected failures.
export function route(handlers) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const run = handlers[req.method]
      if (!run) {
        res.setHeader('Allow', Object.keys(handlers).join(', '))
        throw new HttpError(405, 'Method not allowed')
      }
      const user = await getUserFromRequest(req, res)
      if (!user) throw new HttpError(401, 'Not logged in')
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const data = await run({ user, body, query: req.query ?? {}, res })
      res.status(res.statusCode || 200).json(data ?? null)
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      console.error(`${req.method} ${req.url} failed:`, error.message)
      res.status(500).json({ error: 'Server error' })
    }
  }
}

import { OAuth2Client } from 'google-auth-library'
import { getRedirectUri } from './session.js'

export function createGoogleClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(),
  )
}

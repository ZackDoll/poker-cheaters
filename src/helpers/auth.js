import api from './api.js'

// Returns the logged-in user ({ id, email, name, avatarUrl }) or null.
export async function getCurrentUser() {
  try {
    const response = await api.get('/auth/me')
    return response.data.user
  } catch (error) {
    if (error.response?.status === 401) return null
    throw error
  }
}

export async function logout() {
  await api.post('/auth/logout')
}

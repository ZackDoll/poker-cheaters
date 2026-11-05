import axios from 'axios'

// Shared axios instance. All API queries should go through this.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

export async function get(path, params) {
  const response = await api.get(path, { params })
  return response.data
}

export default api

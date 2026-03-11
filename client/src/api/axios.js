import axios from 'axios'

const normalizeBaseUrl = (raw) => {
  if (!raw) return '/api'
  const trimmed = String(raw).replace(/\/+$/, '')
  // If user already provided /api, keep it
  if (trimmed.endsWith('/api')) return trimmed
  // If user provided a full origin (http://localhost:5000), append /api
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return `${trimmed}/api`
  // If user provided a path, ensure it ends with /api
  return `${trimmed}/api`
}

const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URI),
  withCredentials: true,
})

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh token on 401
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`
            return api(original)
          })
          .catch((err) => Promise.reject(err))
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await api.post('/auth/refresh', {})
        const newToken = data.accessToken
        localStorage.setItem('accessToken', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (err) {
        processQueue(err, null)
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
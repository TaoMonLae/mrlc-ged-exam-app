import { clearAuth } from './auth'

export async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })

  const data = await res.json().catch(() => ({}))

  // Expired or invalid token — clear session and redirect to login
  if (res.status === 401) {
    clearAuth()
    // Only redirect if we're not already on the login page
    if (window.location.pathname !== '/') {
      window.location.href = '/'
    }
    throw new Error(data.error || 'Session expired. Please log in again.')
  }

  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

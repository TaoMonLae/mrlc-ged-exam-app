const KEY = 'mrlc_auth'

export function saveAuth(auth) {
  localStorage.setItem(KEY, JSON.stringify(auth))
}

export function loadAuth() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function clearAuth() {
  localStorage.removeItem(KEY)
}

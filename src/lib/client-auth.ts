export function getToken(): string {
  if (typeof document === 'undefined') return ''
  return document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1')
}

export function getEmail(): string {
  if (typeof document === 'undefined') return ''
  return decodeURIComponent(
    document.cookie.replace(/(?:(?:^|.*;\s*)email\s*=\s*([^;]*).*$)|^.*$/, '$1')
  )
}

export function clearAuthCookies() {
  document.cookie = 'token=; path=/; max-age=0; SameSite=strict'
  document.cookie = 'email=; path=/; max-age=0; SameSite=strict'
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const EVALUATION_FEE_LABEL = '₹4,999'

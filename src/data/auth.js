import { ref } from 'vue'

// Fake login for the static prototype. Only emails listed under Settings > Team can log in; the OTP is 123456.

const AUTH_KEY = 'bsv_auth_email'
const PENDING_KEY = 'bsv_pending_email'

export const DEMO_OTP = '123456'

function read(key) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Storage blocked (private mode): login still works until the tab closes
  }
}

export const authEmail = ref(read(AUTH_KEY))

export function isLoggedIn() {
  return !!authEmail.value
}

export function setLoggedIn(email) {
  authEmail.value = email || ''
  write(AUTH_KEY, authEmail.value)
}

export function setPendingEmail(email) {
  write(PENDING_KEY, email)
}

export function getPendingEmail() {
  return read(PENDING_KEY)
}

export function clearPendingEmail() {
  write(PENDING_KEY, '')
}

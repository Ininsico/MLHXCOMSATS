import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ quiet: true })

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const TEST_EMAIL = 'smoke.test@aurora.local'
const TEST_PASSWORD = 'smoke-pass-123'

const jar = new Map()
let failures = 0

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

function grabCookies(res) {
  for (const cookie of res.headers.getSetCookie()) {
    const [pair] = cookie.split(';')
    const [key, ...rest] = pair.split('=')
    jar.set(key.trim(), rest.join('=').trim())
  }
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  grabCookies(res)

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  return { status: res.status, json }
}

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} (got ${actual}, expected ${expected})`)
}

console.log(`Aurora auth smoke test against ${BASE}\n`)

const signup = await call('/api/auth/signup', {
  method: 'POST',
  body: { name: 'Smoke Test', email: TEST_EMAIL, password: TEST_PASSWORD },
})
check('signup creates the account', signup.status, 201)
check('signup does not leak the password hash', signup.json?.data?.user?.passwordHash, undefined)

check('me returns the signed-in user', (await call('/api/auth/me')).status, 200)

const duplicate = await call('/api/auth/signup', {
  method: 'POST',
  body: { name: 'Smoke Test', email: TEST_EMAIL, password: TEST_PASSWORD },
})
check('duplicate signup is rejected', duplicate.status, 409)

const invalid = await call('/api/auth/signup', {
  method: 'POST',
  body: { name: '', email: 'not-an-email', password: 'short' },
})
check('signup validation rejects bad input', invalid.status, 400)

const wrongPassword = await call('/api/auth/signin', {
  method: 'POST',
  body: { email: TEST_EMAIL, password: 'wrong-password' },
})
check('wrong password is rejected', wrongPassword.status, 401)

const signin = await call('/api/auth/signin', {
  method: 'POST',
  body: { email: TEST_EMAIL, password: TEST_PASSWORD },
})
check('signin works', signin.status, 200)

check('signout clears the session', (await call('/api/auth/signout', { method: 'POST' })).status, 204)
check('me is unauthorized after signout', (await call('/api/auth/me')).status, 401)
check('health endpoint responds', (await call('/api/health')).status, 200)

await mongoose.connect(process.env.MONGODB_URI)
const cleanup = await mongoose.connection.collection('users').deleteOne({ email: TEST_EMAIL })
await mongoose.disconnect()
console.log(`\ncleanup: removed ${cleanup.deletedCount} smoke account(s) from the database`)

if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
console.log('All smoke checks passed.')

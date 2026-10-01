require('dotenv').config({ quiet: true })

const bcrypt = require('bcryptjs')
const createApp = require('./app')
const User = require('./models/user')
const { connectDb } = require('./lib/db')

const port = Number(process.env.PORT) || 3000

async function ensureMainAdmin() {
  const email = (process.env.MAIN_ADMIN_EMAIL || '').trim().toLowerCase()

  if (!email) {
    console.warn('MAIN_ADMIN_EMAIL is not set — skipping the main admin bootstrap.')
    return
  }

  const password = process.env.MAIN_ADMIN_PASSWORD || ''
  const passwordHash = password ? await bcrypt.hash(password, 10) : null
  const existing = await User.findOne({ email })

  if (!existing) {
    await User.create({
      name: 'Aurora Admin',
      email,
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
      ...(passwordHash ? { passwordHash } : {}),
    })
    console.log('Main admin account is ready.')
    return
  }

  existing.role = 'admin'
  existing.status = 'active'
  if (!existing.emailVerifiedAt) existing.emailVerifiedAt = new Date()
  if (passwordHash) existing.passwordHash = passwordHash
  await existing.save()
  console.log('Main admin account is ready.')
}

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — copy it into backend/.env')
  }

  await connectDb(process.env.MONGODB_URI)
  await ensureMainAdmin()

  const app = createApp()
  app.listen(port, () => {
    console.log(`Aurora API listening on http://localhost:${port}`)
  })
}

start().catch((err) => {
  console.error('Failed to start Aurora API:', err.message)
  process.exit(1)
})

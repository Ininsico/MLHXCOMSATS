const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const authRoutes = require('./routes/auth')
const hospitalRoutes = require('./routes/hospitals')
const adminRoutes = require('./routes/admin')
const staffRoutes = require('./routes/staff')
const inventoryRoutes = require('./routes/inventory')
const labRoutes = require('./routes/lab')
const appointmentRoutes = require('./routes/appointments')
const doctorRoutes = require('./routes/doctor')
const marketplaceRoutes = require('./routes/marketplace')
const voiceRoutes = require('./routes/voice')
const nurseRoutes = require('./routes/nurse')
const auroraRoutes = require('./routes/aurora')
const whatsappRoutes = require('./routes/whatsapp')
const patientRoutes = require('./routes/patient')
const doctorCareRoutes = require('./routes/doctor-care')
const operationsRoutes = require('./routes/operations')
const adminPlatformRoutes = require('./routes/admin-platform')
const emergencyRoutes = require('./routes/emergency')
const waitlistRoutes = require('./routes/waitlist')
const paymentRoutes = require('./routes/payments')
const uploadRoutes = require('./routes/uploads')
const aiRoutes = require('./routes/ai')
const { notFound, errorHandler } = require('./middleware/error')
const { ensureIds } = require('./lib/serializer')

// Every model is loaded by now: give each schema a stable `id` in its JSON output.
ensureIds()

function createApp() {
  const app = express()
  app.disable('x-powered-by')

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())

  app.use(cors({ origin: corsOrigins, credentials: true }))
  app.use(cookieParser())

  // Image uploads and clinical AI both carry base64 payloads, so they get a larger
  // parser and must be registered before the global 100kb JSON limit.
  app.use('/api/uploads', uploadRoutes)
  app.use('/api/ai', express.json({ limit: '12mb' }), aiRoutes)

  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (req, res) => {
    res.json({ data: { status: 'ok', uptime: process.uptime() } })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/hospitals', hospitalRoutes)
  app.use('/api/staff', staffRoutes)
  app.use('/api/inventory', inventoryRoutes)
  app.use('/api/lab', labRoutes)
  app.use('/api/appointments', appointmentRoutes)
  app.use('/api/doctor', doctorRoutes)
  app.use('/api/doctor', doctorCareRoutes)
  app.use('/api/operations', operationsRoutes)
  app.use('/api/emergency', emergencyRoutes)
  app.use('/api/waitlist', waitlistRoutes)
  app.use('/api/payments', paymentRoutes)
  app.use('/api/marketplace', marketplaceRoutes)
  app.use('/api/voice', voiceRoutes)
  app.use('/api/nurse', nurseRoutes)
  app.use('/api/aurora', auroraRoutes)
  app.use('/api/whatsapp', whatsappRoutes)
  app.use('/api/patients', patientRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/admin', adminPlatformRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

module.exports = createApp

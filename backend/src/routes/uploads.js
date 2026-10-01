const express = require('express')
const { uploadImage } = require('../lib/cloudinary')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

router.post(
  '/image',
  express.json({ limit: '8mb' }),
  requireAuth,
  requireRole('hospital', 'admin'),
  async (req, res) => {
    const result = await uploadImage(req.body?.dataUrl)
    res.status(201).json({ data: result })
  },
)

module.exports = router

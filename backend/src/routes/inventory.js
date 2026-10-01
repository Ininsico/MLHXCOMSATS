const express = require('express')
const mongoose = require('mongoose')
const InventoryItem = require('../models/inventory-item')
const HttpError = require('../lib/http-error')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')
const requireHospital = require('../middleware/require-hospital')

const router = express.Router()

const MOVEMENT_TYPES = ['in', 'out', 'adjust']

router.use(requireAuth, requireRole('hospital'), requireHospital)

function readItem(body, { partial = false } = {}) {
  const details = []
  const updates = {}

  const text = (field, min, max, required) => {
    const value = body?.[field]
    if (value === undefined) {
      if (!partial && required) details.push({ field, message: 'Required.' })
      return
    }
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed.length < min || trimmed.length > max) {
      details.push({ field, message: `Must be ${min}-${max} characters.` })
      return
    }
    updates[field] = field === 'sku' ? trimmed.toUpperCase() : trimmed
  }

  text('name', 2, 120, true)
  text('sku', 0, 40, false)
  text('category', 2, 60, false)
  text('unit', 1, 20, false)
  text('location', 0, 80, false)

  const number = (field, min, max, required) => {
    const value = body?.[field]
    if (value === undefined) {
      if (!partial && required) details.push({ field, message: 'Required.' })
      return
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      details.push({ field, message: `Must be a number between ${min} and ${max}.` })
      return
    }
    updates[field] = parsed
  }

  number('quantity', 0, 1_000_000, true)
  number('reorderLevel', 0, 1_000_000, false)

  if (details.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please check the form and try again.', details)
  }

  return updates
}

router.get('/', async (req, res) => {
  const items = await InventoryItem.find({ hospital: req.hospital._id }).sort({ name: 1 })
  const low = items.filter((item) => item.quantity <= item.reorderLevel).length

  res.json({ data: items, meta: { count: items.length, low } })
})

router.post('/', async (req, res) => {
  const updates = readItem(req.body)
  const item = await InventoryItem.create({ ...updates, hospital: req.hospital._id })
  res.status(201).json({ data: item })
})

router.patch('/:itemId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Item not found.')
  }

  const item = await InventoryItem.findOne({ _id: req.params.itemId, hospital: req.hospital._id })
  if (!item) {
    throw new HttpError(404, 'NOT_FOUND', 'Item not found.')
  }

  item.set(readItem(req.body, { partial: true }))
  await item.save()

  res.json({ data: item })
})

router.post('/:itemId/movements', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Item not found.')
  }

  const item = await InventoryItem.findOne({ _id: req.params.itemId, hospital: req.hospital._id })
  if (!item) {
    throw new HttpError(404, 'NOT_FOUND', 'Item not found.')
  }

  const type = req.body?.type
  const quantity = Number(req.body?.quantity)
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 120) : ''

  if (!MOVEMENT_TYPES.includes(type)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a movement type.', [
      { field: 'type', message: `One of: ${MOVEMENT_TYPES.join(', ')}.` },
    ])
  }
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a quantity.', [
      { field: 'quantity', message: 'A number between 0 and 1,000,000.' },
    ])
  }

  if (type === 'in') item.quantity += quantity
  else if (type === 'out') item.quantity = Math.max(0, item.quantity - quantity)
  else item.quantity = quantity

  item.movements.push({
    type,
    quantity,
    reason,
    by: req.user.name ?? '',
    at: new Date(),
  })
  item.movements = item.movements.slice(-25)
  await item.save()

  res.json({ data: item })
})

router.delete('/:itemId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Item not found.')
  }

  const removed = await InventoryItem.findOneAndDelete({
    _id: req.params.itemId,
    hospital: req.hospital._id,
  })

  if (!removed) {
    throw new HttpError(404, 'NOT_FOUND', 'Item not found.')
  }

  res.status(204).end()
})

module.exports = router

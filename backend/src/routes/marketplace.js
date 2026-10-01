const express = require('express')
const mongoose = require('mongoose')
const Listing = require('../models/listing')
const Hospital = require('../models/hospital')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const { CATEGORIES, CONDITIONS } = require('../lib/marketplace')
const { sendEmailQuietly } = require('../lib/mailer')
const { listingReservedEmail } = require('../lib/emails')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')
const requireHospital = require('../middleware/require-hospital')

const router = express.Router()

router.use(requireAuth)

const asHospital = [requireRole('hospital'), requireHospital]

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readListing(body, { partial = false } = {}) {
  const details = []
  const updates = {}

  if (body?.title !== undefined || !partial) {
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    if (title.length < 4 || title.length > 120) {
      details.push({ field: 'title', message: 'Give the listing a title of 4-120 characters.' })
    } else {
      updates.title = title
    }
  }

  if (body?.description !== undefined || !partial) {
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    if (description.length < 20 || description.length > 800) {
      details.push({ field: 'description', message: 'Describe the equipment in 20-800 characters.' })
    } else {
      updates.description = description
    }
  }

  if (body?.category !== undefined || !partial) {
    if (!CATEGORIES.includes(body?.category)) {
      details.push({ field: 'category', message: 'Choose a category.' })
    } else {
      updates.category = body.category
    }
  }

  if (body?.condition !== undefined) {
    if (!CONDITIONS.includes(body.condition)) {
      details.push({ field: 'condition', message: 'Choose new, refurbished, or used.' })
    } else {
      updates.condition = body.condition
    }
  }

  if (body?.price !== undefined || !partial) {
    const price = Number(body?.price)
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000_000) {
      details.push({ field: 'price', message: 'Enter a price.' })
    } else {
      updates.price = price
    }
  }

  if (body?.images !== undefined) {
    const list = Array.isArray(body.images) ? body.images : null
    const valid =
      list && list.length <= 3 && list.every((url) => typeof url === 'string' && url.startsWith('https://') && url.length <= 500)

    if (!valid) {
      details.push({ field: 'images', message: 'Up to 3 https image URLs.' })
    } else {
      updates.images = list
    }
  }

  if (details.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please check the listing and try again.', details)
  }

  return updates
}

/** Reservations older than this lapse on their own, so stock never stays stuck. */
const RESERVATION_DAYS = Number(process.env.MARKETPLACE_RESERVATION_DAYS || 7)

async function expireStaleReservations() {
  const cutoff = new Date(Date.now() - RESERVATION_DAYS * 86400000)

  await Listing.updateMany(
    { status: 'reserved', reservedAt: { $lt: cutoff } },
    { $set: { status: 'available', buyer: null, reservedAt: null } },
  )
}

router.get('/', requireRole('hospital', 'admin'), async (req, res) => {
  await expireStaleReservations()

  const filter = {
    status: ['available', 'reserved', 'sold'].includes(req.query.status)
      ? req.query.status
      : 'available',
  }

  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category
  if (CONDITIONS.includes(req.query.condition)) filter.condition = req.query.condition

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ title: pattern }, { description: pattern }]
  }

  const listings = await Listing.find(filter)
    .populate('seller', 'name city area')
    .populate('buyer', 'name city')
    .sort({ createdAt: -1 })
    .limit(100)

  res.json({ data: listings, meta: { count: listings.length } })
})

router.get('/mine', asHospital, async (req, res) => {
  const [selling, bought] = await Promise.all([
    Listing.find({ seller: req.hospital._id })
      .populate('buyer', 'name city')
      .sort({ createdAt: -1 }),
    Listing.find({ buyer: req.hospital._id })
      .populate('seller', 'name city area')
      .sort({ updatedAt: -1 }),
  ])

  res.json({ data: { selling, bought }, meta: { selling: selling.length, bought: bought.length } })
})

router.post('/', asHospital, async (req, res) => {
  const updates = readListing(req.body)

  const listing = await Listing.create({
    ...updates,
    seller: req.hospital._id,
    status: 'available',
  })

  res.status(201).json({ data: listing })
})

router.patch('/:listingId', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const listing = await Listing.findOne({ _id: req.params.listingId, seller: req.hospital._id })
  if (!listing) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  listing.set(readListing(req.body, { partial: true }))

  if (req.body?.status !== undefined) {
    if (!['available', 'sold'].includes(req.body.status)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Sellers can mark a listing sold or available.', [
        { field: 'status', message: 'Use sold or available.' },
      ])
    }
    listing.status = req.body.status
    listing.soldAt = req.body.status === 'sold' ? new Date() : null
    if (req.body.status === 'available') {
      listing.buyer = null
      listing.reservedAt = null
    }
  }

  await listing.save()
  res.json({ data: listing })
})

router.delete('/:listingId', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const removed = await Listing.findOneAndDelete({
    _id: req.params.listingId,
    seller: req.hospital._id,
  })

  if (!removed) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  res.status(204).end()
})

router.post('/:listingId/reserve', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const listing = await Listing.findById(req.params.listingId)

  if (!listing) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  if (listing.seller.equals(req.hospital._id)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'This listing is already yours.')
  }

  if (listing.status !== 'available') {
    throw new HttpError(409, 'CONFLICT', 'That listing is no longer available.')
  }

  listing.buyer = req.hospital._id
  listing.status = 'reserved'
  listing.reservedAt = new Date()
  await listing.save()

  const seller = await Hospital.findById(listing.seller).select('owner name')

  if (seller?.owner) {
    const sellerAccount = await seller.populate('owner', 'email')

    if (sellerAccount.owner?.email) {
      sendEmailQuietly({
        to: sellerAccount.owner.email,
        ...listingReservedEmail({
          listingTitle: listing.title,
          hospitalName: req.hospital.name,
        }),
      })
    }
  }

  res.json({ data: listing })
})

router.post('/:listingId/release', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const listing = await Listing.findById(req.params.listingId)

  if (!listing) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const isSeller = listing.seller.equals(req.hospital._id)
  const isBuyer = listing.buyer?.equals(req.hospital._id)

  if (!isSeller && !isBuyer) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the buyer or the seller can release this listing.')
  }

  listing.buyer = null
  listing.status = 'available'
  listing.reservedAt = null
  await listing.save()

  res.json({ data: listing })
})

// ---------------------------------------------------------------- offers

const ListingOffer = require('../models/listing-offer')

/** Make an offer — the price is a negotiation, not a checkout. */
router.post('/:listingId/offers', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const listing = await Listing.findById(req.params.listingId)

  if (!listing) throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')

  if (listing.seller.equals(req.hospital._id)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'This listing is already yours.')
  }

  if (listing.status === 'sold') {
    throw new HttpError(409, 'CONFLICT', 'That item has already been sold.')
  }

  const amount = Number(req.body?.amount)

  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter an offer amount.', [
      { field: 'amount', message: 'A positive number.' },
    ])
  }

  const open = await ListingOffer.findOne({
    listing: listing._id,
    buyer: req.hospital._id,
    status: 'pending',
  })

  if (open) {
    open.amount = amount
    open.message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 400) : open.message
    await open.save()

    return res.json({ data: open, meta: { updated: true } })
  }

  const offer = await ListingOffer.create({
    listing: listing._id,
    buyer: req.hospital._id,
    buyerName: req.hospital.name,
    amount,
    message: typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 400) : '',
  })

  await Listing.updateOne({ _id: listing._id }, { $inc: { offerCount: 1 } })

  await audit.record(req, {
    action: 'marketplace.offer_made',
    subjectType: 'Listing',
    subjectId: listing._id,
    summary: `${req.hospital.name} offered ${amount} for "${listing.title}"`,
  })

  res.status(201).json({ data: offer })
})

/** Seller sees every offer; a buyer sees their own. */
router.get('/:listingId/offers', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const listing = await Listing.findById(req.params.listingId)

  if (!listing) throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')

  const isSeller = listing.seller.equals(req.hospital._id)
  const filter = { listing: listing._id }

  if (!isSeller) filter.buyer = req.hospital._id

  const offers = await ListingOffer.find(filter).populate('buyer', 'name city area').sort({ createdAt: -1 })

  res.json({ data: offers, meta: { count: offers.length, seller: isSeller } })
})

/** Accepting an offer reserves the item at that price and declines the rest. */
router.patch('/offers/:offerId', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.offerId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Offer not found.')
  }

  const action = ['accept', 'decline', 'withdraw'].includes(req.body?.action) ? req.body.action : null

  if (!action) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send action: accept, decline or withdraw.')
  }

  const offer = await ListingOffer.findById(req.params.offerId)

  if (!offer) throw new HttpError(404, 'NOT_FOUND', 'Offer not found.')

  const listing = await Listing.findById(offer.listing)

  if (!listing) throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')

  const isSeller = listing.seller.equals(req.hospital._id)
  const isBuyer = offer.buyer.equals(req.hospital._id)

  if (action === 'withdraw') {
    if (!isBuyer) throw new HttpError(403, 'FORBIDDEN', 'Only the buyer can withdraw their offer.')
    offer.status = 'withdrawn'
  } else {
    if (!isSeller) throw new HttpError(403, 'FORBIDDEN', 'Only the seller can decide on an offer.')

    if (action === 'accept') {
      if (listing.status === 'sold') throw new HttpError(409, 'CONFLICT', 'That item is already sold.')

      offer.status = 'accepted'
      listing.buyer = offer.buyer
      listing.status = 'reserved'
      listing.reservedAt = new Date()
      await listing.save()

      await ListingOffer.updateMany(
        { listing: listing._id, _id: { $ne: offer._id }, status: 'pending' },
        { $set: { status: 'declined', decidedAt: new Date() } },
      )
    } else {
      offer.status = 'declined'
    }
  }

  offer.decidedAt = new Date()
  await offer.save()

  await audit.record(req, {
    action: `marketplace.offer_${offer.status}`,
    subjectType: 'Listing',
    subjectId: listing._id,
    summary: `${req.hospital.name} ${offer.status} an offer of ${offer.amount} on "${listing.title}"`,
  })

  res.json({ data: offer })
})

/** Handover: the buyer or the seller closes the sale and the price is recorded. */
router.post('/:listingId/complete', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')
  }

  const listing = await Listing.findById(req.params.listingId)

  if (!listing) throw new HttpError(404, 'NOT_FOUND', 'Listing not found.')

  const isSeller = listing.seller.equals(req.hospital._id)
  const isBuyer = listing.buyer?.equals(req.hospital._id)

  if (!isSeller && !isBuyer) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the buyer or the seller can complete this sale.')
  }

  if (listing.status === 'sold') {
    throw new HttpError(409, 'CONFLICT', 'That sale is already closed.')
  }

  const accepted = await ListingOffer.findOne({ listing: listing._id, status: 'accepted' })
  const soldPrice = Number.isFinite(Number(req.body?.soldPrice))
    ? Number(req.body.soldPrice)
    : (accepted?.amount ?? listing.price)

  listing.status = 'sold'
  listing.soldAt = new Date()
  listing.soldPrice = soldPrice
  await listing.save()

  await audit.record(req, {
    action: 'marketplace.sale_completed',
    subjectType: 'Listing',
    subjectId: listing._id,
    summary: `"${listing.title}" sold for ${soldPrice}`,
  })

  res.json({ data: listing })
})

module.exports = router

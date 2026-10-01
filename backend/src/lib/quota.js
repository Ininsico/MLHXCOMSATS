/**
 * Monthly token quotas per hospital.
 *
 * The hospital's plan carries a `tokenQuota`; usage is summed from the channels that
 * are attributable to a hospital (today: its WhatsApp threads). Channels that cannot
 * be attributed yet are still metered on the admin dashboard — they are simply not
 * capped, which is stated rather than implied.
 */

const mongoose = require('mongoose')
const Hospital = require('../models/hospital')
const WhatsappThread = require('../models/whatsapp-thread')

const DEFAULT_QUOTA = Number(process.env.AI_TOKEN_QUOTA || 2_000_000)

function monthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

async function usageFor(hospitalId) {
  const [row] = await WhatsappThread.aggregate([
    { $match: { hospital: hospitalId, lastMessageAt: { $gte: monthStart() } } },
    { $group: { _id: null, tokens: { $sum: '$totalTokens' }, threads: { $sum: 1 } } },
  ])

  return { tokens: row?.tokens ?? 0, threads: row?.threads ?? 0 }
}

/**
 * Returns { allowed, limit, used, remaining, enforced }. Never throws: a quota read
 * failing must not take the channel down, so it allows and reports `enforced: false`.
 */
async function checkQuota(hospitalId) {
  if (!hospitalId) return { allowed: true, enforced: false, limit: null, used: 0, remaining: null }

  try {
    // `subscription` lives outside the Hospital schema (strict mode would hide it),
    // so the quota is read from the collection directly — same reason the admin
    // endpoint writes through the collection.
    const hospital = await Hospital.collection.findOne(
      { _id: new mongoose.Types.ObjectId(String(hospitalId)) },
      { projection: { name: 1, subscription: 1 } },
    )

    if (!hospital) return { allowed: true, enforced: false, limit: null, used: 0, remaining: null }

    const limit = Number(hospital.subscription?.tokenQuota) || DEFAULT_QUOTA
    const { tokens, threads } = await usageFor(hospital._id)

    return {
      allowed: tokens < limit,
      enforced: true,
      limit,
      used: tokens,
      threads,
      remaining: Math.max(0, limit - tokens),
    }
  } catch (error) {
    console.error('Quota check failed:', error.message)
    return { allowed: true, enforced: false, limit: null, used: 0, remaining: null }
  }
}

async function setQuota(hospitalId, tokenQuota) {
  await Hospital.collection.updateOne(
    { _id: hospitalId },
    { $set: { 'subscription.tokenQuota': Number(tokenQuota) } },
  )
}

module.exports = { checkQuota, setQuota, usageFor, DEFAULT_QUOTA }

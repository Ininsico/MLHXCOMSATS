/**
 * RabbitMQ publisher for the Node side (amqplib).
 *
 * Mirrors ai-service/app/queue.py: durable messages on the same `aurora.ai.jobs`
 * queue, so the Python worker can consume what the API publishes. If the broker is
 * down the publish is logged and skipped — the request path never fails.
 */

const amqp = require('amqplib')

const BROKER_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672'
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'aurora.ai.jobs'

async function publish(payload) {
  try {
    const connection = await amqp.connect(BROKER_URL)
    const channel = await connection.createChannel()

    try {
      await channel.assertQueue(QUEUE_NAME, { durable: true })
      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        persistent: true,
      })
    } finally {
      await channel.close().catch(() => {})
      await connection.close().catch(() => {})
    }

    return true
  } catch (error) {
    console.warn(`RabbitMQ publish skipped (${error.code || error.message})`)
    return false
  }
}

async function status() {
  try {
    const connection = await amqp.connect(BROKER_URL)
    const channel = await connection.createChannel()

    try {
      const declared = await channel.assertQueue(QUEUE_NAME, { durable: true })
      return { connected: true, queue: QUEUE_NAME, messages: declared.messageCount }
    } finally {
      await channel.close().catch(() => {})
      await connection.close().catch(() => {})
    }
  } catch (error) {
    return { connected: false, queue: QUEUE_NAME, reason: error.message }
  }
}

module.exports = { publish, status, QUEUE_NAME }

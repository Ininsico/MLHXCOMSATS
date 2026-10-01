const mongoose = require('mongoose')

async function connectDb(uri) {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message)
  })

  await mongoose.connect(uri)
  return mongoose.connection
}

module.exports = { connectDb }

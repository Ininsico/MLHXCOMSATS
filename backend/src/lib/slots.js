const Appointment = require('../models/appointment')

function pad(value) {
  return String(value).padStart(2, '0')
}

const TIMES = (() => {
  const times = []

  for (let hour = 9; hour <= 17; hour += 1) {
    times.push(`${pad(hour)}:00`)
    if (hour !== 17) times.push(`${pad(hour)}:30`)
  }

  return times
})()

function localDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function nowTime() {
  return `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
}

async function nextFreeSlot({ hospitalId, doctorId = null, days = 7 }) {
  const start = new Date()

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + offset)
    const date = localDate(day)

    const taken = await Appointment.find({
      hospital: hospitalId,
      doctor: doctorId,
      date,
      status: { $ne: 'cancelled' },
    }).select('time')

    const takenTimes = new Set(taken.map((row) => row.time))
    const free = TIMES.filter(
      (time) => !takenTimes.has(time) && !(offset === 0 && time <= nowTime()),
    )

    if (free.length) {
      return { date, time: free[0] }
    }
  }

  return null
}

module.exports = { TIMES, localDate, nextFreeSlot }

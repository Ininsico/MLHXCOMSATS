const API_BASE = '/api'

let actingFor = null

/** Act on behalf of a dependent — every later request carries the header. */
export function setActingFor(dependentId) {
  actingFor = dependentId || null
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}

  if (body) headers['Content-Type'] = 'application/json'
  if (actingFor) headers['x-acting-for'] = actingFor

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Request failed.')
    error.status = response.status
    error.code = payload?.error?.code
    error.details = payload?.error?.details
    throw error
  }

  return payload?.data ?? null
}

export const api = {
  signup: (input) => request('/auth/signup', { method: 'POST', body: input }),
  signin: (input) => request('/auth/signin', { method: 'POST', body: input }),
  signout: () => request('/auth/signout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateProfile: (input) => request('/auth/me', { method: 'PATCH', body: input }),
  changePassword: (input) => request('/auth/password/change', { method: 'POST', body: input }),

  demoLogin: (role) => request('/auth/demo-login', { method: 'POST', body: { role } }),

  otp: {
    request: (input) => request('/auth/otp/request', { method: 'POST', body: input }),
    verify: (input) => request('/auth/otp/verify', { method: 'POST', body: input }),
  },

  password: {
    forgot: (input) => request('/auth/password/forgot', { method: 'POST', body: input }),
    reset: (input) => request('/auth/password/reset', { method: 'POST', body: input }),
  },

  verify: {
    request: () => request('/auth/verify/request', { method: 'POST' }),
    confirm: (code) => request('/auth/verify/confirm', { method: 'POST', body: { code } }),
  },

  hospitals: {
    list: (query) => request(`/hospitals${query ? `?q=${encodeURIComponent(query)}` : ''}`),
    get: (id) => request(`/hospitals/${id}`),
    doctors: (id) => request(`/hospitals/${id}/doctors`),
    mine: () => request('/hospitals/mine'),
    updateMine: (patch) => request('/hospitals/mine', { method: 'PATCH', body: patch }),
    apply: (input) => request('/hospitals/apply', { method: 'POST', body: input }),
    subscription: () => request('/hospitals/mine/subscription'),
    setPlan: (planId) => request('/hospitals/mine/subscription', { method: 'POST', body: { planId } }),
    setTheme: (themeId) => request('/hospitals/mine/theme', { method: 'POST', body: { themeId } }),
    submitVerification: (documents) =>
      request('/hospitals/mine/verification', { method: 'POST', body: { documents } }),
  },

  staff: {
    list: (query) => request(`/staff${query ? `?${query}` : ''}`),
    create: (input) => request('/staff', { method: 'POST', body: input }),
    update: (id, patch) => request(`/staff/${id}`, { method: 'PATCH', body: patch }),
    remove: (id) => request(`/staff/${id}`, { method: 'DELETE' }),
  },

  inventory: {
    list: () => request('/inventory'),
    create: (input) => request('/inventory', { method: 'POST', body: input }),
    update: (id, patch) => request(`/inventory/${id}`, { method: 'PATCH', body: patch }),
    addMovement: (id, movement) =>
      request(`/inventory/${id}/movements`, { method: 'POST', body: movement }),
    remove: (id) => request(`/inventory/${id}`, { method: 'DELETE' }),
  },

  lab: {
    tests: () => request('/lab/tests'),
    createTest: (input) => request('/lab/tests', { method: 'POST', body: input }),
    updateTest: (id, patch) => request(`/lab/tests/${id}`, { method: 'PATCH', body: patch }),
    orders: (query) => request(`/lab/orders${query ? `?${query}` : ''}`),
    createOrder: (input) => request('/lab/orders', { method: 'POST', body: input }),
    updateOrder: (id, patch) => request(`/lab/orders/${id}`, { method: 'PATCH', body: patch }),
    mine: () => request('/lab/mine'),
    mineReport: (id) => request(`/lab/mine/${id}`),
  },

  appointments: {
    list: (query) => request(`/appointments${query ? `?${query}` : ''}`),
    create: (input) => request('/appointments', { method: 'POST', body: input }),
    update: (id, status) => request(`/appointments/${id}`, { method: 'PATCH', body: { status } }),
    mine: () => request('/appointments/mine'),
    book: (input) => request('/appointments/mine', { method: 'POST', body: input }),
    cancelMine: (id) =>
      request(`/appointments/mine/${id}`, { method: 'PATCH', body: { status: 'cancelled' } }),
  },

  doctor: {
    me: () => request('/doctor/me'),
    appointments: (query) => request(`/doctor/appointments${query ? `?${query}` : ''}`),
    timetable: (days) => request(`/doctor/timetable${days ? `?days=${days}` : ''}`),
    updateProfile: (patch) => request('/doctor/me', { method: 'PATCH', body: patch }),
    updateAppointment: (id, status) =>
      request(`/doctor/appointments/${id}`, { method: 'PATCH', body: { status } }),
    labTests: () => request('/doctor/lab-tests'),
    labOrders: (query) => request(`/doctor/lab-orders${query ? `?${query}` : ''}`),
    requestLabOrder: (input) => request('/doctor/lab-orders', { method: 'POST', body: input }),
    updateLabOrder: (id, patch) =>
      request(`/doctor/lab-orders/${id}`, { method: 'PATCH', body: patch }),
  },

  nurse: {
    alerts: () => request('/nurse/alerts'),
    sessions: () => request('/nurse/sessions'),
    simulate: (input) => request('/nurse/simulate', { method: 'POST', body: input }),
  },

  emergency: {
    sos: (body) => request('/emergency/sos', { method: 'POST', body }),
    requestAmbulance: (body) => request('/emergency/ambulance', { method: 'POST', body }),
    mine: () => request('/emergency/mine'),
    track: (id) => request(`/emergency/${id}/track`),
    cancel: (id, reason) => request(`/emergency/${id}/cancel`, { method: 'POST', body: { reason } }),
    ambulances: () => request('/emergency/ambulances'),
    addAmbulance: (body) => request('/emergency/ambulances', { method: 'POST', body }),
    updateAmbulance: (id, body) => request(`/emergency/ambulances/${id}`, { method: 'PATCH', body }),
    requests: (query) => request(`/emergency/requests${query ? `?${query}` : ''}`),
    act: (id, body) => request(`/emergency/requests/${id}`, { method: 'PATCH', body }),
    ambulanceLocation: (id, body) => request(`/emergency/requests/${id}/ambulance-location`, { method: 'POST', body }),
    raisePlanRequest: (body) => request('/emergency/subscription-request', { method: 'POST', body }),
    planRequests: () => request('/emergency/subscription-requests'),
  },

  operations: {
    analytics: () => request('/operations/analytics'),
    beds: () => request('/operations/beds'),
    addBed: (body) => request('/operations/beds', { method: 'POST', body }),
    setBed: (id, status) => request(`/operations/beds/${id}`, { method: 'PATCH', body: { status } }),
    admissions: (query) => request(`/operations/admissions${query ? `?${query}` : ''}`),
    admit: (body) => request('/operations/admissions', { method: 'POST', body }),
    discharge: (id, outcome) => request(`/operations/admissions/${id}/discharge`, { method: 'PATCH', body: { outcome } }),
    invoices: (query) => request(`/operations/invoices${query ? `?${query}` : ''}`),
    createInvoice: (body) => request('/operations/invoices', { method: 'POST', body }),
    setInvoice: (id, status) => request(`/operations/invoices/${id}`, { method: 'PATCH', body: { status } }),
    submitClaim: (id, body) => request(`/operations/invoices/${id}/claim`, { method: 'PATCH', body }),
    equipmentLogs: () => request('/operations/equipment-logs'),
    addEquipmentLog: (body) => request('/operations/equipment-logs', { method: 'POST', body }),
    intake: (query) => request(`/operations/intake${query ? `?${query}` : ''}`),
    addIntake: (body) => request('/operations/intake', { method: 'POST', body }),
    setIntake: (id, body) => request(`/operations/intake/${id}`, { method: 'PATCH', body }),
    setConsult: (appointmentId, body) =>
      request(`/operations/appointments/${appointmentId}/consult`, { method: 'PATCH', body }),
  },

  doctorCare: {
    queue: () => request('/doctor/queue'),
    note: (appointmentId) => request(`/doctor/notes/${appointmentId}`),
    draftNote: (appointmentId) => request(`/doctor/notes/${appointmentId}/draft`, { method: 'POST', body: {} }),
    saveNote: (appointmentId, body) => request(`/doctor/notes/${appointmentId}`, { method: 'PUT', body }),
    checkPrescription: (body) => request('/doctor/prescriptions/check', { method: 'POST', body }),
    prescribe: (body) => request('/doctor/prescriptions', { method: 'POST', body }),
    prescriptions: (query) => request(`/doctor/prescriptions${query ? `?${query}` : ''}`),
    refer: (body) => request('/doctor/referrals', { method: 'POST', body }),
    referrals: (query) => request(`/doctor/referrals${query ? `?${query}` : ''}`),
    previsit: (appointmentId) => request(`/doctor/previsit/${appointmentId}`),
    setReferral: (id, status) => request(`/doctor/referrals/${id}`, { method: 'PATCH', body: { status } }),
  },

  platform: {
    usage: () => request('/admin/usage'),
    audit: (query) => request(`/admin/audit${query ? `?${query}` : ''}`),
    setFlags: (hospitalId, features) => request(`/admin/hospitals/${hospitalId}/flags`, { method: 'PATCH', body: { features } }),
    corpusStats: () => request('/admin/corpus/stats'),
    addCorpusDocument: (body) => request('/admin/corpus/document', { method: 'POST', body }),
    reindexCorpus: () => request('/admin/corpus/reindex', { method: 'POST', body: {} }),
    subscriptionRequests: (query) => request(`/admin/subscription-requests${query ? `?${query}` : ''}`),
    decideSubscription: (id, body) => request(`/admin/subscription-requests/${id}`, { method: 'PATCH', body }),
    exportPatient: (id) => request(`/admin/patients/${id}/export`),
    erasePatient: (id) => request(`/admin/patients/${id}/erasure`, { method: 'POST', body: {} }),
  },

  patients: {
    profile: () => request('/patients/me/profile'),
    saveProfile: (body) => request('/patients/me/profile', { method: 'PUT', body }),
    vitals: (type) => request(`/patients/me/vitals${type ? `?type=${type}` : ''}`),
    addVitals: (body) => request('/patients/me/vitals', { method: 'POST', body }),
    deleteVitals: (id) => request(`/patients/me/vitals/${id}`, { method: 'DELETE' }),
    reschedule: (id, body) => request(`/patients/me/appointments/${id}/reschedule`, { method: 'PATCH', body }),
    checkIn: (id) => request(`/patients/me/appointments/${id}/check-in`, { method: 'POST', body: {} }),
    review: (id, body) => request(`/patients/me/appointments/${id}/review`, { method: 'POST', body }),
    shareReport: (id, body) => request(`/patients/me/lab-orders/${id}/share`, { method: 'POST', body }),
    shares: () => request('/patients/me/shares'),
    revokeShare: (id) => request(`/patients/me/shares/${id}`, { method: 'DELETE' }),

    carePlans: () => request('/patients/me/care-plans'),
    createCarePlan: (body) => request('/patients/me/care-plans', { method: 'POST', body }),
    updateCarePlan: (id, body) => request(`/patients/me/care-plans/${id}`, { method: 'PATCH', body }),
    deleteCarePlan: (id) => request(`/patients/me/care-plans/${id}`, { method: 'DELETE' }),

    dependents: () => request('/patients/me/dependents'),
    addDependent: (body) => request('/patients/me/dependents', { method: 'POST', body }),
    removeDependent: (id) => request(`/patients/me/dependents/${id}`, { method: 'DELETE' }),

    vaccinations: () => request('/patients/me/vaccinations'),
    addVaccination: (body) => request('/patients/me/vaccinations', { method: 'POST', body }),
    removeVaccination: (id) => request(`/patients/me/vaccinations/${id}`, { method: 'DELETE' }),
    verifyVaccination: (code) => request(`/patients/public/vaccinations/${code}`),

    previsit: (appointmentId) => request(`/patients/me/appointments/${appointmentId}/previsit`),
    savePrevisit: (appointmentId, body) =>
      request(`/patients/me/appointments/${appointmentId}/previsit`, { method: 'POST', body }),

    waitlist: () => request('/patients/me/waitlist'),
    joinWaitlist: (body) => request('/patients/me/waitlist', { method: 'POST', body }),
    acceptWaitlistOffer: (id) => request(`/patients/me/waitlist/${id}/accept`, { method: 'POST', body: {} }),
    leaveWaitlist: (id) => request(`/patients/me/waitlist/${id}`, { method: 'DELETE' }),

    importVitals: (body) => request('/patients/me/vitals/import', { method: 'POST', body }),
    availability: (hospitalId, query) =>
      request(`/patients/hospitals/${hospitalId}/availability${query ? `?${query}` : ''}`),
  },

  payments: {
    methods: () => request('/payments/methods'),
    intents: () => request('/payments/intents'),
    createIntent: (body) => request('/payments/intents', { method: 'POST', body }),
    checkIntent: (id) => request(`/payments/intents/${id}/check`, { method: 'POST', body: {} }),
    simulateIntent: (id) => request(`/payments/intents/${id}/simulate`, { method: 'POST', body: {} }),
    cancelIntent: (id) => request(`/payments/intents/${id}/cancel`, { method: 'POST', body: {} }),
    received: () => request('/payments/received'),
    subscription: () => request('/payments/subscription'),
    subscriptionHistory: () => request('/payments/subscription/history'),
  },

  waitlist: {
    list: (query) => request(`/waitlist${query ? `?${query}` : ''}`),
    offer: (body) => request('/waitlist/offer', { method: 'POST', body }),
    previsitForms: () => request('/waitlist/previsit'),
  },

  aurora: {
    personas: () => request('/aurora/personas'),
    sessions: (persona) => request(`/aurora/sessions${persona ? `?persona=${persona}` : ''}`),
    session: (id) => request(`/aurora/sessions/${id}`),
    chat: (input) => request('/aurora/chat', { method: 'POST', body: input }),
    memories: (persona) => request(`/aurora/memories${persona ? `?persona=${persona}` : ''}`),
    forgetMemory: (id) => request(`/aurora/memories/${id}`, { method: 'DELETE' }),
  },

  voice: {
    turn: (input) => request('/voice/turn', { method: 'POST', body: input }),
    confirm: (input) => request('/voice/confirm', { method: 'POST', body: input }),
    end: (input) => request('/voice/end', { method: 'POST', body: input }),
    sessions: () => request('/voice/sessions'),
  },

  marketplace: {
    list: (query) => request(`/marketplace${query ? `?${query}` : ''}`),
    mine: () => request('/marketplace/mine'),
    create: (input) => request('/marketplace', { method: 'POST', body: input }),
    update: (id, patch) => request(`/marketplace/${id}`, { method: 'PATCH', body: patch }),
    remove: (id) => request(`/marketplace/${id}`, { method: 'DELETE' }),
    reserve: (id) => request(`/marketplace/${id}/reserve`, { method: 'POST', body: {} }),
    release: (id) => request(`/marketplace/${id}/release`, { method: 'POST', body: {} }),
    offer: (id, body) => request(`/marketplace/${id}/offers`, { method: 'POST', body }),
    offers: (id) => request(`/marketplace/${id}/offers`),
    decideOffer: (offerId, action) =>
      request(`/marketplace/offers/${offerId}`, { method: 'PATCH', body: { action } }),
    complete: (id, soldPrice) => request(`/marketplace/${id}/complete`, { method: 'POST', body: { soldPrice } }),
  },

  uploads: {
    image: (dataUrl) => request('/uploads/image', { method: 'POST', body: { dataUrl } }),
  },

  ai: {
    triage: (query) => request('/ai/triage', { method: 'POST', body: { query } }),
    booking: (input) => request('/ai/booking', { method: 'POST', body: input }),
    status: () => request('/ai/status'),
    analyzeImage: (input) => request('/ai/analyze-image', { method: 'POST', body: input }),
    chat: (input) => request('/ai/chat', { method: 'POST', body: input }),
    inferences: (limit) => request(`/ai/inferences${limit ? `?limit=${limit}` : ''}`),
    feedback: (id, input) =>
      request(`/ai/inferences/${id}/feedback`, { method: 'POST', body: input }),
  },

  admin: {
    stats: () => request('/admin/stats'),
    users: () => request('/admin/users'),
    hospitals: () => request('/admin/hospitals'),
    subscriptions: () => request('/admin/subscriptions'),
    setHospitalStatus: (id, status) =>
      request(`/admin/hospitals/${id}/status`, { method: 'PATCH', body: { status } }),
    setVerification: (id, status, notes) =>
      request(`/admin/hospitals/${id}/verification`, { method: 'PATCH', body: { status, notes } }),
    aiSettings: () => request('/admin/ai-settings'),
    updateAiSettings: (patch) =>
      request('/admin/ai-settings', { method: 'PATCH', body: patch }),
    aiUsage: () => request('/admin/ai-usage'),
  },
}

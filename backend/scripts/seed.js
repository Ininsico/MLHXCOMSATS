require('dotenv').config({ quiet: true })

const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')

const User = require('../src/models/user')
const Hospital = require('../src/models/hospital')
const Staff = require('../src/models/staff')
const InventoryItem = require('../src/models/inventory-item')
const LabTest = require('../src/models/lab-test')
const LabOrder = require('../src/models/lab-order')
const Appointment = require('../src/models/appointment')
const Listing = require('../src/models/listing')
const { flagForValue } = require('../src/lib/lab')
const { connectDb } = require('../src/lib/db')

const DEMO_PASSWORD = 'Aurora@123'

const DEMO_EMAILS = {
  patient: 'demo.patient@aurora.local',
  doctor: 'demo.doctor@aurora.local',
  hospital: 'demo.hospital@aurora.local',
  hospitalTwo: 'demo.hospital.two@aurora.local',
  hospitalThree: 'demo.hospital.three@aurora.local',
  patientTwo: 'demo.patient.two@aurora.local',
  patientThree: 'demo.patient.three@aurora.local',
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function dayOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildResults(test, values) {
  return test.parameters.map((parameter) => {
    const value = values[parameter.name] === undefined ? '' : String(values[parameter.name])

    return {
      parameter: parameter.name,
      value,
      unit: parameter.unit,
      referenceLow: parameter.referenceLow,
      referenceHigh: parameter.referenceHigh,
      flag: flagForValue(value, parameter.referenceLow, parameter.referenceHigh),
    }
  })
}

async function createAccount({ name, email, role, passwordHash, verified = true }) {
  return User.create({
    name,
    email,
    role,
    status: 'active',
    passwordHash,
    emailVerifiedAt: verified ? new Date() : null,
  })
}

async function createHospital({
  owner,
  name,
  city,
  area,
  address,
  phone,
  description,
  specialties,
  rating,
  reviewCount,
  reviews,
  planId,
  themeId,
  verificationStatus = 'verified',
}) {
  return Hospital.create({
    name,
    city,
    area,
    address,
    phone,
    description,
    specialties,
    rating,
    reviewCount,
    reviews,
    status: 'approved',
    owner: owner._id,
    subscription: {
      planId,
      themeId,
      status: 'active',
      startedAt: new Date(),
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    verification: {
      status: verificationStatus,
      documents: [],
      submittedAt: new Date(),
      reviewedAt: new Date(),
      notes: '',
    },
  })
}

async function createStaff({ hospital, name, email, role, specialty = '', department = '', phone = '', status = 'active', passwordHash }) {
  let user = null

  if (role === 'doctor' && email) {
    user = await createAccount({ name, email, role: 'doctor', passwordHash })
  }

  return Staff.create({
    hospital: hospital._id,
    user: user?._id ?? null,
    name,
    email: email ?? '',
    phone,
    role,
    specialty,
    department,
    status,
  })
}

async function createTest({ hospital, name, category, sampleType, price, turnaroundHours, parameters }) {
  return LabTest.create({
    hospital: hospital._id,
    name,
    category,
    sampleType,
    price,
    turnaroundHours,
    parameters,
  })
}

async function createOrder({ hospital, test, patientUser, patientName, doctor, status, results = [], summary = '', interpretation = '', priority = 'routine', notes = '', daysAgo = 0 }) {
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

  return LabOrder.create({
    hospital: hospital._id,
    test: test._id,
    testName: test.name,
    parameters: test.parameters,
    patientName,
    patientUser: patientUser?._id ?? null,
    requestedByStaff: doctor?._id ?? null,
    priority,
    status,
    results,
    resultSummary: summary,
    interpretation,
    notes,
    orderedBy: doctor?.name ?? 'Front desk',
    collectedAt: ['collected', 'processing', 'completed', 'sent'].includes(status) ? createdAt : null,
    completedAt: ['completed', 'sent'].includes(status) ? createdAt : null,
    sentAt: status === 'sent' ? createdAt : null,
    sentBy: status === 'sent' ? doctor?.name ?? 'Hospital laboratory' : '',
    createdAt,
    updatedAt: createdAt,
  })
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — copy it into backend/.env')
  }

  await connectDb(process.env.MONGODB_URI)
  console.log('Seeding Aurora demo data…')

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const demoEmailList = Object.values(DEMO_EMAILS)

  const previousOwners = await User.find({ email: { $in: demoEmailList } }).select('_id')
  const previousHospitals = await Hospital.find({
    owner: { $in: previousOwners.map((owner) => owner._id) },
  }).select('_id')
  const previousHospitalIds = previousHospitals.map((hospital) => hospital._id)

  await Promise.all([
    Appointment.deleteMany({ hospital: { $in: previousHospitalIds } }),
    LabOrder.deleteMany({ hospital: { $in: previousHospitalIds } }),
    LabTest.deleteMany({ hospital: { $in: previousHospitalIds } }),
    InventoryItem.deleteMany({ hospital: { $in: previousHospitalIds } }),
    Staff.deleteMany({ hospital: { $in: previousHospitalIds } }),
    Listing.deleteMany({ seller: { $in: previousHospitalIds } }),
    Hospital.deleteMany({ _id: { $in: previousHospitalIds } }),
    User.deleteMany({ email: { $in: demoEmailList } }),
  ])

  const staffEmails = [
    'dr.sana.malik@cedarvalley.demo',
    'dr.imran.qureshi@cedarvalley.demo',
    'dr.usman.tariq@cedarvalley.demo',
    'dr.zara.shah@northline.demo',
    'dr.adeel.awan@northline.demo',
    'dr.mariam.noor@northline.demo',
    'dr.bilal.hussain@riverside.demo',
    'dr.fatima.jamil@riverside.demo',
  ]

  await User.deleteMany({ email: { $in: staffEmails } })

  // ---------- Hospital 1 — Cedar Valley General Hospital (the demo hospital) ----------
  const cedarOwner = await createAccount({
    name: 'Rehan Ashraf',
    email: DEMO_EMAILS.hospital,
    role: 'hospital',
    passwordHash,
  })

  const cedar = await createHospital({
    owner: cedarOwner,
    name: 'Cedar Valley General Hospital',
    city: 'Abbottabad',
    area: 'Mandian',
    address: 'House 12, Supply Bazaar Road, Mandian',
    phone: '0992-341200',
    description:
      'A 180-bed general hospital with 24/7 emergency cover, cardiology, pediatrics and a full diagnostic laboratory. Quiet wards, short waiting times, and a front desk that answers.',
    specialties: ['Cardiology', 'Pediatrics', 'Emergency', 'General Medicine', 'Radiology'],
    rating: 4.8,
    reviewCount: 126,
    reviews: [
      { author: 'Hira A.', rating: 5, text: 'The cardiology team explained everything calmly and the follow-up was on time.' },
      { author: 'Imran Q.', rating: 5, text: 'Emergency took my father in at 2am without any paperwork drama.' },
      { author: 'Sadia M.', rating: 4, text: 'Clean wards and a lab that actually delivers reports the same day.' },
    ],
    planId: 'growth',
    themeId: 'sunrise',
  })

  const drSana = await createStaff({
    hospital: cedar,
    name: 'Dr. Sana Malik',
    email: 'dr.sana.malik@cedarvalley.demo',
    role: 'doctor',
    specialty: 'Cardiology',
    department: 'Cardiology',
    phone: '0300-1122334',
    passwordHash,
  })

  const drImran = await createStaff({
    hospital: cedar,
    name: 'Dr. Imran Qureshi',
    email: 'dr.imran.qureshi@cedarvalley.demo',
    role: 'doctor',
    specialty: 'General Medicine',
    department: 'Outpatient',
    phone: '0300-1122335',
    passwordHash,
  })

  const drHina = await createStaff({
    hospital: cedar,
    name: 'Dr. Hina Raza',
    email: DEMO_EMAILS.doctor,
    role: 'doctor',
    specialty: 'Pediatrics',
    department: 'Pediatrics',
    phone: '0300-1122336',
    passwordHash,
  })

  await createStaff({
    hospital: cedar,
    name: 'Dr. Usman Tariq',
    email: 'dr.usman.tariq@cedarvalley.demo',
    role: 'doctor',
    specialty: 'Emergency',
    department: 'Emergency',
    phone: '0300-1122337',
    status: 'leave',
    passwordHash,
  })

  await createStaff({
    hospital: cedar,
    name: 'Nurse Ayesha Bibi',
    email: 'ayesha.bibi@cedarvalley.demo',
    role: 'nurse',
    department: 'Cardiology',
    phone: '0301-4455661',
  })

  await createStaff({
    hospital: cedar,
    name: 'Kamran Yousaf',
    email: 'kamran.yousaf@cedarvalley.demo',
    role: 'receptionist',
    department: 'Front desk',
    phone: '0301-4455662',
  })

  await createStaff({
    hospital: cedar,
    name: 'Nida Rehman',
    email: 'nida.rehman@cedarvalley.demo',
    role: 'lab',
    department: 'Laboratory',
    phone: '0301-4455663',
  })

  // Cedar Valley — the demo doctor account belongs to Dr. Hina Raza (Pediatrics)

  const cedarInventory = await InventoryItem.insertMany([
    { hospital: cedar._id, name: 'Surgical gloves (M)', sku: 'GLV-M-100', category: 'Consumables', unit: 'box', quantity: 42, reorderLevel: 15, location: 'Store room A' },
    { hospital: cedar._id, name: 'IV cannula 20G', sku: 'IVC-20', category: 'Consumables', unit: 'pack', quantity: 8, reorderLevel: 20, location: 'Emergency bay' },
    { hospital: cedar._id, name: 'Digital thermometer', sku: 'THM-DIG', category: 'Monitoring', unit: 'unit', quantity: 15, reorderLevel: 6, location: 'Ward 3' },
    { hospital: cedar._id, name: 'Nebulizer mask (adult)', sku: 'NEB-AD', category: 'Consumables', unit: 'pack', quantity: 5, reorderLevel: 12, location: 'Store room A' },
    { hospital: cedar._id, name: 'ECG electrodes', sku: 'ECG-EL', category: 'Monitoring', unit: 'pack', quantity: 60, reorderLevel: 25, location: 'Cardiology' },
    { hospital: cedar._id, name: 'Wheelchair (folding)', sku: 'WCH-FLD', category: 'Furniture', unit: 'unit', quantity: 12, reorderLevel: 4, location: 'Front desk' },
  ])

  const cedarTests = await Promise.all([
    createTest({
      hospital: cedar,
      name: 'Complete Blood Count (CBC)',
      category: 'Haematology',
      sampleType: 'Blood',
      price: 1200,
      turnaroundHours: 6,
      parameters: [
        { name: 'Hemoglobin', unit: 'g/dL', referenceLow: 13, referenceHigh: 17 },
        { name: 'WBC', unit: '10³/µL', referenceLow: 4, referenceHigh: 11 },
        { name: 'Platelets', unit: '10³/µL', referenceLow: 150, referenceHigh: 450 },
        { name: 'Hematocrit', unit: '%', referenceLow: 40, referenceHigh: 50 },
      ],
    }),
    createTest({
      hospital: cedar,
      name: 'Lipid Profile',
      category: 'Biochemistry',
      sampleType: 'Blood',
      price: 2500,
      turnaroundHours: 12,
      parameters: [
        { name: 'Total cholesterol', unit: 'mg/dL', referenceLow: 0, referenceHigh: 200 },
        { name: 'LDL', unit: 'mg/dL', referenceLow: 0, referenceHigh: 100 },
        { name: 'HDL', unit: 'mg/dL', referenceLow: 40, referenceHigh: 90 },
        { name: 'Triglycerides', unit: 'mg/dL', referenceLow: 0, referenceHigh: 150 },
      ],
    }),
    createTest({
      hospital: cedar,
      name: 'HbA1c',
      category: 'Biochemistry',
      sampleType: 'Blood',
      price: 1800,
      turnaroundHours: 8,
      parameters: [{ name: 'HbA1c', unit: '%', referenceLow: 4, referenceHigh: 5.7 }],
    }),
    createTest({
      hospital: cedar,
      name: 'Liver Function Test',
      category: 'Biochemistry',
      sampleType: 'Blood',
      price: 3200,
      turnaroundHours: 12,
      parameters: [
        { name: 'ALT', unit: 'U/L', referenceLow: 7, referenceHigh: 56 },
        { name: 'AST', unit: 'U/L', referenceLow: 10, referenceHigh: 40 },
        { name: 'Bilirubin', unit: 'mg/dL', referenceLow: 0.1, referenceHigh: 1.2 },
      ],
    }),
    createTest({
      hospital: cedar,
      name: 'Urinalysis',
      category: 'Clinical pathology',
      sampleType: 'Urine',
      price: 900,
      turnaroundHours: 4,
      parameters: [
        { name: 'Protein', unit: '', referenceLow: null, referenceHigh: null },
        { name: 'Glucose', unit: '', referenceLow: null, referenceHigh: null },
        { name: 'RBC', unit: '/hpf', referenceLow: 0, referenceHigh: 2 },
      ],
    }),
    createTest({
      hospital: cedar,
      name: 'Dengue NS1 Antigen',
      category: 'Serology',
      sampleType: 'Blood',
      price: 2200,
      turnaroundHours: 6,
      parameters: [{ name: 'NS1 Antigen', unit: '', referenceLow: null, referenceHigh: null }],
    }),
  ])

  const [cbc, lipid, hba1c, lft, urine] = cedarTests

  const demoPatient = await createAccount({
    name: 'Ayesha Khan',
    email: DEMO_EMAILS.patient,
    role: 'patient',
    passwordHash,
  })

  const bilal = await createAccount({
    name: 'Bilal Ahmed',
    email: DEMO_EMAILS.patientTwo,
    role: 'patient',
    passwordHash,
  })

  const zoya = await createAccount({
    name: 'Zoya Iqbal',
    email: DEMO_EMAILS.patientThree,
    role: 'patient',
    passwordHash,
  })

  await Appointment.insertMany([
    { hospital: cedar._id, patientUser: demoPatient._id, patientName: demoPatient.name, patientPhone: '0311-2223344', doctor: drHina._id, doctorName: drHina.name, specialty: drHina.specialty, date: dayOffset(0), time: '09:30', reason: 'Fever and rash on the arms for two days', status: 'confirmed', source: 'ai', aiNote: 'Booked with Aurora AI — pediatrics review' },
    { hospital: cedar._id, patientUser: bilal._id, patientName: bilal.name, patientPhone: '0311-2223345', doctor: drSana._id, doctorName: drSana.name, specialty: drSana.specialty, date: dayOffset(0), time: '11:00', reason: 'Routine blood pressure review', status: 'requested', source: 'patient' },
    { hospital: cedar._id, patientUser: zoya._id, patientName: zoya.name, patientPhone: '0311-2223346', doctor: drImran._id, doctorName: drImran.name, specialty: drImran.specialty, date: dayOffset(1), time: '10:00', reason: 'Persistent cough for a week', status: 'confirmed', source: 'patient' },
    { hospital: cedar._id, patientUser: demoPatient._id, patientName: demoPatient.name, patientPhone: '0311-2223344', doctor: drSana._id, doctorName: drSana.name, specialty: drSana.specialty, date: dayOffset(4), time: '12:30', reason: 'Cholesterol follow-up with reports', status: 'requested', source: 'patient' },
    { hospital: cedar._id, patientUser: zoya._id, patientName: zoya.name, patientPhone: '0311-2223346', doctor: drImran._id, doctorName: drImran.name, specialty: drImran.specialty, date: dayOffset(-3), time: '09:00', reason: 'Seasonal allergy consultation', status: 'completed', source: 'patient' },
    { hospital: cedar._id, patientUser: bilal._id, patientName: bilal.name, patientPhone: '0311-2223345', doctor: drSana._id, doctorName: drSana.name, specialty: drSana.specialty, date: dayOffset(-8), time: '15:00', reason: 'Chest tightness while walking', status: 'completed', source: 'ai', aiNote: 'Urgency: soon — cardiology review' },
    { hospital: cedar._id, patientName: 'Walk-in: Nadeem Akhtar', patientPhone: '0333-5557788', doctor: drImran._id, doctorName: drImran.name, specialty: drImran.specialty, date: dayOffset(0), time: '15:30', reason: 'Wound dressing change', status: 'confirmed', source: 'hospital' },
  ])

  await createOrder({
    hospital: cedar,
    test: cbc,
    patientUser: demoPatient,
    patientName: demoPatient.name,
    doctor: drHina,
    status: 'sent',
    daysAgo: 6,
    results: buildResults(cbc, { Hemoglobin: 11.4, WBC: 12.8, Platelets: 210, Hematocrit: 36 }),
    summary: 'Mild anaemia with a raised white cell count.',
    interpretation:
      'Findings fit an ongoing infection with mild anaemia. Repeat the CBC after the fever settles; start iron-rich food and review in two weeks.',
  })

  await createOrder({
    hospital: cedar,
    test: lipid,
    patientUser: demoPatient,
    patientName: demoPatient.name,
    doctor: drSana,
    status: 'completed',
    daysAgo: 2,
    results: buildResults(lipid, { 'Total cholesterol': 232, LDL: 158, HDL: 42, Triglycerides: 190 }),
    summary: 'Raised total cholesterol, LDL and triglycerides.',
  })

  await createOrder({
    hospital: cedar,
    test: hba1c,
    patientUser: bilal,
    patientName: bilal.name,
    doctor: drImran,
    status: 'processing',
    daysAgo: 1,
    priority: 'urgent',
    notes: 'Fasting sample taken at the front desk.',
  })

  await createOrder({
    hospital: cedar,
    test: lft,
    patientUser: zoya,
    patientName: zoya.name,
    doctor: drImran,
    status: 'collected',
    daysAgo: 0,
  })

  await createOrder({
    hospital: cedar,
    test: urine,
    patientUser: bilal,
    patientName: bilal.name,
    doctor: drSana,
    status: 'sent',
    daysAgo: 12,
    results: buildResults(urine, { Protein: 'Trace', Glucose: 'Negative', RBC: 3 }),
    summary: 'Trace protein with a few red cells.',
    interpretation: 'Likely a mild urinary tract irritation. Increase fluids and repeat in a week if symptoms persist.',
  })

  // ---------- Hospital 2 — Northline Medical Center ----------
  const northlineOwner = await createAccount({
    name: 'Sadia Noor',
    email: DEMO_EMAILS.hospitalTwo,
    role: 'hospital',
    passwordHash,
  })

  const northline = await createHospital({
    owner: northlineOwner,
    name: 'Northline Medical Center',
    city: 'Abbottabad',
    area: 'Jhangi',
    address: 'Plot 4, Mansehra Road, Jhangi',
    phone: '0992-447788',
    description:
      'A surgical and orthopaedic center with a modern operating theatre, on-site radiology and a physiotherapy unit.',
    specialties: ['Orthopedics', 'General Surgery', 'Radiology', 'Physiotherapy'],
    rating: 4.5,
    reviewCount: 48,
    reviews: [
      { author: 'Adnan S.', rating: 5, text: 'My knee replacement went smoothly and physiotherapy started the next morning.' },
    ],
    planId: 'starter',
    themeId: 'classic',
    verificationStatus: 'pending',
  })

  const drZara = await createStaff({
    hospital: northline,
    name: 'Dr. Zara Shah',
    email: 'dr.zara.shah@northline.demo',
    role: 'doctor',
    specialty: 'Orthopedics',
    department: 'Orthopedics',
    phone: '0302-7788991',
    passwordHash,
  })

  await createStaff({
    hospital: northline,
    name: 'Dr. Adeel Awan',
    email: 'dr.adeel.awan@northline.demo',
    role: 'doctor',
    specialty: 'General Surgery',
    department: 'Surgery',
    phone: '0302-7788992',
    passwordHash,
  })

  await createStaff({
    hospital: northline,
    name: 'Dr. Mariam Noor',
    email: 'dr.mariam.noor@northline.demo',
    role: 'doctor',
    specialty: 'Physiotherapy',
    department: 'Rehabilitation',
    phone: '0302-7788993',
    passwordHash,
  })

  await createStaff({
    hospital: northline,
    name: 'Hassan Rauf',
    email: 'hassan.rauf@northline.demo',
    role: 'receptionist',
    department: 'Front desk',
  })

  await InventoryItem.insertMany([
    { hospital: northline._id, name: 'Bone saw blades', sku: 'BSB-01', category: 'Surgical', unit: 'pack', quantity: 6, reorderLevel: 8, location: 'Theatre store' },
    { hospital: northline._id, name: 'Plaster of Paris rolls', sku: 'POP-15', category: 'Consumables', unit: 'roll', quantity: 48, reorderLevel: 20, location: 'Cast room' },
    { hospital: northline._id, name: 'Crutches (adjustable)', sku: 'CRT-ADJ', category: 'Furniture', unit: 'pair', quantity: 14, reorderLevel: 5, location: 'Rehab' },
    { hospital: northline._id, name: 'X-ray film 14x17', sku: 'XR-1417', category: 'Imaging', unit: 'box', quantity: 9, reorderLevel: 10, location: 'Radiology' },
  ])

  const northlineTests = await Promise.all([
    createTest({
      hospital: northline,
      name: 'Vitamin D (25-OH)',
      category: 'Biochemistry',
      sampleType: 'Blood',
      price: 3500,
      turnaroundHours: 24,
      parameters: [{ name: 'Vitamin D', unit: 'ng/mL', referenceLow: 30, referenceHigh: 100 }],
    }),
    createTest({
      hospital: northline,
      name: 'Serum Calcium',
      category: 'Biochemistry',
      sampleType: 'Blood',
      price: 1500,
      turnaroundHours: 8,
      parameters: [{ name: 'Calcium', unit: 'mg/dL', referenceLow: 8.6, referenceHigh: 10.3 }],
    }),
  ])

  await createOrder({
    hospital: northline,
    test: northlineTests[0],
    patientUser: bilal,
    patientName: bilal.name,
    doctor: drZara,
    status: 'completed',
    daysAgo: 3,
    results: buildResults(northlineTests[0], { 'Vitamin D': 18 }),
    summary: 'Vitamin D deficiency.',
  })

  await Appointment.insertMany([
    { hospital: northline._id, patientUser: zoya._id, patientName: zoya.name, doctor: drZara._id, doctorName: drZara.name, specialty: drZara.specialty, date: dayOffset(1), time: '09:00', reason: 'Knee pain after a fall', status: 'requested', source: 'patient' },
    { hospital: northline._id, patientName: 'Walk-in: Farhan Ali', doctor: drZara._id, doctorName: drZara.name, specialty: drZara.specialty, date: dayOffset(0), time: '13:30', reason: 'Plaster review', status: 'confirmed', source: 'hospital' },
  ])

  // ---------- Hospital 3 — Riverside Children's Hospital ----------
  const riversideOwner = await createAccount({
    name: 'Nabeel Chaudhry',
    email: DEMO_EMAILS.hospitalThree,
    role: 'hospital',
    passwordHash,
  })

  const riverside = await createHospital({
    owner: riversideOwner,
    name: "Riverside Children's Hospital",
    city: 'Islamabad',
    area: 'F-8',
    address: 'Street 21, F-8 Markaz',
    phone: '051-2299001',
    description:
      "A dedicated children's hospital with a neonatal unit, pediatric surgery, and a play-friendly outpatient wing open until midnight.",
    specialties: ['Pediatrics', 'Nutrition & Dietetics', 'Emergency'],
    rating: 4.9,
    reviewCount: 210,
    reviews: [
      { author: 'Maryam T.', rating: 5, text: 'The pediatric ward made my son feel safe — the nurses were wonderful.' },
      { author: 'Owais R.', rating: 5, text: 'Neonatal care was excellent and the billing was clear.' },
    ],
    planId: 'enterprise',
    themeId: 'midnight',
  })

  const drBilal = await createStaff({
    hospital: riverside,
    name: 'Dr. Bilal Hussain',
    email: 'dr.bilal.hussain@riverside.demo',
    role: 'doctor',
    specialty: 'Pediatrics',
    department: 'Pediatrics',
    phone: '0303-9900112',
    passwordHash,
  })

  await createStaff({
    hospital: riverside,
    name: 'Dr. Fatima Jamil',
    email: 'dr.fatima.jamil@riverside.demo',
    role: 'doctor',
    specialty: 'Nutrition & Dietetics',
    department: 'Nutrition',
    phone: '0303-9900113',
    passwordHash,
  })

  await InventoryItem.insertMany([
    { hospital: riverside._id, name: 'Infant feeding tubes', sku: 'IFT-06', category: 'Consumables', unit: 'pack', quantity: 22, reorderLevel: 10, location: 'NICU store' },
    { hospital: riverside._id, name: 'Pediatric pulse oximeter', sku: 'POX-PED', category: 'Monitoring', unit: 'unit', quantity: 7, reorderLevel: 3, location: 'NICU' },
    { hospital: riverside._id, name: 'Oral rehydration sachets', sku: 'ORS-01', category: 'Consumables', unit: 'box', quantity: 4, reorderLevel: 12, location: 'Pharmacy' },
  ])

  const riversideTests = await Promise.all([
    createTest({
      hospital: riverside,
      name: 'Pediatric CBC',
      category: 'Haematology',
      sampleType: 'Blood',
      price: 1100,
      turnaroundHours: 5,
      parameters: [
        { name: 'Hemoglobin', unit: 'g/dL', referenceLow: 11, referenceHigh: 14 },
        { name: 'WBC', unit: '10³/µL', referenceLow: 5, referenceHigh: 15 },
        { name: 'Platelets', unit: '10³/µL', referenceLow: 150, referenceHigh: 450 },
      ],
    }),
  ])

  await createOrder({
    hospital: riverside,
    test: riversideTests[0],
    patientUser: zoya,
    patientName: zoya.name,
    doctor: drBilal,
    status: 'requested',
    daysAgo: 0,
    notes: 'Requested during the evening clinic.',
  })

  await Appointment.insertMany([
    { hospital: riverside._id, patientUser: demoPatient._id, patientName: demoPatient.name, doctor: drBilal._id, doctorName: drBilal.name, specialty: drBilal.specialty, date: dayOffset(2), time: '16:00', reason: 'Vaccination schedule review', status: 'requested', source: 'patient' },
  ])

  // ---------- Marketplace ----------
  await Listing.insertMany([
    {
      seller: northline._id,
      title: 'GE Logiq P5 ultrasound machine',
      description:
        'Four-probe ultrasound from our radiology wing, serviced last month. Includes cart, printer and both convex and linear probes. Selling because we upgraded.',
      category: 'Imaging',
      condition: 'used',
      price: 850000,
      status: 'available',
      images: [],
    },
    {
      seller: northline._id,
      title: 'Surgical suction unit (twin jar)',
      description: 'Electric twin-jar suction unit used in the operating theatre. Runs quietly, jars and tubing included.',
      category: 'Surgical',
      condition: 'refurbished',
      price: 120000,
      status: 'available',
      images: [],
    },
    {
      seller: cedar._id,
      title: 'Patient monitors (4 units)',
      description:
        'Four multiparameter patient monitors with ECG, SpO2 and NIBP. Selling as a set with all cables. Calibration valid for six months.',
      category: 'Monitoring',
      condition: 'used',
      price: 340000,
      status: 'reserved',
      buyer: northline._id,
      reservedAt: new Date(),
      images: [],
    },
    {
      seller: riverside._id,
      title: 'Pediatric hospital beds (6 units)',
      description: 'Six pediatric beds with side rails and adjustable height, from a ward we refitted. Mattresses included.',
      category: 'Furniture',
      condition: 'used',
      price: 180000,
      status: 'available',
      images: [],
    },
    {
      seller: cedar._id,
      title: 'Ambulance — Toyota Hiace (2016)',
      description:
        'Fully fitted ambulance with stretcher, oxygen points and working siren. Well maintained, papers up to date.',
      category: 'Vehicles',
      condition: 'used',
      price: 2400000,
      status: 'sold',
      buyer: riverside._id,
      soldAt: new Date(),
      images: [],
    },
  ])

  console.log('\nDemo data ready:')
  console.log(`  Hospitals:  ${[cedar, northline, riverside].map((item) => item.name).join(' | ')}`)
  console.log(`  Staff:      ${await Staff.countDocuments({ hospital: { $in: [cedar._id, northline._id, riverside._id] } })}`)
  console.log(`  Inventory:  ${await InventoryItem.countDocuments({ hospital: { $in: [cedar._id, northline._id, riverside._id] } })}`)
  console.log(`  Lab tests:  ${await LabTest.countDocuments({ hospital: { $in: [cedar._id, northline._id, riverside._id] } })}`)
  console.log(`  Lab orders: ${await LabOrder.countDocuments({ hospital: { $in: [cedar._id, northline._id, riverside._id] } })}`)
  console.log(`  Bookings:   ${await Appointment.countDocuments({ hospital: { $in: [cedar._id, northline._id, riverside._id] } })}`)
  console.log(`  Listings:   ${await Listing.countDocuments({ seller: { $in: [cedar._id, northline._id, riverside._id] } })}`)
  console.log(`\nInstant logins on /signin — every demo account also uses the password ${DEMO_PASSWORD}:`)
  console.log(`  hospital  ${DEMO_EMAILS.hospital}      (Cedar Valley General Hospital)`)
  console.log(`  doctor    ${DEMO_EMAILS.doctor}        (Dr. Hina Raza, Pediatrics)`)
  console.log(`  patient   ${DEMO_EMAILS.patient}       (Ayesha Khan)`)
  console.log('  admin     MAIN_ADMIN_EMAIL from backend/.env')

  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error('Seeding failed:', error.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})

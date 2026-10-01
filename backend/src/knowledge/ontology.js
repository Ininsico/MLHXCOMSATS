/**
 * Clinical ontology: entity types, typed predicates with domain/range, the concept
 * nodes, and the asserted triples (subject – predicate – object).
 *
 * The graph is the single source of truth for routing, red-flag detection and
 * question generation. Nothing downstream is allowed to hardcode clinical logic:
 * it queries this store.
 *
 * Safety is a schema property, not a convention: every Condition node must carry
 * `diagnosable: false` and `assertionRules`, and the audit fails if one does not.
 */

// ---------------------------------------------------------------- schema layer

const ENTITY_TYPES = {
  Symptom: 'something the patient reports',
  Condition: 'a clinical entity a clinician may diagnose',
  Specialty: 'a care team that manages a condition',
  RedFlag: 'a finding that changes urgency immediately',
  Question: 'a question the agent asks to narrow the picture',
  UrgencyLevel: 'how fast this needs attention',
  BodySystem: 'anatomical or functional system',
  AgeGroup: 'a demographic band with its own rules',
}

const PREDICATES = {
  IS_A: {
    domain: ['Symptom', 'Condition', 'Specialty', 'BodySystem', 'AgeGroup'],
    range: ['Symptom', 'Condition', 'Specialty', 'BodySystem', 'AgeGroup'],
    transitive: true,
    doc: 'subsumption: the subject is a kind of the object',
  },
  HAS_SYMPTOM: {
    domain: ['Condition'],
    range: ['Symptom'],
    inverse: 'INDICATES_CONDITION',
    doc: 'a condition typically presents with this symptom',
  },
  INDICATES_CONDITION: {
    domain: ['Symptom'],
    range: ['Condition'],
    inverse: 'HAS_SYMPTOM',
    doc: 'this symptom raises the possibility of that condition',
  },
  MANAGED_BY: {
    // Symptoms carry this too: rule R2 derives it from the conditions they indicate.
    domain: ['Condition', 'Symptom'],
    range: ['Specialty'],
    doc: 'the specialty that owns this condition (inherited by symptoms through inference)',
  },
  REQUIRES_URGENCY: {
    domain: ['Condition', 'Symptom'],
    range: ['UrgencyLevel'],
    doc: 'the minimum urgency this demands (inherited by symptoms through inference)',
  },
  HAS_RED_FLAG: {
    domain: ['Condition', 'Symptom'],
    range: ['RedFlag'],
    doc: 'a finding that must be asked about and acted on (inherited by symptoms through inference)',
  },
  ASKS_QUESTION: {
    domain: ['Condition', 'Symptom'],
    range: ['Question'],
    doc: 'a question that narrows this condition (inherited by symptoms through inference)',
  },
  CONTRAINDICATES: {
    domain: ['Condition', 'Symptom'],
    range: ['Condition', 'Symptom'],
    asymmetric: true,
    doc: 'the subject makes the object unsafe or inappropriate (no instances seeded yet — needs clinician sign-off)',
  },
  PRESENTS_IN: {
    domain: ['Condition'],
    range: ['AgeGroup'],
    doc: 'the age band where this condition is typical or needs different handling',
  },
}

const URGENCY_ORDER = { routine: 0, soon: 1, urgent: 2, emergency: 3 }

// ---------------------------------------------------------------- concept nodes

const NODES = {
  // urgency levels
  'urg:routine': { type: 'UrgencyLevel', label: 'routine', rank: 0 },
  'urg:soon': { type: 'UrgencyLevel', label: 'soon', rank: 1 },
  'urg:urgent': { type: 'UrgencyLevel', label: 'urgent', rank: 2 },
  'urg:emergency': { type: 'UrgencyLevel', label: 'emergency', rank: 3 },

  // specialties
  'spc:cardio': { type: 'Specialty', label: 'cardiology', agent: 'cardio' },
  'spc:general': { type: 'Specialty', label: 'general medicine', agent: 'general' },
  'spc:pediatrics': { type: 'Specialty', label: 'paediatrics', agent: 'pediatrics' },
  'spc:skin': { type: 'Specialty', label: 'dermatology', agent: 'skin' },
  'spc:therapy': { type: 'Specialty', label: 'mental health', agent: 'therapy' },
  'spc:womens': { type: 'Specialty', label: "women's health", agent: 'womens' },

  // body systems
  'sys:cardiovascular': { type: 'BodySystem', label: 'cardiovascular system' },
  'sys:respiratory': { type: 'BodySystem', label: 'respiratory system' },
  'sys:neurological': { type: 'BodySystem', label: 'nervous system' },
  'sys:gastrointestinal': { type: 'BodySystem', label: 'digestive system' },
  'sys:skin': { type: 'BodySystem', label: 'skin' },
  'sys:mental': { type: 'BodySystem', label: 'mental health' },
  'sys:systemic': { type: 'BodySystem', label: 'whole body' },

  // symptoms — SNOMED CT / ICD-10 codes given where they are well established
  'sym:chest_pain': {
    type: 'Symptom',
    label: 'chest pain',
    aliases: ['chest pain', 'pain in my chest', 'pain in the chest', 'chest tightness', 'tightness in my chest', 'pressure in my chest', 'chest pressure', 'cp'],
    codes: { snomed: '29857009', icd10: 'R07.9' },
  },
  'sym:dyspnea': {
    type: 'Symptom',
    label: 'shortness of breath',
    aliases: ['shortness of breath', 'short of breath', 'breathless', 'breathlessness', 'cannot breathe', "can't breathe", 'difficulty breathing', 'trouble breathing', 'sob'],
    codes: { snomed: '267036007', icd10: 'R06.02' },
  },
  'sym:palpitations': {
    type: 'Symptom',
    label: 'palpitations',
    aliases: ['palpitations', 'heart racing', 'racing heart', 'heart flutter', 'irregular heartbeat', 'pounding heart'],
    codes: { snomed: '80313002', icd10: 'R00.2' },
  },
  'sym:dizziness': {
    type: 'Symptom',
    label: 'dizziness',
    aliases: ['dizzy', 'dizziness', 'light headed', 'light-headed', 'giddy'],
    codes: { snomed: '404640003', icd10: 'R42' },
  },
  'sym:fever': {
    type: 'Symptom',
    label: 'fever',
    aliases: ['fever', 'high temperature', 'temperature', 'feverish', 'hot and shivery'],
    codes: { snomed: '386661006', icd10: 'R50.9' },
  },
  'sym:cough': {
    type: 'Symptom',
    label: 'cough',
    aliases: ['cough', 'coughing', 'dry cough', 'wet cough'],
    codes: { snomed: '49727002', icd10: 'R05' },
  },
  'sym:headache': {
    type: 'Symptom',
    label: 'headache',
    aliases: ['headache', 'head pain', 'migraine', 'head is pounding'],
    codes: { snomed: '25064002', icd10: 'R51' },
  },
  'sym:abdominal_pain': {
    type: 'Symptom',
    label: 'abdominal pain',
    aliases: ['stomach pain', 'stomach ache', 'belly pain', 'abdominal pain', 'tummy pain', 'stomach cramps'],
    codes: { snomed: '21522001', icd10: 'R10.9' },
  },
  'sym:vomiting': {
    type: 'Symptom',
    label: 'vomiting',
    aliases: ['vomiting', 'throwing up', 'being sick', 'vomited'],
    codes: { snomed: '422400008', icd10: 'R11.10' },
  },
  'sym:rash': {
    type: 'Symptom',
    label: 'rash',
    aliases: ['rash', 'hives', 'spots on my skin', 'skin outbreak', 'red patches'],
    codes: { snomed: '271807003', icd10: 'R21' },
  },
  'sym:low_mood': {
    type: 'Symptom',
    label: 'low mood',
    aliases: ['low mood', 'feeling low', 'feel low', 'feeling down', 'feel down', 'depressed', 'depression', 'hopeless', 'sad all the time', 'no energy'],
    codes: { snomed: '366979004', icd10: 'R45.2' },
  },
  'sym:anxiety': {
    type: 'Symptom',
    label: 'anxiety',
    aliases: ['anxiety', 'anxious', 'panic', 'panic attack', 'on edge', 'racing thoughts', 'worried all the time'],
    codes: { snomed: '48694002', icd10: 'R45.0' },
  },
  'sym:sleep_problems': {
    type: 'Symptom',
    label: 'sleep problems',
    aliases: ['cannot sleep', "can't sleep", 'insomnia', 'not sleeping', 'trouble sleeping', 'wake up at night', 'broken sleep'],
    codes: { snomed: '193462001', icd10: 'G47.00' },
  },
  'sym:fatigue': {
    type: 'Symptom',
    label: 'fatigue',
    aliases: ['tired', 'tiredness', 'fatigue', 'exhausted', 'no energy left'],
    codes: { snomed: '84229001', icd10: 'R53.83' },
  },
  'sym:heavy_bleeding': {
    type: 'Symptom',
    label: 'heavy bleeding',
    aliases: ['heavy bleeding', 'bleeding a lot', 'bleeding heavily', 'soaking pads', 'bleeding between periods'],
    codes: { snomed: '86252004', icd10: 'N93.9' },
  },

  // risk factors / history the agent should ask about (not current complaints)
  'sym:age_risk': {
    type: 'Symptom',
    label: 'age and cardiac risk',
    aliases: ['blood pressure', 'bp', 'hypertension', 'cholesterol', 'diabetes', 'smoker', 'smoking', 'chest pain history'],
  },

  // conditions — never diagnosable by the agent (enforced by the audit)
  'cond:acute_coronary_syndrome': {
    type: 'Condition',
    label: 'acute coronary syndrome',
    diagnosable: false,
    question: 'being suspected needs emergency assessment, not reassurance',
    assertionRules: ['may suggest a heart problem', 'needs emergency assessment', 'never say the patient is having a heart attack'],
  },
  'cond:stable_angina': {
    type: 'Condition',
    label: 'stable angina',
    diagnosable: false,
    assertionRules: ['may be worth a cardiology review', 'never name it as certain'],
  },
  'cond:arrhythmia': { type: 'Condition', label: 'arrhythmia', diagnosable: false, assertionRules: ['may be worth a heart rhythm check'] },
  'cond:anxiety_related_chest_pain': { type: 'Condition', label: 'chest pain linked to anxiety', diagnosable: false, assertionRules: ['never rules out a heart cause on its own'] },
  'cond:viral_illness': { type: 'Condition', label: 'viral illness', diagnosable: false, assertionRules: ['may be a simple infection', 'never state it as certain'] },
  'cond:respiratory_infection': { type: 'Condition', label: 'respiratory infection', diagnosable: false, assertionRules: ['may need a chest review if breathing changes'] },
  'cond:migraine': { type: 'Condition', label: 'migraine', diagnosable: false, assertionRules: ['may fit a migraine pattern', 'never diagnose from chat'] },
  'cond:gastroenteritis': { type: 'Condition', label: 'gastroenteritis', diagnosable: false, assertionRules: ['may be a stomach bug', 'watch for dehydration'] },
  'cond:dermatitis': { type: 'Condition', label: 'dermatitis', diagnosable: false, assertionRules: ['may be a skin irritation', 'never name it as certain'] },
  'cond:depressive_episode': { type: 'Condition', label: 'depressive episode', diagnosable: false, assertionRules: ['offer support and a clinician, never a label'] },
  'cond:insomnia': { type: 'Condition', label: 'insomnia', diagnosable: false, assertionRules: ['talk about sleep habits, never diagnose'] },
  'cond:panic_disorder': { type: 'Condition', label: 'panic attacks', diagnosable: false, assertionRules: ['describe the experience, never label the person'] },
  'cond:febrile_illness_child': { type: 'Condition', label: 'febrile illness in a child', diagnosable: false, assertionRules: ['children need age-specific red flags, never reassure blindly'] },
  'cond:anaemia': { type: 'Condition', label: 'anaemia', diagnosable: false, assertionRules: ['may need a blood test'] },

  // red flags
  'rf:radiating_pain': { type: 'RedFlag', label: 'pain spreading to arm, jaw or back', action: 'emergency' },
  'rf:sweating_with_pain': { type: 'RedFlag', label: 'sweating with the chest pain', action: 'emergency' },
  'rf:breathless_at_rest': { type: 'RedFlag', label: 'breathless at rest', action: 'emergency' },
  'rf:fainting': { type: 'RedFlag', label: 'fainting or near-fainting', action: 'emergency' },
  'rf:blue_lips': { type: 'RedFlag', label: 'blue lips or face', action: 'emergency' },
  'rf:stiff_neck': { type: 'RedFlag', label: 'fever with a stiff neck', action: 'emergency' },
  'rf:non_blanching_rash': { type: 'RedFlag', label: 'rash that does not fade when pressed', action: 'emergency' },
  'rf:rigid_abdomen': { type: 'RedFlag', label: 'rigid, very tender abdomen', action: 'emergency' },
  'rf:vomiting_blood': { type: 'RedFlag', label: 'vomiting blood', action: 'emergency' },
  'rf:worst_headache': { type: 'RedFlag', label: 'sudden worst-ever headache', action: 'emergency' },
  'rf:neurological_deficit': { type: 'RedFlag', label: 'weakness, slurred speech or face droop', action: 'emergency' },
  'rf:self_harm': { type: 'RedFlag', label: 'thoughts of self-harm or not wanting to live', action: 'emergency' },
  'rf:no_urine': { type: 'RedFlag', label: 'no urine for a day in a child', action: 'urgent' },
  'rf:child_lethargy': { type: 'RedFlag', label: 'child floppy, drowsy or not waking', action: 'emergency' },
  'rf:high_bp_symptoms': { type: 'RedFlag', label: 'very high blood pressure with headache or blurred vision', action: 'urgent' },

  // questions
  'q:onset': { type: 'Question', label: 'when it started' },
  'q:radiation': { type: 'Question', label: 'whether it spreads to the arm, jaw or back' },
  'q:associated_sweat': { type: 'Question', label: 'whether it comes with sweating or breathlessness' },
  'q:exertion': { type: 'Question', label: 'whether it comes on with effort and eases at rest' },
  'q:duration_days': { type: 'Question', label: 'how many days it has lasted' },
  'q:temperature': { type: 'Question', label: 'the highest measured temperature' },
  'q:rash_appearance': { type: 'Question', label: 'where the rash started and whether it fades when pressed' },
  'q:rash_itch': { type: 'Question', label: 'whether it itches or is spreading' },
  'q:child_age': { type: 'Question', label: "the child's age" },
  'q:child_drinking': { type: 'Question', label: 'whether the child is drinking and alert' },
  'q:mood_duration': { type: 'Question', label: 'how long the low mood has lasted' },
  'q:sleep_pattern': { type: 'Question', label: 'what happens when they try to fall asleep' },
  'q:support': { type: 'Question', label: 'who is around them for support' },
  'q:abdomen_site': { type: 'Question', label: 'where the pain sits and whether eating changes it' },
  'q:bleeding_amount': { type: 'Question', label: 'how heavy the bleeding is' },
  'q:associated_symptoms': { type: 'Question', label: 'what else came with it' },

  // age groups
  'age:infant': { type: 'AgeGroup', label: 'infant under 3 months' },
  'age:child': { type: 'AgeGroup', label: 'child' },
  'age:adult': { type: 'AgeGroup', label: 'adult' },
}

// ---------------------------------------------------------------- asserted triples

const TRIPLES = [
  // IS_A: symptoms → systems
  ['sym:chest_pain', 'IS_A', 'sys:cardiovascular'],
  ['sym:dyspnea', 'IS_A', 'sys:respiratory'],
  ['sym:palpitations', 'IS_A', 'sys:cardiovascular'],
  ['sym:dizziness', 'IS_A', 'sys:neurological'],
  ['sym:headache', 'IS_A', 'sys:neurological'],
  ['sym:fever', 'IS_A', 'sys:systemic'],
  ['sym:cough', 'IS_A', 'sys:respiratory'],
  ['sym:abdominal_pain', 'IS_A', 'sys:gastrointestinal'],
  ['sym:vomiting', 'IS_A', 'sys:gastrointestinal'],
  ['sym:rash', 'IS_A', 'sys:skin'],
  ['sym:low_mood', 'IS_A', 'sys:mental'],
  ['sym:anxiety', 'IS_A', 'sys:mental'],
  ['sym:sleep_problems', 'IS_A', 'sys:mental'],
  ['sym:fatigue', 'IS_A', 'sys:systemic'],
  ['sym:heavy_bleeding', 'IS_A', 'sys:systemic'],

  // conditions → symptoms
  ['cond:acute_coronary_syndrome', 'HAS_SYMPTOM', 'sym:chest_pain'],
  ['cond:acute_coronary_syndrome', 'HAS_SYMPTOM', 'sym:dyspnea'],
  ['cond:stable_angina', 'HAS_SYMPTOM', 'sym:chest_pain'],
  ['cond:arrhythmia', 'HAS_SYMPTOM', 'sym:palpitations'],
  ['cond:arrhythmia', 'HAS_SYMPTOM', 'sym:dizziness'],
  ['cond:anxiety_related_chest_pain', 'HAS_SYMPTOM', 'sym:chest_pain'],
  ['cond:anxiety_related_chest_pain', 'HAS_SYMPTOM', 'sym:anxiety'],
  ['cond:viral_illness', 'HAS_SYMPTOM', 'sym:fever'],
  ['cond:viral_illness', 'HAS_SYMPTOM', 'sym:fatigue'],
  ['cond:respiratory_infection', 'HAS_SYMPTOM', 'sym:cough'],
  ['cond:respiratory_infection', 'HAS_SYMPTOM', 'sym:dyspnea'],
  ['cond:migraine', 'HAS_SYMPTOM', 'sym:headache'],
  ['cond:gastroenteritis', 'HAS_SYMPTOM', 'sym:abdominal_pain'],
  ['cond:gastroenteritis', 'HAS_SYMPTOM', 'sym:vomiting'],
  ['cond:dermatitis', 'HAS_SYMPTOM', 'sym:rash'],
  ['cond:depressive_episode', 'HAS_SYMPTOM', 'sym:low_mood'],
  ['cond:depressive_episode', 'HAS_SYMPTOM', 'sym:sleep_problems'],
  ['cond:insomnia', 'HAS_SYMPTOM', 'sym:sleep_problems'],
  ['cond:panic_disorder', 'HAS_SYMPTOM', 'sym:anxiety'],
  ['cond:panic_disorder', 'HAS_SYMPTOM', 'sym:palpitations'],
  ['cond:febrile_illness_child', 'HAS_SYMPTOM', 'sym:fever'],
  ['cond:febrile_illness_child', 'HAS_SYMPTOM', 'sym:rash'],
  ['cond:anaemia', 'HAS_SYMPTOM', 'sym:fatigue'],
  ['cond:anaemia', 'HAS_SYMPTOM', 'sym:dizziness'],

  // conditions → specialty
  ['cond:acute_coronary_syndrome', 'MANAGED_BY', 'spc:cardio'],
  ['cond:stable_angina', 'MANAGED_BY', 'spc:cardio'],
  ['cond:arrhythmia', 'MANAGED_BY', 'spc:cardio'],
  ['cond:anxiety_related_chest_pain', 'MANAGED_BY', 'spc:cardio'],
  ['cond:viral_illness', 'MANAGED_BY', 'spc:general'],
  ['cond:respiratory_infection', 'MANAGED_BY', 'spc:general'],
  ['cond:migraine', 'MANAGED_BY', 'spc:general'],
  ['cond:gastroenteritis', 'MANAGED_BY', 'spc:general'],
  ['cond:anaemia', 'MANAGED_BY', 'spc:general'],
  ['cond:dermatitis', 'MANAGED_BY', 'spc:skin'],
  ['cond:depressive_episode', 'MANAGED_BY', 'spc:therapy'],
  ['cond:insomnia', 'MANAGED_BY', 'spc:therapy'],
  ['cond:panic_disorder', 'MANAGED_BY', 'spc:therapy'],
  ['cond:febrile_illness_child', 'MANAGED_BY', 'spc:pediatrics'],

  // conditions → urgency
  ['cond:acute_coronary_syndrome', 'REQUIRES_URGENCY', 'urg:emergency'],
  ['cond:arrhythmia', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:stable_angina', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:anxiety_related_chest_pain', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:respiratory_infection', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:viral_illness', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:migraine', 'REQUIRES_URGENCY', 'urg:routine'],
  ['cond:gastroenteritis', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:dermatitis', 'REQUIRES_URGENCY', 'urg:routine'],
  ['cond:depressive_episode', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:insomnia', 'REQUIRES_URGENCY', 'urg:routine'],
  ['cond:panic_disorder', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:febrile_illness_child', 'REQUIRES_URGENCY', 'urg:soon'],
  ['cond:anaemia', 'REQUIRES_URGENCY', 'urg:soon'],

  // red flags
  ['cond:acute_coronary_syndrome', 'HAS_RED_FLAG', 'rf:radiating_pain'],
  ['cond:acute_coronary_syndrome', 'HAS_RED_FLAG', 'rf:sweating_with_pain'],
  ['cond:acute_coronary_syndrome', 'HAS_RED_FLAG', 'rf:breathless_at_rest'],
  ['cond:stable_angina', 'HAS_RED_FLAG', 'rf:radiating_pain'],
  ['cond:stable_angina', 'HAS_RED_FLAG', 'rf:fainting'],
  ['cond:arrhythmia', 'HAS_RED_FLAG', 'rf:fainting'],
  ['cond:respiratory_infection', 'HAS_RED_FLAG', 'rf:blue_lips'],
  ['cond:respiratory_infection', 'HAS_RED_FLAG', 'rf:breathless_at_rest'],
  ['cond:viral_illness', 'HAS_RED_FLAG', 'rf:stiff_neck'],
  ['cond:migraine', 'HAS_RED_FLAG', 'rf:worst_headache'],
  ['cond:migraine', 'HAS_RED_FLAG', 'rf:neurological_deficit'],
  ['cond:gastroenteritis', 'HAS_RED_FLAG', 'rf:rigid_abdomen'],
  ['cond:gastroenteritis', 'HAS_RED_FLAG', 'rf:vomiting_blood'],
  ['cond:dermatitis', 'HAS_RED_FLAG', 'rf:non_blanching_rash'],
  ['cond:depressive_episode', 'HAS_RED_FLAG', 'rf:self_harm'],
  ['cond:febrile_illness_child', 'HAS_RED_FLAG', 'rf:child_lethargy'],
  ['cond:febrile_illness_child', 'HAS_RED_FLAG', 'rf:no_urine'],
  ['cond:febrile_illness_child', 'HAS_RED_FLAG', 'rf:non_blanching_rash'],
  ['cond:anaemia', 'HAS_RED_FLAG', 'rf:fainting'],

  // questions
  ['cond:acute_coronary_syndrome', 'ASKS_QUESTION', 'q:onset'],
  ['cond:acute_coronary_syndrome', 'ASKS_QUESTION', 'q:radiation'],
  ['cond:acute_coronary_syndrome', 'ASKS_QUESTION', 'q:associated_sweat'],
  ['cond:stable_angina', 'ASKS_QUESTION', 'q:exertion'],
  ['cond:arrhythmia', 'ASKS_QUESTION', 'q:onset'],
  ['cond:viral_illness', 'ASKS_QUESTION', 'q:duration_days'],
  ['cond:viral_illness', 'ASKS_QUESTION', 'q:temperature'],
  ['cond:respiratory_infection', 'ASKS_QUESTION', 'q:duration_days'],
  ['cond:migraine', 'ASKS_QUESTION', 'q:associated_symptoms'],
  ['cond:gastroenteritis', 'ASKS_QUESTION', 'q:abdomen_site'],
  ['cond:dermatitis', 'ASKS_QUESTION', 'q:rash_appearance'],
  ['cond:dermatitis', 'ASKS_QUESTION', 'q:rash_itch'],
  ['cond:depressive_episode', 'ASKS_QUESTION', 'q:mood_duration'],
  ['cond:depressive_episode', 'ASKS_QUESTION', 'q:support'],
  ['cond:insomnia', 'ASKS_QUESTION', 'q:sleep_pattern'],
  ['cond:panic_disorder', 'ASKS_QUESTION', 'q:associated_symptoms'],
  ['cond:febrile_illness_child', 'ASKS_QUESTION', 'q:child_age'],
  ['cond:febrile_illness_child', 'ASKS_QUESTION', 'q:child_drinking'],

  // age-specific handling
  ['cond:febrile_illness_child', 'PRESENTS_IN', 'age:child'],
  ['cond:febrile_illness_child', 'PRESENTS_IN', 'age:infant'],
]

module.exports = { ENTITY_TYPES, PREDICATES, URGENCY_ORDER, NODES, TRIPLES }

/**
 * Routing layer — now a thin query front-end over the clinical knowledge graph.
 *
 * No clinical logic lives here: symptoms, conditions, specialties, urgency, red
 * flags and questions all come out of `knowledge/store.js` by traversal. This file
 * only decides which of Aurora's agents should answer, and formats the graph's
 * findings into the agent's system prompt.
 */

const { clinicalGraph: graph } = require('../knowledge/store')

/**
 * The one non-graph input: a patient explicitly asking for a service ("I want to
 * talk to a therapist"). That is a routing request, not a clinical finding, so it
 * is honoured directly — and reported as such.
 */
const EXPLICIT_REQUESTS = [
  { agent: 'therapy', pattern: /(therapist|therapy|counsell?or|counsell?ing|mental health|talk to someone|psycholog)/i },
  { agent: 'cardio', pattern: /(cardiologist|heart specialist|cardiology)/i },
  { agent: 'pediatrics', pattern: /(pediatrician|paediatrician|child specialist)/i },
  { agent: 'skin', pattern: /(dermatologist|skin specialist)/i },
  { agent: 'womens', pattern: /(gynaecologist|gynecologist|women'?s health)/i },
]

/** Symptoms that share a condition with this symptom — one traversal hop. */
function neighboursOf(symptomId) {
  const siblings = new Set()

  for (const condition of graph.objectsOf(symptomId, 'INDICATES_CONDITION')) {
    for (const other of graph.objectsOf(condition, 'HAS_SYMPTOM')) {
      if (other !== symptomId) siblings.add(other)
    }
  }

  return [...siblings]
}

function summarize(symptomId) {
  const node = graph.node(symptomId)
  const specialties = graph.objectsOf(symptomId, 'MANAGED_BY').map((id) => graph.label(id))
  const urgency = graph.urgencyFor([symptomId])
  const questions = graph.questionsFor([symptomId], 3)
  const flags = graph.flagsFor([symptomId]).map((flag) => flag.label)

  return {
    id: symptomId,
    name: node.label,
    codes: node.codes ?? null,
    specialty: specialties[0] ?? 'general medicine',
    specialties,
    urgency: urgency.level,
    urgencyReason: urgency.via,
    asks: questions,
    flags,
  }
}

function expandConcepts(text) {
  const resolution = graph.resolve(text)
  const symptomIds = resolution.concepts
    .filter((concept) => concept.type === 'Symptom')
    .map((concept) => concept.id)

  return {
    direct: symptomIds.map((id) => graph.label(id)),
    negated: resolution.negated.map((concept) => concept.label),
    related: [...new Set(symptomIds.flatMap(neighboursOf))].map((id) => graph.label(id)),
    nodes: symptomIds.map(summarize),
    urgency: graph.urgencyFor(symptomIds).level,
    conditions: graph.conditionsFor(symptomIds),
    symptomIds,
    resolution,
  }
}

function routeAgent(text) {
  const expanded = expandConcepts(text)
  const request = EXPLICIT_REQUESTS.find((hint) => hint.pattern.test(text))

  const ranked = graph.specialtiesFor(expanded.symptomIds)
  const top = ranked[0]

  const specialty = request ? request.agent : (top?.specialty ?? 'general')
  const total = ranked.reduce((sum, entry) => sum + entry.score, 0) || 1

  return {
    specialty,
    explicitRequest: Boolean(request),
    confidence: request ? 0.98 : Math.min(0.95, 0.4 + (top?.score ?? 0) / (total + 2)),
    alternatives: ranked.slice(0, 3).map((entry) => ({ specialty: entry.specialty, score: entry.score })),
    graph: expanded,
    urgency: expanded.urgency,
    redFlags: expanded.nodes.flatMap((node) => node.flags),
    conditions: expanded.conditions,
  }
}

/** The prompt block: graph facts, questions to ask, flags not to miss. */
function graphPrompt(route) {
  const { graph: facts } = route

  const header = facts.nodes.length
    ? 'Knowledge graph for this message (queried from the clinical ontology):'
    : 'No clinical concepts were recognised in this message.'

  const lines = facts.nodes.slice(0, 5).map((node) => {
    const codes = node.codes?.snomed ? ` [SNOMED ${node.codes.snomed}${node.codes.icd10 ? `, ICD-10 ${node.codes.icd10}` : ''}]` : ''
    const asks = node.asks.length ? ` ask about: ${node.asks.join('; ')}.` : ''
    const flags = node.flags.length ? ` red flags to check: ${node.flags.join('; ')}.` : ''
    return `- ${node.name}${codes} → ${node.specialty}, urgency ${node.urgency}.${asks}${flags}`
  })

  const negated = facts.negated.length
    ? `\nThe patient explicitly denies: ${facts.negated.join(', ')}. Do not treat these as present.`
    : ''

  const safety = facts.conditions.length
    ? `\nPossible conditions from the graph (never state one as certain — this is enforced on every Condition node):\n${facts.conditions
        .map((condition) => `- ${condition.label}: ${condition.safety[0] ?? 'discuss with a clinician'}`)
        .join('\n')}`
    : ''

  return `${header}
${lines.join('\n')}${negated}${safety}
Overall urgency signal: ${facts.urgency}.`
}

module.exports = { routeAgent, expandConcepts, graphPrompt, graph }

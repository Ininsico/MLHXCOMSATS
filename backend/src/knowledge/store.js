/**
 * A small, real graph store over the clinical ontology.
 *
 * What it gives the app:
 *   · triples, not dictionaries — every edge is subject – predicate – object with a
 *     type-checked domain and range (validate() fails on illegal edges)
 *   · inference — IS_A transitive closure, inverse materialisation, and rules that
 *     derive specialty, urgency, red flags and questions for a symptom through the
 *     conditions it indicates (so "chest pain" reaches cardiology by traversal)
 *   · entity resolution — aliases, abbreviations, spelling variants (edit distance)
 *     and negation windows, mapping text to canonical concept ids
 *   · a query interface — pattern queries, path traversal, and a Cypher export so
 *     the same graph can be loaded into Neo4j without changing the model
 */

const { ENTITY_TYPES, PREDICATES, URGENCY_ORDER, NODES, TRIPLES } = require('./ontology')

const NEGATION_CUES = new Set([
  'no', 'not', 'never', 'without', 'denies', 'denied', 'negative', 'none',
  'stopped', 'resolved', 'settled', 'minus', 'nil',
])

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Damerau-lite: plain Levenshtein distance, used only for spelling variants. */
function editDistance(left, right) {
  const rows = left.length + 1
  const cols = right.length + 1
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0))

  for (let i = 0; i < rows; i += 1) grid[i][0] = i
  for (let j = 0; j < cols; j += 1) grid[0][j] = j

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + cost)
    }
  }

  return grid[left.length][right.length]
}

class ClinicalGraph {
  constructor({ nodes = NODES, triples = TRIPLES, predicates = PREDICATES } = {}) {
    this.nodes = { ...nodes }
    this.predicates = predicates
    this.triples = triples.map(([s, p, o]) => ({ s, p, o, inferred: false }))
    this.aliasIndex = new Map()

    this.#buildAliasIndex()
    this.#materialise()
    this.infer()
  }

  // ------------------------------------------------------------ graph primitives

  node(id) {
    return this.nodes[id] ?? null
  }

  label(id) {
    return this.nodes[id]?.label ?? id
  }

  typeOf(id) {
    return this.nodes[id]?.type ?? null
  }

  /** Pattern query — the store's read interface ({} returns everything). */
  query({ subject = null, predicate = null, object = null, inferred = null } = {}) {
    return this.triples.filter(
      (triple) =>
        (!subject || triple.s === subject) &&
        (!predicate || triple.p === predicate) &&
        (!object || triple.o === object) &&
        (inferred === null || triple.inferred === inferred),
    )
  }

  objectsOf(subject, predicate) {
    return this.query({ subject, predicate }).map((triple) => triple.o)
  }

  subjectsOf(predicate, object) {
    return this.query({ predicate, object }).map((triple) => triple.s)
  }

  /** Shortest directed path between two concepts — how routing is explainable. */
  path(fromId, toId, maxDepth = 4) {
    const queue = [[fromId]]
    const seen = new Set([fromId])

    while (queue.length) {
      const trail = queue.shift()
      const current = trail[trail.length - 1]

      if (current === toId) return trail
      if (trail.length > maxDepth) continue

      const next = [...this.query({ subject: current }).map((t) => t.o), ...this.subjectsOf('IS_A', current)]

      for (const candidate of next) {
        if (seen.has(candidate)) continue
        seen.add(candidate)
        queue.push([...trail, candidate])
      }
    }

    return null
  }

  // ------------------------------------------------------------ schema checking

  validate() {
    const errors = []
    const warnings = []

    for (const triple of this.triples) {
      const predicate = this.predicates[triple.p]

      if (!predicate) {
        errors.push(`unknown predicate ${triple.p}`)
        continue
      }

      const subjectType = this.typeOf(triple.s)
      const objectType = this.typeOf(triple.o)

      if (!subjectType) errors.push(`unknown subject ${triple.s}`)
      else if (!predicate.domain.includes(subjectType)) {
        errors.push(`${triple.p} domain violation: ${triple.s} is a ${subjectType}`)
      }

      if (!objectType) errors.push(`unknown object ${triple.o}`)
      else if (!predicate.range.includes(objectType)) {
        errors.push(`${triple.p} range violation: ${triple.o} is a ${objectType}`)
      }
    }

    // Safety is enforced by the schema, not by whoever writes the prompt.
    for (const [id, node] of Object.entries(this.nodes)) {
      if (node.type === 'Condition') {
        if (node.diagnosable !== false) errors.push(`${id}: Condition must set diagnosable: false`)
        if (!node.assertionRules?.length) errors.push(`${id}: Condition needs assertionRules`)
      }
    }

    for (const id of Object.keys(this.nodes)) {
      const used =
        this.triples.some((triple) => triple.s === id || triple.o === id) ||
        this.typeOf(id) === 'UrgencyLevel'

      if (!used) warnings.push(`${id}: orphan node (no edges)`)
    }

    return { ok: errors.length === 0, errors, warnings }
  }

  // ------------------------------------------------------------ inference

  #buildAliasIndex() {
    for (const [id, node] of Object.entries(this.nodes)) {
      for (const alias of node.aliases ?? []) {
        this.aliasIndex.set(normalize(alias), id)
      }
    }
  }

  #materialise() {
    const added = []

    for (const triple of [...this.triples]) {
      const predicate = this.predicates[triple.p]

      if (predicate?.inverse) {
        added.push({ s: triple.o, p: predicate.inverse, o: triple.s, inferred: true, rule: 'R0:inverse_materialised' })
      }
    }

    const existing = new Set(this.triples.map((t) => `${t.s}|${t.p}|${t.o}`))

    for (const triple of added) {
      const key = `${triple.s}|${triple.p}|${triple.o}`
      if (!existing.has(key)) {
        this.triples.push(triple)
        existing.add(key)
      }
    }
  }

  /**
   * Rule engine. Every derived edge is stored with inferred: true and the rule that
   * produced it, so the routing decision can be explained edge by edge.
   */
  infer() {
    const existing = new Set(this.triples.map((t) => `${t.s}|${t.p}|${t.o}`))
    const derived = []

    const add = (s, p, o, rule) => {
      const key = `${s}|${p}|${o}`
      if (existing.has(key)) return
      existing.add(key)
      derived.push({ s, p, o, inferred: true, rule })
    }

    let changed = true

    while (changed) {
      changed = false

      // R1 — IS_A transitivity
      for (const [id] of Object.entries(this.nodes)) {
        const direct = this.objectsOf(id, 'IS_A')
        for (const parent of direct) {
          for (const grandparent of this.objectsOf(parent, 'IS_A')) {
            const before = derived.length
            add(id, 'IS_A', grandparent, 'R1:IS_A_transitive')
            if (derived.length > before) changed = true
          }
        }
      }

      // R2 — symptom inherits the specialty of every condition it may indicate
      for (const symptom of this.subjectsOf('IS_A', 'sys:cardiovascular').concat(
        this.triples.filter((t) => t.p === 'IS_A').map((t) => t.s),
      )) {
        for (const condition of this.objectsOf(symptom, 'INDICATES_CONDITION')) {
          for (const specialty of this.objectsOf(condition, 'MANAGED_BY')) {
            const before = derived.length
            add(symptom, 'MANAGED_BY', specialty, 'R2:symptom_specialty_via_condition')
            if (derived.length > before) changed = true
          }

          // R3/R4 — red flags and questions travel with the condition
          for (const flag of this.objectsOf(condition, 'HAS_RED_FLAG')) {
            const before = derived.length
            add(symptom, 'HAS_RED_FLAG', flag, 'R3:redflag_inherited_by_symptom')
            if (derived.length > before) changed = true
          }

          for (const question of this.objectsOf(condition, 'ASKS_QUESTION')) {
            const before = derived.length
            add(symptom, 'ASKS_QUESTION', question, 'R4:question_inherited_by_symptom')
            if (derived.length > before) changed = true
          }

          for (const urgency of this.objectsOf(condition, 'REQUIRES_URGENCY')) {
            const before = derived.length
            add(symptom, 'REQUIRES_URGENCY', urgency, 'R5:urgency_inherited_by_symptom')
            if (derived.length > before) changed = true
          }
        }
      }
    }

    this.triples.push(...derived)

    return derived
  }

  // ------------------------------------------------------------ entity resolution

  /**
   * Map free text to canonical concept ids.
   * Handles aliases, abbreviations, spelling variants, and negation windows.
   */
  resolve(text) {
    const message = normalize(text)
    const matches = new Map()

    // longest aliases first so "pain in my chest" wins over "chest pain"
    const aliases = [...this.aliasIndex.keys()].sort((left, right) => right.length - left.length)

    for (const alias of aliases) {
      const pattern = new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`, 'g')
      let hit = pattern.exec(message)

      while (hit) {
        const id = this.aliasIndex.get(alias)
        const start = hit.index + hit[1].length

        if (!matches.has(id) || matches.get(id).start > start) {
          matches.set(id, { id, start, matched: alias })
        }

        hit = pattern.exec(message)
      }
    }

    // spelling variants: tokens close to a known alias token
    const tokens = message.split(' ')

    for (const token of tokens) {
      if (token.length < 6) continue
      if (this.aliasIndex.has(token)) continue

      for (const alias of aliases) {
        if (alias.includes(' ') || Math.abs(alias.length - token.length) > 1) continue

        if (editDistance(token, alias) === 1) {
          const id = this.aliasIndex.get(alias)
          const start = message.indexOf(token)

          if (!matches.has(id)) matches.set(id, { id, start, matched: `${token}→${alias}` })
          break
        }
      }
    }

    // negation: a cue in the three tokens before the match flips it
    const negated = []
    const concepts = []

    for (const match of matches.values()) {
      const before = message.slice(0, match.start).trim().split(' ').slice(-3)
      const isNegated = before.some((token) => NEGATION_CUES.has(token))
      const node = this.node(match.id)

      const entry = {
        id: match.id,
        label: node.label,
        type: node.type,
        matched: match.matched,
        negated: isNegated,
        codes: node.codes ?? null,
      }

      if (isNegated) negated.push(entry)
      else concepts.push(entry)
    }

    return { concepts, negated, all: [...concepts, ...negated] }
  }

  // ------------------------------------------------------------ routing helpers

  /** Rank specialties for a set of symptom ids by traversing to their conditions. */
  specialtiesFor(ids) {
    const scores = new Map()

    for (const id of ids) {
      for (const specialty of this.objectsOf(id, 'MANAGED_BY')) {
        const conditionCount = this.objectsOf(id, 'INDICATES_CONDITION').filter((condition) =>
          this.objectsOf(condition, 'MANAGED_BY').includes(specialty),
        ).length

        const agent = this.node(specialty)?.agent ?? specialty
        const entry = scores.get(agent) ?? { specialty: agent, specialtyId: specialty, score: 0, via: [] }

        entry.score += 2 + conditionCount
        entry.via.push(...this.objectsOf(id, 'INDICATES_CONDITION').filter((condition) =>
          this.objectsOf(condition, 'MANAGED_BY').includes(specialty),
        ))
        scores.set(agent, entry)
      }
    }

    return [...scores.values()]
      .map((entry) => ({ ...entry, via: [...new Set(entry.via.map((id) => this.label(id)))] }))
      .sort((left, right) => right.score - left.score)
  }

  /** Highest urgency demanded by anything these symptoms may indicate. */
  urgencyFor(ids) {
    let worst = { level: 'routine', rank: 0, via: [] }

    for (const id of ids) {
      const levels = new Set([
        ...this.objectsOf(id, 'REQUIRES_URGENCY'),
        ...this.objectsOf(id, 'INDICATES_CONDITION').flatMap((condition) =>
          this.objectsOf(condition, 'REQUIRES_URGENCY'),
        ),
      ])

      for (const level of levels) {
        const rank = this.node(level)?.rank ?? URGENCY_ORDER[this.label(level)] ?? 0

        if (rank > worst.rank) {
          worst = {
            level: this.label(level),
            rank,
            via: this.objectsOf(id, 'INDICATES_CONDITION')
              .filter((condition) => this.objectsOf(condition, 'REQUIRES_URGENCY').includes(level))
              .map((condition) => this.label(condition)),
          }
        }
      }
    }

    return worst
  }

  flagsFor(ids) {
    const seen = new Map()

    for (const id of ids) {
      const direct = this.objectsOf(id, 'HAS_RED_FLAG')
      const inherited = this.objectsOf(id, 'INDICATES_CONDITION').flatMap((condition) =>
        this.objectsOf(condition, 'HAS_RED_FLAG'),
      )

      for (const flag of [...direct, ...inherited]) {
        if (!seen.has(flag)) seen.set(flag, { label: this.label(flag), action: this.node(flag)?.action ?? 'urgent' })
      }
    }

    return [...seen.values()]
  }

  questionsFor(ids, limit = 4) {
    const seen = new Set()

    for (const id of ids) {
      for (const question of this.objectsOf(id, 'ASKS_QUESTION')) {
        seen.add(this.label(question))
        if (seen.size >= limit) return [...seen]
      }
    }

    return [...seen]
  }

  conditionsFor(ids) {
    const seen = new Map()

    for (const id of ids) {
      for (const condition of this.objectsOf(id, 'INDICATES_CONDITION')) {
        const node = this.node(condition)
        seen.set(condition, {
          id: condition,
          label: node.label,
          diagnosable: node.diagnosable === true,
          safety: node.assertionRules ?? [],
        })
      }
    }

    return [...seen.values()]
  }

  /** Export the same graph as Cypher so it can be loaded into Neo4j unchanged. */
  toCypher() {
    const lines = []

    for (const [id, node] of Object.entries(this.nodes)) {
      const variable = `n${id.replace(/\W/g, '_')}`
      const props = [`id: '${id}'`, `label: '${node.label.replace(/'/g, "\\'")}'`]

      if (node.diagnosable !== undefined) props.push(`diagnosable: ${node.diagnosable}`)
      if (node.codes?.snomed) props.push(`snomed: '${node.codes.snomed}'`)
      if (node.codes?.icd10) props.push(`icd10: '${node.codes.icd10}'`)

      lines.push(`MERGE (${variable}:${node.type} { ${props.join(', ')} })`)
    }

    for (const triple of this.triples) {
      const subject = `n${triple.s.replace(/\W/g, '_')}`
      const object = `n${triple.o.replace(/\W/g, '_')}`

      lines.push(`MERGE (${subject})-[:${triple.p}]->(${object})`)
    }

    return lines.join('\n')
  }

  stats() {
    const asserted = this.triples.filter((triple) => !triple.inferred).length

    return {
      nodes: Object.keys(this.nodes).length,
      triples: this.triples.length,
      asserted,
      inferred: this.triples.length - asserted,
      predicates: Object.keys(this.predicates).length,
      types: Object.keys(ENTITY_TYPES).length,
      conceptsWithCodes: Object.values(this.nodes).filter((node) => node.codes?.snomed).length,
    }
  }
}

const clinicalGraph = new ClinicalGraph()

module.exports = { ClinicalGraph, clinicalGraph }

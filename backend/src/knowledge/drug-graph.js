/**
 * Drug knowledge graph. Same store, same reasoning engine as the clinical graph —
 * it just carries drug nodes and the predicates drugs need. Because the clinical
 * concepts are merged in, one traversal can go:
 *
 *   ibuprofen → NSAID → CONTRAINDICATED_IN → gastroenteritis → MANAGED_BY → general medicine
 *
 * Only well-established, textbook interactions are seeded. Anything uncertain stays
 * out until a clinician signs it off.
 */

const { ClinicalGraph } = require('./store')
const { NODES: CLINICAL_NODES } = require('./ontology')

const PREDICATES = {
  IS_A: {
    domain: ['Drug', 'DrugClass', 'Symptom', 'Condition', 'Specialty', 'BodySystem', 'AgeGroup'],
    range: ['DrugClass', 'Symptom', 'Condition', 'Specialty', 'BodySystem', 'AgeGroup'],
    transitive: true,
    doc: 'the subject is a kind of the object (drug → its class)',
  },
  INTERACTS_WITH: {
    domain: ['Drug', 'DrugClass'],
    range: ['Drug', 'DrugClass'],
    symmetric: true,
    inverse: 'INTERACTS_WITH',
    doc: 'a clinically relevant interaction between the two (direction-free)',
  },
  CONTRAINDICATED_IN: {
    domain: ['Drug', 'DrugClass'],
    range: ['Condition'],
    doc: 'avoid this drug in that condition',
  },
}

const NODES = {
  ...CLINICAL_NODES,

  // classes
  'cls:nsaid': { type: 'DrugClass', label: 'NSAID', aliases: ['nsaid', 'nsaids', 'ibuprofen class', 'anti inflammatory'] },
  'cls:anticoagulant': { type: 'DrugClass', label: 'anticoagulant', aliases: ['anticoagulant', 'blood thinner', 'blood thinners'] },
  'cls:ace_inhibitor': { type: 'DrugClass', label: 'ACE inhibitor', aliases: ['ace inhibitor', 'ace inhibitors', 'acei'] },
  'cls:ssri': { type: 'DrugClass', label: 'SSRI', aliases: ['ssri', 'ssris', 'antidepressant', 'antidepressants'] },
  'cls:biguanide': { type: 'DrugClass', label: 'biguanide', aliases: ['biguanide', 'metformin class'] },
  'cls:beta_blocker': { type: 'DrugClass', label: 'beta blocker', aliases: ['beta blocker', 'beta blockers'] },
  'cls:penicillin': { type: 'DrugClass', label: 'penicillin', aliases: ['penicillin', 'penicillins', 'beta lactam'] },

  // drugs
  'drug:ibuprofen': { type: 'Drug', label: 'ibuprofen', aliases: ['ibuprofen', 'brufen', 'advil', 'motrin'] },
  'drug:naproxen': { type: 'Drug', label: 'naproxen', aliases: ['naproxen', 'naprosyn'] },
  'drug:aspirin': { type: 'Drug', label: 'aspirin', aliases: ['aspirin', 'asa', 'ecosprin', 'disprin'] },
  'drug:warfarin': { type: 'Drug', label: 'warfarin', aliases: ['warfarin', 'coumadin'] },
  'drug:apixaban': { type: 'Drug', label: 'apixaban', aliases: ['apixaban', 'eliquis'] },
  'drug:enalapril': { type: 'Drug', label: 'enalapril', aliases: ['enalapril'] },
  'drug:lisinopril': { type: 'Drug', label: 'lisinopril', aliases: ['lisinopril'] },
  'drug:sertraline': { type: 'Drug', label: 'sertraline', aliases: ['sertraline', 'zoloft'] },
  'drug:fluoxetine': { type: 'Drug', label: 'fluoxetine', aliases: ['fluoxetine', 'prozac'] },
  'drug:metformin': { type: 'Drug', label: 'metformin', aliases: ['metformin', 'glucophage'] },
  'drug:atenolol': { type: 'Drug', label: 'atenolol', aliases: ['atenolol', 'tenormin'] },
  'drug:paracetamol': { type: 'Drug', label: 'paracetamol', aliases: ['paracetamol', 'acetaminophen', 'panadol', 'tylenol'] },
  'drug:amoxicillin': { type: 'Drug', label: 'amoxicillin', aliases: ['amoxicillin', 'amoxil'] },
}

const TRIPLES = [
  // drugs → classes
  ['drug:ibuprofen', 'IS_A', 'cls:nsaid'],
  ['drug:naproxen', 'IS_A', 'cls:nsaid'],
  ['drug:aspirin', 'IS_A', 'cls:nsaid'],
  ['drug:warfarin', 'IS_A', 'cls:anticoagulant'],
  ['drug:apixaban', 'IS_A', 'cls:anticoagulant'],
  ['drug:enalapril', 'IS_A', 'cls:ace_inhibitor'],
  ['drug:lisinopril', 'IS_A', 'cls:ace_inhibitor'],
  ['drug:sertraline', 'IS_A', 'cls:ssri'],
  ['drug:fluoxetine', 'IS_A', 'cls:ssri'],
  ['drug:metformin', 'IS_A', 'cls:biguanide'],
  ['drug:atenolol', 'IS_A', 'cls:beta_blocker'],
  ['drug:amoxicillin', 'IS_A', 'cls:penicillin'],

  // interactions (textbook only)
  ['drug:warfarin', 'INTERACTS_WITH', 'drug:ibuprofen'],
  ['drug:warfarin', 'INTERACTS_WITH', 'drug:naproxen'],
  ['drug:warfarin', 'INTERACTS_WITH', 'drug:aspirin'],
  ['drug:warfarin', 'INTERACTS_WITH', 'drug:fluoxetine'],
  ['drug:warfarin', 'INTERACTS_WITH', 'drug:sertraline'],
  ['drug:apixaban', 'INTERACTS_WITH', 'drug:ibuprofen'],
  ['drug:apixaban', 'INTERACTS_WITH', 'drug:naproxen'],
  ['drug:apixaban', 'INTERACTS_WITH', 'drug:aspirin'],
  ['cls:ssri', 'INTERACTS_WITH', 'cls:nsaid'],
  ['cls:ace_inhibitor', 'INTERACTS_WITH', 'cls:nsaid'],

  // contraindications
  ['cls:nsaid', 'CONTRAINDICATED_IN', 'cond:gastroenteritis'],
  ['cls:nsaid', 'CONTRAINDICATED_IN', 'cond:anaemia'],
]

/** Severity is deliberately explicit and reviewable, not inferred. */
const SEVERITY = {
  'drug:warfarin|drug:ibuprofen': 'serious',
  'drug:warfarin|drug:naproxen': 'serious',
  'drug:warfarin|drug:aspirin': 'serious',
  'drug:warfarin|drug:fluoxetine': 'serious',
  'drug:warfarin|drug:sertraline': 'caution',
  'drug:apixaban|drug:ibuprofen': 'serious',
  'drug:apixaban|drug:naproxen': 'serious',
  'drug:apixaban|drug:aspirin': 'serious',
  'cls:ssri|cls:nsaid': 'serious',
  'cls:ace_inhibitor|cls:nsaid': 'caution',
}

const EXPLAIN = {
  'cls:ssri|cls:nsaid': 'SSRIs with NSAIDs raise the risk of gastrointestinal bleeding.',
  'cls:ace_inhibitor|cls:nsaid': 'NSAIDs can blunt blood-pressure control and stress the kidneys on an ACE inhibitor.',
  'drug:warfarin|drug:fluoxetine': 'Both affect bleeding risk and can raise INR.',
  'drug:warfarin|drug:sertraline': 'Can increase bleeding risk — monitor.',
}

const drugGraph = new ClinicalGraph({ nodes: NODES, triples: TRIPLES, predicates: PREDICATES })

function keyFor(left, right) {
  return [left, right].sort().join('|')
}

/** Keys in the maps are hand-written, so look up both orders before giving up. */
function severityFor(left, right) {
  return SEVERITY[`${left}|${right}`] ?? SEVERITY[`${right}|${left}`] ?? 'caution'
}

/**
 * Check a proposed prescription against the drug graph and the patient's own card.
 * Returns warnings — it never blocks: the prescriber decides.
 */
function checkPrescription({ drugs = [], allergies = [], conditions = [] }) {
  const warnings = []

  const resolved = drugs.map((entry) => {
    const name = typeof entry === 'string' ? entry : entry?.drug
    const hits = drugGraph.resolve(name ?? '').concepts

    const drugNode = hits.find((concept) => concept.type === 'Drug') ?? null
    const classes = drugNode ? drugGraph.objectsOf(drugNode.id, 'IS_A') : []

    return { input: name, id: drugNode?.id ?? null, label: drugNode?.label ?? name, classes }
  })

  // 1. drug ↔ drug, including class-level links
  for (let i = 0; i < resolved.length; i += 1) {
    for (let j = i + 1; j < resolved.length; j += 1) {
      const left = resolved[i]
      const right = resolved[j]
      if (!left.id || !right.id) continue

      const candidates = [
        [left.id, right.id],
        ...left.classes.map((cls) => [cls, right.id]),
        ...right.classes.map((cls) => [left.id, cls]),
        ...left.classes.flatMap((a) => right.classes.map((b) => [a, b])),
      ]

      // Evaluate every linked pair and keep the worst: a class-level "caution" must
      // never mask a direct "serious" link between the two drugs themselves.
      const RANK = { info: 0, caution: 1, serious: 2 }
      let worst = null

      for (const [a, b] of candidates) {
        const linked =
          drugGraph.objectsOf(a, 'INTERACTS_WITH').includes(b) ||
          drugGraph.objectsOf(b, 'INTERACTS_WITH').includes(a)

        if (!linked) continue

        const severity =
          SEVERITY[`${a}|${b}`] ?? SEVERITY[`${b}|${a}`] ?? 'caution'
        const explanation =
          EXPLAIN[`${a}|${b}`] ??
          EXPLAIN[`${b}|${a}`] ??
          `${drugGraph.label(a)} and ${drugGraph.label(b)} interact — review before prescribing.`

        if (!worst || RANK[severity] > RANK[worst.severity]) {
          worst = { severity, explanation }
        }
      }

      if (worst) {
        warnings.push({
          severity: worst.severity,
          kind: 'interaction',
          message: `${left.label} + ${right.label}: ${worst.explanation}`,
        })
      }
    }
  }

  // 2. the patient's allergies, matched to the drug or any class it belongs to
  for (const allergy of allergies.filter((entry) => entry.substance)) {
    const hits = drugGraph.resolve(allergy.substance).concepts
    const ids = hits.map((hit) => hit.id)

    for (const drug of resolved) {
      const direct = ids.includes(drug.id)
      const viaClass = drug.classes.some((cls) => ids.includes(cls))
      const classMatch = drug.classes.some((cls) => ids.includes(cls))

      if (direct || viaClass || classMatch) {
        warnings.push({
          severity: 'serious',
          kind: 'allergy',
          message: `Allergy: the patient is allergic to ${allergy.substance}${
            allergy.reaction ? ` (${allergy.reaction})` : ''
          } — ${drug.label} matches it.`,
        })
      }
    }
  }

  // 3. conditions in the patient's card that the drug is contraindicated in
  for (const condition of conditions) {
    const hits = drugGraph.resolve(condition).concepts

    for (const hit of hits) {
      if (hit.type !== 'Condition') continue

      for (const drug of resolved) {
        const sources = [drug.id, ...drug.classes].filter(Boolean)
        const blocked = sources.some((source) =>
          drugGraph.objectsOf(source, 'CONTRAINDICATED_IN').includes(hit.id),
        )

        if (blocked) {
          warnings.push({
            severity: 'serious',
            kind: 'contraindication',
            message: `${drug.label} is contraindicated in ${hit.label}.`,
          })
        }
      }
    }
  }

  return { resolved, warnings }
}

module.exports = { drugGraph, checkPrescription, SEVERITY }

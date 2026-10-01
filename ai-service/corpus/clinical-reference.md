# Clinical reference notes

Plain-language guidance the Aurora assistant can quote. Written for this project from
general clinical knowledge; it is **not** a substitute for local protocols or a
clinician's judgement.

## Chest radiograph — common descriptors

- **Consolidation** — an area of increased density that obscures the underlying vessels,
  classically lobar or segmental. A common sign of bacterial pneumonia. Look for air
  bronchograms.
- **Ground-glass opacity** — hazy increased density that still lets vessels show through.
  Seen in viral pneumonitis, early oedema, and interstitial disease.
- **Pleural effusion** — fluid in the pleural space: blunting of the costophrenic angle,
  a meniscus, or a dense lower-zone band. Large effusions shift the mediastinum away.
- **Pneumothorax** — a visible pleural line with no lung markings beyond it; tension
  pneumothorax shifts the mediastinum and needs immediate attention.
- **Cardiomegaly** — cardiothoracic ratio above about 0.5 on a PA film.
- **Nodule or mass** — a rounded opacity; note size, edges, and whether it is solitary.
- **Fracture** — a cortical break; ribs are the usual site after trauma.

## Urgency language

- **Routine / low** — normal study or an incidental finding that needs no action.
- **Soon / moderate** — a real abnormality to review before the patient leaves.
- **Urgent / high** — a finding that needs immediate escalation: tension pneumothorax,
  free air, a large effusion with respiratory compromise, or a suspected acute
  vascular event.

## What an assistive model must never do

- Never state a definitive diagnosis from an image alone.
- Never prescribe medication or doses.
- Never replace the reviewing clinician; every output is a suggestion that a licensed
  professional confirms or overrides.

## Safety netting for triage

- Chest pain, breathlessness at rest, stroke signs, severe bleeding, or loss of
  consciousness are emergencies: contact emergency services immediately.
- Fever with a rash in a child, dehydration, or a fever lasting more than three days
  warrants a same-week review.
- Stable, long-standing complaints can be booked routinely.

# Aurora platform guide

How the hospital management system works — useful when a clinician or administrator asks
the assistant "how do I…" questions.

## Roles

- **Patient** — books appointments, reads released lab reports, manages their account.
- **Hospital** — applies through `/hospital/apply`, waits for admin approval, then keeps
  its public profile, staff, inventory, laboratory and marketplace listings up to date.
- **Doctor** — added by a hospital; signs in with a one-time email code; sees their own
  appointments, timetable, laboratory requests and the AI assistant.
- **Admin** — approves hospitals, reviews verification documents, manages plans and AI
  settings.

## Hospital workflow

1. **Apply** — hospital details, specialties and a logo; the admin is notified by email.
2. **Approval** — until approved the account stays on the processing screen.
3. **Verification** — upload registration documents; verified hospitals show a trust
   badge on their public page and can be listed with a premium theme.
4. **Operations** — staff (doctors, nurses, receptionists, laboratory), inventory with
   reorder levels, a laboratory catalogue with reference ranges, and an equipment
   marketplace where hospitals buy and sell.

## Appointments

Slots run 09:00-17:00 in 30-minute steps. A patient can book manually or let Aurora
suggest a doctor and the next free slot. Taken slots return a conflict asking for
another time. Hospitals confirm requests, then mark them completed.

## Laboratory flow

Requested → collected → processing → completed (results filed with automatic low/high
flags) → **sent** by the doctor. Only after the doctor releases it does the patient see
the report, including the interpretation and the report number.

## Inventory

Each item carries a quantity and a reorder level; movements are recorded as stock in,
stock out, or a corrected exact count, with a reason. Anything at or below its reorder
level is flagged on the dashboard.

## Marketplace

Hospitals list equipment with a category, condition (new / refurbished / used) and a
price. Another hospital reserves it, the seller marks it sold. Sellers cannot reserve
their own listings.

## AI assistant rules

- Runs **locally**; patient images and questions never leave the hospital machine.
- Only doctors and radiologists (and the admin) can use it; the admin can switch it off
  per department.
- Every analysis is logged with a hash of the image, the model version and the latency,
  and the doctor must confirm or override the finding.
- Outputs are assistive only and must be reviewed by a licensed clinician.

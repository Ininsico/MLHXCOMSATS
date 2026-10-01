const APP_NAME = 'Aurora'

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )
}

function layout({ heading, intro, body, outro }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f6fbf8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#4b5e55;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3ece7;border-radius:16px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#15803d;">${APP_NAME}</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#052e16;">${heading}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${intro}</p>
          ${body}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#62756b;">${outro}</p>
        </td>
      </tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#62756b;text-align:center;">
      ${APP_NAME} — appointments, records, prescriptions, and billing in one calm platform.
    </p>
  </body>
</html>`
}

function codeBlock(code) {
  return `<p style="margin:0 0 20px;padding:16px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;font-size:30px;font-weight:700;letter-spacing:0.3em;color:#052e16;text-align:center;">${code}</p>`
}

function otpEmail({ code, purpose, expiresInMinutes }) {
  const isReset = purpose === 'reset'

  return {
    subject: isReset ? 'Reset your Aurora password' : 'Your Aurora sign-in code',
    html: layout({
      heading: isReset ? 'Reset your password' : 'Here is your sign-in code',
      intro: isReset
        ? `Use this code to choose a new password. It expires in ${expiresInMinutes} minutes.`
        : `Use this code to finish signing in. It expires in ${expiresInMinutes} minutes.`,
      body: codeBlock(code),
      outro: `Didn't request this? You can ignore this email — no changes were made.`,
    }),
    text: `${isReset ? 'Reset your Aurora password' : 'Your Aurora sign-in code'}\n\nCode: ${code}\n\nIt expires in ${expiresInMinutes} minutes. If you didn't request this, ignore this email.`,
  }
}

function emailVerificationEmail({ code, expiresInMinutes }) {
  return {
    subject: 'Confirm your Aurora email',
    html: layout({
      heading: 'Confirm your email address',
      intro: `Enter this code to confirm your email. It expires in ${expiresInMinutes} minutes.`,
      body: codeBlock(code),
      outro: 'If you did not create an Aurora account, you can safely ignore this email.',
    }),
    text: `Confirm your Aurora email\n\nCode: ${code}\n\nIt expires in ${expiresInMinutes} minutes. If you did not create an Aurora account, ignore this email.`,
  }
}

function hospitalApplicationReceivedEmail({ hospitalName }) {
  return {
    subject: `We received your application — ${hospitalName}`,
    html: layout({
      heading: 'Your hospital application is in',
      intro: `Thanks for applying to bring <strong>${escapeHtml(hospitalName)}</strong> onto Aurora.`,
      body: `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Our team reviews every hospital before it goes live, so patients only find verified care. You will get an email the moment a decision is made — you can also check the status any time from your sign-in.</p>`,
      outro: 'Questions? Just reply to this email.',
    }),
    text: `Thanks for applying to bring ${hospitalName} onto Aurora.\n\nOur team reviews every hospital before it goes live. We will email you the moment a decision is made — you can also check the status any time from your sign-in.`,
  }
}

function hospitalApplicationAdminEmail({ hospitalName, city, area, contactEmail, specialties }) {
  const list = specialties?.length ? specialties.join(', ') : '—'

  return {
    subject: `New hospital application — ${hospitalName}`,
    html: layout({
      heading: 'A hospital wants to join Aurora',
      intro: `<strong>${escapeHtml(hospitalName)}</strong> submitted an application and is waiting for review.`,
      body: `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7;color:#4b5e55;">
          <tr><td style="padding-right:12px;color:#62756b;">Location</td><td style="color:#052e16;">${escapeHtml(area)}, ${escapeHtml(city)}</td></tr>
          <tr><td style="padding-right:12px;color:#62756b;">Contact</td><td style="color:#052e16;">${escapeHtml(contactEmail)}</td></tr>
          <tr><td style="padding-right:12px;color:#62756b;">Specialties</td><td style="color:#052e16;">${escapeHtml(list)}</td></tr>
        </table>`,
      outro: 'Approve or reject the request from the admin console.',
    }),
    text: `New hospital application: ${hospitalName}\nLocation: ${area}, ${city}\nContact: ${contactEmail}\nSpecialties: ${list}\n\nReview it in the admin console.`,
  }
}

function hospitalDecisionEmail({ hospitalName, approved }) {
  return {
    subject: approved
      ? `${hospitalName} is live on Aurora`
      : `Application update — ${hospitalName}`,
    html: layout({
      heading: approved ? 'You are approved' : 'We could not approve your application',
      intro: approved
        ? `<strong>${escapeHtml(hospitalName)}</strong> is now live on Aurora. Patients can find you by city, area, and specialty.`
        : `After review, we are not able to approve <strong>${escapeHtml(hospitalName)}</strong> at this time.`,
      body: approved
        ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Sign in to the hospital portal to keep your profile, specialties, and contact details up to date.</p>`
        : `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">If you believe this is a mistake, or your details have changed, reply to this email and we will take another look.</p>`,
      outro: 'Thanks for your interest in Aurora.',
    }),
    text: approved
      ? `${hospitalName} is now live on Aurora. Sign in to the hospital portal to keep your profile up to date.`
      : `After review, we are not able to approve ${hospitalName} at this time. Reply to this email if you believe this is a mistake.`,
  }
}

function hospitalVerificationAdminEmail({ hospitalName, city, area }) {
  return {
    subject: `Verification documents — ${hospitalName}`,
    html: layout({
      heading: 'A hospital submitted verification documents',
      intro: `<strong>${escapeHtml(hospitalName)}</strong> (${escapeHtml(area)}, ${escapeHtml(city)}) is waiting for a verification review.`,
      body: `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Open the admin console to check the documents and mark the hospital verified or rejected.</p>`,
      outro: 'Verified hospitals show a trust badge on their public page.',
    }),
    text: `A hospital submitted verification documents: ${hospitalName} (${area}, ${city}). Review it in the admin console.`,
  }
}

function hospitalVerificationDecisionEmail({ hospitalName, approved, notes }) {
  return {
    subject: approved
      ? `${hospitalName} is verified`
      : `Verification update — ${hospitalName}`,
    html: layout({
      heading: approved ? 'Your hospital is verified' : 'Verification needs another look',
      intro: approved
        ? `<strong>${escapeHtml(hospitalName)}</strong> now carries the Aurora verified badge on its public page.`
        : `We could not verify <strong>${escapeHtml(hospitalName)}</strong> with the documents provided.`,
      body: notes
        ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Reviewer note: ${escapeHtml(notes)}</p>`
        : '',
      outro: approved
        ? 'Patients see the badge wherever your hospital appears.'
        : 'Upload clearer documents and submit again whenever you are ready.',
    }),
    text: approved
      ? `${hospitalName} is verified and now shows the Aurora verified badge.`
      : `We could not verify ${hospitalName}. ${notes ?? ''}`,
  }
}

function doctorInviteEmail({ doctorName, hospitalName }) {
  return {
    subject: `${hospitalName} added you on Aurora`,
    html: layout({
      heading: 'Your Aurora doctor account is ready',
      intro: `Welcome ${escapeHtml(doctorName)} — <strong>${escapeHtml(hospitalName)}</strong> added you to their team on Aurora.`,
      body: `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Sign in at Aurora with this email address and a one-time code — no password needed. Your appointments, timetable and patient requests are waiting for you.</p>`,
      outro: 'If you were not expecting this, you can ignore this email.',
    }),
    text: `${hospitalName} added you as a doctor on Aurora. Sign in with this email address and a one-time code — your appointments and timetable are waiting.`,
  }
}

function listingReservedEmail({ listingTitle, hospitalName }) {
  return {
    subject: `Your listing was reserved — ${listingTitle}`,
    html: layout({
      heading: 'Someone reserved your equipment',
      intro: `<strong>${escapeHtml(hospitalName)}</strong> reserved <strong>${escapeHtml(listingTitle)}</strong> in the Aurora marketplace.`,
      body: `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Open the marketplace to arrange the handover, then mark the listing sold.</p>`,
      outro: 'You can release the reservation from the marketplace at any time.',
    }),
    text: `${hospitalName} reserved your listing "${listingTitle}" in the Aurora marketplace.`,
  }
}

function labReportReadyEmail({ patientName, testName, hospitalName, reportNumber }) {
  return {
    subject: `Your lab report is ready — ${testName}`,
    html: layout({
      heading: 'Your laboratory report is ready',
      intro: `${escapeHtml(hospitalName)} released your <strong>${escapeHtml(testName)}</strong> report.`,
      body: `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Sign in to Aurora and open <strong>Lab results</strong> to read the full report, including reference ranges and your doctor's interpretation.</p><p style="margin:0;font-size:13px;color:#62756b;">Report number: ${escapeHtml(reportNumber)}</p>`,
      outro: `${escapeHtml(patientName)}, if this was not expected, contact the hospital.`,
    }),
    text: `Your lab report (${testName}) from ${hospitalName} is ready. Report number: ${reportNumber}. Sign in to Aurora to read it.`,
  }
}

module.exports = {
  otpEmail,
  emailVerificationEmail,
  hospitalApplicationReceivedEmail,
  hospitalApplicationAdminEmail,
  hospitalDecisionEmail,
  hospitalVerificationAdminEmail,
  hospitalVerificationDecisionEmail,
  doctorInviteEmail,
  listingReservedEmail,
  labReportReadyEmail,
}

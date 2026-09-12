/**
 * Transactional email. Uses Resend when RESEND_API_KEY is set; otherwise a dev
 * transport that logs the link to the console, so magic-link auth is fully
 * testable locally without an email provider.
 */
const FROM = process.env.EMAIL_FROM ?? 'ReportBeacon <login@tinashebenson.com>'
const RESEND_KEY = process.env.RESEND_API_KEY

export const emailConfigured = !!RESEND_KEY

export async function sendMagicLink(to: string, link: string): Promise<void> {
  const subject = 'Your ReportBeacon sign-in link'
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:440px;margin:0 auto;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">Sign in to ReportBeacon</h1>
      <p style="font-size:14px;color:#475">Click the button below to sign in. This link expires in 15 minutes and works once.</p>
      <p style="margin:20px 0">
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px">Sign in</a>
      </p>
      <p style="font-size:12px;color:#889">If you did not request this, you can ignore it.</p>
    </div>`

  if (!RESEND_KEY) {
    console.log(`\n[dev email] magic link for ${to}:\n${link}\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`resend failed: ${res.status} ${body}`)
  }
}

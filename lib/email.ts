import nodemailer from 'nodemailer'

function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in environment.'
    )
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

/**
 * Send a 6-digit OTP verification email to the given address.
 */
export async function sendVerificationEmail(to: string, otp: string): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER

  await transporter.sendMail({
    from,
    to,
    subject: 'Your Bet Book verification code',
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1e293b;">Verify your email</h2>
        <p style="color:#475569;">Enter the code below to complete your Bet Book registration:</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:14px;">This code expires in 10 minutes. If you did not register, ignore this email.</p>
      </div>
    `,
  })
}

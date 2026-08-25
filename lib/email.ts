import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

function emailLayout(content: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%;">

        <!-- Logo & Brand -->
        <tr><td align="center" style="padding-bottom: 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background: linear-gradient(135deg, #0e2233, #1a3a5c); width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle;">
                <span style="font-size: 22px; font-weight: 900; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">D</span>
              </td>
              <td style="padding-left: 12px;">
                <div style="font-size: 22px; font-weight: 800; color: #0e2233; letter-spacing: -0.5px;">Daromadchi</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 1px;">Savdo tahlil platformasi</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(14, 34, 51, 0.08); overflow: hidden;">

            <!-- Gradient top bar -->
            <tr><td style="height: 4px; background: linear-gradient(90deg, #0ea5e9, #06b6d4, #0ea5e9);"></td></tr>

            <!-- Content -->
            <tr><td style="padding: 36px 32px 32px;">
              ${content}
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top: 24px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
            &copy; ${new Date().getFullYear()} Daromadchi. Barcha huquqlar himoyalangan.
          </p>
          <p style="margin: 8px 0 0;">
            <a href="https://daromadchi.uz" style="color: #0ea5e9; font-size: 12px; text-decoration: none;">daromadchi.uz</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function codeBlock(code: string) {
  const digits = code.split('')
  const cells = digits.map(d =>
    `<td style="width: 44px; height: 52px; background: #f0f7ff; border: 2px solid #d4e8f8; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 28px; font-weight: 800; color: #0e2233; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; letter-spacing: 0;">${d}</td>`
  ).join('<td style="width: 6px;"></td>')

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr>${cells}</tr></table>`
}

export async function sendVerificationCode(email: string, code: string) {
  await transporter.sendMail({
    from: `"Daromadchi" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: email,
    subject: 'Tasdiqlash kodi — Daromadchi',
    html: emailLayout(`
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #ecfdf5; border-radius: 50%; text-align: center; line-height: 56px;">
          <span style="font-size: 28px;">&#128274;</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0e2233; margin: 0 0 8px;">Emailni tasdiqlang</h1>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 28px; line-height: 1.5;">
          Hisobingizni faollashtirish uchun quyidagi<br>tasdiqlash kodini kiriting:
        </p>

        ${codeBlock(code)}

        <div style="margin-top: 24px; padding: 12px 16px; background: #fefce8; border-radius: 8px; display: inline-block;">
          <span style="color: #a16207; font-size: 13px;">&#9202; Kod <strong>10 daqiqa</strong> ichida amal qiladi</span>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;">

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">
        Agar siz ro'yxatdan o'tmagan bo'lsangiz,<br>bu xabarni e'tiborsiz qoldiring.
      </p>
    `),
  })
}

export async function sendPasswordResetLink(email: string, url: string) {
  await transporter.sendMail({
    from: `"Daromadchi" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: email,
    subject: 'Parolni tiklash — Daromadchi',
    html: emailLayout(`
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #fef3c7; border-radius: 50%; text-align: center; line-height: 56px;">
          <span style="font-size: 28px;">&#128273;</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0e2233; margin: 0 0 8px;">Parolni tiklash</h1>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 24px; line-height: 1.5;">
          Parolingizni yangilash uchun quyidagi<br>tugmani bosing:
        </p>

        <a href="${url}" style="display: inline-block; background: linear-gradient(135deg,#7c3aed,#4f46e5); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px;">
          Yangi parol o'rnatish
        </a>

        <p style="margin-top: 24px; color: #94a3b8; font-size: 12px; word-break: break-all;">
          Yoki bu havolani brauzeringizga nusxalang:<br>
          <a href="${url}" style="color: #0ea5e9;">${url}</a>
        </p>

        <div style="margin-top: 24px; padding: 12px 16px; background: #fefce8; border-radius: 8px; display: inline-block;">
          <span style="color: #a16207; font-size: 13px;">&#9202; Havola <strong>1 soat</strong> ichida amal qiladi</span>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;">

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">
        Agar siz parolni tiklamagan bo'lsangiz,<br>bu xabarni e'tiborsiz qoldiring.
      </p>
    `),
  })
}

export async function sendPasswordResetCode(email: string, code: string) {
  await transporter.sendMail({
    from: `"Daromadchi" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: email,
    subject: 'Parolni tiklash — Daromadchi',
    html: emailLayout(`
      <div style="text-align: center;">
        <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #fef3c7; border-radius: 50%; text-align: center; line-height: 56px;">
          <span style="font-size: 28px;">&#128273;</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0e2233; margin: 0 0 8px;">Parolni tiklash</h1>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 28px; line-height: 1.5;">
          Parolingizni tiklash uchun quyidagi<br>kodni kiriting:
        </p>

        ${codeBlock(code)}

        <div style="margin-top: 24px; padding: 12px 16px; background: #fefce8; border-radius: 8px; display: inline-block;">
          <span style="color: #a16207; font-size: 13px;">&#9202; Kod <strong>10 daqiqa</strong> ichida amal qiladi</span>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;">

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">
        Agar siz parolni tiklamagan bo'lsangiz,<br>bu xabarni e'tiborsiz qoldiring.
      </p>
    `),
  })
}

// Notifies the data-protection inbox that a logged-in user asked to have their
// account deleted. Does NOT delete anything — an operator processes the request
// via the admin delete endpoint. Sent to privacy@daromadchi.uz.
const PRIVACY_INBOX = 'privacy@daromadchi.uz'
export async function sendAccountDeletionRequest(userEmail: string, userId: string, requestedAt: string) {
  await transporter.sendMail({
    from: `"Daromadchi" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: PRIVACY_INBOX,
    replyTo: userEmail,
    subject: `Account deletion request — ${userEmail}`,
    html: emailLayout(`
      <div>
        <h1 style="font-size: 18px; font-weight: 800; color: #0e2233; margin: 0 0 12px;">Account deletion request</h1>
        <p style="color: #334155; font-size: 14px; margin: 0 0 8px; line-height: 1.6;">
          A logged-in user has requested deletion of their account and personal data.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 13px; color: #334155; margin: 12px 0;">
          <tr><td style="padding: 4px 0; color: #64748b;">Email</td><td style="padding: 4px 0; font-weight: 600;">${userEmail}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">User ID</td><td style="padding: 4px 0; font-family: monospace;">${userId}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Requested at</td><td style="padding: 4px 0;">${requestedAt}</td></tr>
        </table>
        <p style="color: #64748b; font-size: 12px; margin: 12px 0 0; line-height: 1.6;">
          Process via the admin delete-account endpoint. Payment/tax records are retained (anonymized) per policy.
        </p>
      </div>
    `),
  })
}

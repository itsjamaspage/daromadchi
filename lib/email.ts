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

export async function sendVerificationCode(email: string, code: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: email,
    subject: 'Daromadchi — Tasdiqlash kodi',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0e2233; margin: 0;">Daromadchi</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Savdo tahlil platformasi</p>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 16px;">Emailingizni tasdiqlash uchun quyidagi kodni kiriting:</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0e2233; font-family: monospace; padding: 16px; background: #ffffff; border-radius: 8px; border: 2px dashed #cbd5e1;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 16px;">Kod 10 daqiqa ichida amal qiladi.</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
          Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetCode(email: string, code: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: email,
    subject: 'Daromadchi — Parolni tiklash',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0e2233; margin: 0;">Daromadchi</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Savdo tahlil platformasi</p>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 16px;">Parolni tiklash kodi:</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0e2233; font-family: monospace; padding: 16px; background: #ffffff; border-radius: 8px; border: 2px dashed #cbd5e1;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 16px;">Kod 10 daqiqa ichida amal qiladi.</p>
        </div>
      </div>
    `,
  })
}

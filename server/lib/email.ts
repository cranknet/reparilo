import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

let _transporter: Transporter | null = null;

function isConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<void> {
  if (!isConfigured()) {
    console.warn(
      "[email] SMTP not configured — skipping email send. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable."
    );
    return;
  }

  const from = process.env.EMAIL_FROM || `"Reparilo" <noreply@reparilo.com>`;

  await getTransporter().sendMail({ from, to, subject, text, html });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: "Reset your Reparilo password",
    text: `Click the link below to reset your password:\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a1a">Reset your password</h2>
        <p>Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6750a4;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="margin-top:16px;color:#666;font-size:14px">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

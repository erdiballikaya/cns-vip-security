const nodemailer = require("nodemailer");
const fs = require("fs");

function getSender() {
  return process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP env missing (SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
  });
}

async function sendFormPdf({ to, subject, text, pdfAbsPath }) {
  const transporter = getTransport();

  const exists = fs.existsSync(pdfAbsPath);
  if (!exists) throw new Error("PDF file not found");

  const info = await transporter.sendMail({
    from: getSender(),
    to,
    subject,
    text,
    attachments: [
      {
        filename: "form.pdf",
        path: pdfAbsPath,
        contentType: "application/pdf",
      },
    ],
  });

  return info;
}

function isMailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail({ to, subject, text, html, attachments }) {
  // SMTP yoksa dev’de loglayıp geç (server çökmesin)
  if (!isMailEnabled()) {
    console.log("[MAIL:SKIP] SMTP env missing", { to, subject, attachmentsCount: attachments?.length ?? 0 });
    return { skipped: true };
  }

  const transporter = getTransport();

  return transporter.sendMail({
    from: getSender(),
    to,
    subject,
    text,
    html,
    attachments,
  });
}

module.exports = { sendFormPdf };

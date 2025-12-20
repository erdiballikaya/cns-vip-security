const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT_DIR = path.join(process.cwd(), "uploads", "pdfs");
fs.mkdirSync(OUT_DIR, { recursive: true });

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function absUrl(req, maybeRelative) {
  if (!maybeRelative) return "";
  if (String(maybeRelative).startsWith("http")) return String(maybeRelative);
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}${String(maybeRelative).startsWith("/") ? "" : "/"}${maybeRelative}`;
}

async function renderPdf(req, { template, site, submission }) {
  const fileName = `form-${submission._id}-${Date.now()}.pdf`;
  const outPath = path.join(OUT_DIR, fileName);

  const fieldsHtml = (template.fields || [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f) => {
      const v = (submission.values || {})[f.key];

      if (f.type === "image") {
        const src = absUrl(req, v);
        return `
          <div class="row">
            <div class="label">${escapeHtml(f.label)}</div>
            <div class="value">
              ${src ? `<img src="${src}" />` : `<span class="muted">-</span>`}
            </div>
          </div>
        `;
      }

      return `
        <div class="row">
          <div class="label">${escapeHtml(f.label)}</div>
          <div class="value">${escapeHtml(v === undefined || v === null || v === "" ? "-" : v)}</div>
        </div>
      `;
    })
    .join("");

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1 { margin: 0 0 6px; font-size: 18px; }
        .sub { color: #64748b; margin-bottom: 16px; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .grid { display: grid; gap: 10px; }
        .row { display: grid; grid-template-columns: 180px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .row:last-child { border-bottom: 0; }
        .label { color: #334155; font-weight: 600; }
        .value { color: #0f172a; }
        .muted { color: #94a3b8; }
        img { max-width: 420px; border-radius: 10px; border: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(template.name)} — ${escapeHtml(site.name || "Site")}</h1>
      <div class="sub">${escapeHtml(site.address || "")}</div>

      <div class="card">
        <div class="grid">
          ${fieldsHtml}
        </div>
      </div>
    </body>
  </html>
  `;

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  return { pdfPath: `/uploads/pdfs/${fileName}` };
}

module.exports = { renderPdf };

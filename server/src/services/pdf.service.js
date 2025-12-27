const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT_DIR = path.join(process.cwd(), "uploads", "pdfs");
fs.mkdirSync(OUT_DIR, { recursive: true });

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function absUrl(req, maybeRelative) {
  if (!maybeRelative) return "";
  if (String(maybeRelative).startsWith("http")) return String(maybeRelative);
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}${String(maybeRelative).startsWith("/") ? "" : "/"}${maybeRelative}`;
}

// matrix cell: values[fieldKey][rowKey][colKey] -> boolean
function getMatrixCell(values, fieldKey, rowKey, colKey) {
  try {
    return Boolean(values?.[fieldKey]?.[rowKey]?.[colKey]);
  } catch {
    return false;
  }
}

function renderMatrixHtml(f, submissionValues) {
  const cols = Array.isArray(f.columns) ? f.columns : [];
  const rows = Array.isArray(f.rows) ? f.rows : [];

  if (!cols.length || !rows.length) {
    return `
      <div class="row">
        <div class="label">${escapeHtml(f.label)}</div>
        <div class="value"><span class="muted">Matrix tanımı eksik (rows/columns boş)</span></div>
      </div>
    `;
  }

  const thead = `
    <tr>
      <th class="mth-left">Evrak Kaydı</th>
      ${cols
        .map((c) => {
          const title = c.subLabel ? `${c.label} — ${c.subLabel}` : c.label;
          return `
            <th class="mth" title="${escapeHtml(title)}">
              <div class="mcol-title">${escapeHtml(c.label)}</div>
              ${c.subLabel ? `<div class="mcol-sub">${escapeHtml(c.subLabel)}</div>` : ""}
            </th>
          `;
        })
        .join("")}
    </tr>
  `;

  const tbody = rows
    .map((r) => {
      const tds = cols
        .map((c) => {
          const checked = getMatrixCell(submissionValues, f.key, r.key, c.key);
          return `<td class="mtd">${checked ? "✅" : ""}</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="mtd-left">${escapeHtml(r.label ?? r.key)}</td>
          ${tds}
        </tr>
      `;
    })
    .join("");

  return `
    <div class="row">
      <div class="label">${escapeHtml(f.label)}</div>
      <div class="value">
        <div class="mtable-wrap">
          <table class="mtable">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
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

      if (f.type === "matrix") {
        return renderMatrixHtml(f, submission.values || {});
      }

      // default field render (text/number/select/boolean vs.)
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

        /* Matrix table styles */
        .mtable-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
        .mtable { width: 100%; border-collapse: collapse; min-width: 720px; font-size: 12px; }
        .mtable thead th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: bottom; }
        .mtable tbody td { border-bottom: 1px solid #f1f5f9; padding: 8px; }
        .mtable tbody tr:last-child td { border-bottom: 0; }

        .mth-left { text-align: left; width: 260px; }
        .mtd-left { text-align: left; color: #0f172a; font-weight: 600; }
        .mth { text-align: center; white-space: nowrap; }
        .mtd { text-align: center; }

        .mcol-title { font-weight: 700; font-size: 12px; }
        .mcol-sub { margin-top: 3px; font-size: 10px; color: #64748b; font-weight: 500; }
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

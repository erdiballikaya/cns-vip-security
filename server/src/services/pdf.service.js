const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT_DIR = path.join(process.cwd(), "uploads", "pdfs");
const STATIC_PDF_LOGO_PATH = path.join(__dirname, "..", "assets", "CnsLogo.jpg");
fs.mkdirSync(OUT_DIR, { recursive: true });

function getBrowserLaunchOptions() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--font-render-hinting=none",
  ];

  const opts = {
    headless: "new",
    args,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return opts;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatLongTrDate(value) {
  if (!value) return "-";
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function absUrl(req, maybeRelative) {
  if (!maybeRelative) return "";
  if (String(maybeRelative).startsWith("http")) return String(maybeRelative);
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}${String(maybeRelative).startsWith("/") ? "" : "/"}${maybeRelative}`;
}

let staticPdfLogoSrcCache = null;

function getStaticPdfLogoSrc() {
  if (staticPdfLogoSrcCache !== null) return staticPdfLogoSrcCache;
  if (!fs.existsSync(STATIC_PDF_LOGO_PATH)) {
    staticPdfLogoSrcCache = "";
    return staticPdfLogoSrcCache;
  }

  const ext = path.extname(STATIC_PDF_LOGO_PATH).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" :
    ext === ".webp" ? "image/webp" :
    "image/jpeg";

  const base64 = fs.readFileSync(STATIC_PDF_LOGO_PATH).toString("base64");
  staticPdfLogoSrcCache = `data:${mime};base64,${base64}`;
  return staticPdfLogoSrcCache;
}

// matrix cell: values[fieldKey][rowKey][colKey] -> boolean | string
function getMatrixCell(values, fieldKey, rowKey, colKey) {
  try {
    return values?.[fieldKey]?.[rowKey]?.[colKey];
  } catch {
    return null;
  }
}

function buildPersonnelColumns(site) {
  const list = Array.isArray(site?.personnel) ? site.personnel : [];
  return list.map((p, idx) => ({
    key: `p${idx}`,
    label: String(p?.name || `Personel ${idx + 1}`),
    subLabel: p?.role ? String(p.role) : undefined,
  }));
}

function resolveMatrixColumns(f, submissionValues, site) {
  const mode = f?.columnMode === "personnel" ? "personnel" : "manual";
  if (mode === "personnel") {
    const mv = submissionValues?.[f.key] || {};
    const stored = mv?._cols;
    const hasColsSet = mv?._colsSet === true;
    if (hasColsSet) return Array.isArray(stored) ? stored : [];
    if (Array.isArray(stored) && stored.length) return stored;
    return buildPersonnelColumns(site);
  }
  return Array.isArray(f.columns) ? f.columns : [];
}

function renderMatrixHtml(f, submissionValues, site) {
  const cols = resolveMatrixColumns(f, submissionValues, site);
  const rows = Array.isArray(f.rows) ? f.rows : [];
  const defaultCellType = f?.cellType === "text" ? "text" : "boolean";

  if (!cols.length || !rows.length) {
    return `
      <div class="matrix-row">
        <div class="matrix-label">${escapeHtml(f.label)}</div>
        <div class="value"><span class="muted">Matrix tanımı eksik (rows/columns boş)</span></div>
      </div>
    `;
  }

  const denseClass = cols.length >= 6 ? "dense" : "";
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
          const cell = getMatrixCell(submissionValues, f.key, r.key, c.key);
          const colCellType = c?.cellType === "text" ? "text" : defaultCellType;
          if (colCellType === "text") {
            return `<td class="mtd">${escapeHtml(cell ?? "")}</td>`;
          }
          return `<td class="mtd">${cell === true ? "✅" : cell === false ? "❌" : ""}</td>`;
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
    <div class="matrix-row">
      <div class="matrix-label">${escapeHtml(f.label)}</div>
      <div class="mtable-wrap">
        <table class="mtable ${denseClass}">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderPdf(req, { template, site, submission }, opts = {}) {
  const output = opts?.output === "buffer" ? "buffer" : "file";
  const shouldWriteFile = output === "file";

  const fileName = shouldWriteFile ? `form-${submission._id}-${Date.now()}.pdf` : null;
  const outPath = shouldWriteFile ? path.join(OUT_DIR, fileName) : null;

  const images = [];
  const pdfGrid = template.pdfGrid && typeof template.pdfGrid === "object" ? template.pdfGrid : null;
  const legacyLayout = Array.isArray(template.pdfLayout) ? template.pdfLayout : [];
  const layoutMode = ["1x1", "1x2", "2x1", "2x2"].includes(template.pdfLayoutMode)
    ? template.pdfLayoutMode
    : "1x1";
  const layoutSlots = template.pdfLayoutSlots && typeof template.pdfLayoutSlots === "object" ? template.pdfLayoutSlots : null;
  const layoutRatios =
    template.pdfLayoutRatios && typeof template.pdfLayoutRatios === "object" ? template.pdfLayoutRatios : {};

  // Collect image values once so they're available for a dedicated photos block.
  for (const f of template.fields || []) {
    if (f.type !== "image") continue;
    const v = (submission.values || {})[f.key];
    const list = Array.isArray(v) ? v : v ? [v] : [];
    list.forEach((item, idx) => {
      const src = absUrl(req, item);
      if (src) images.push({ label: `${f.label} ${list.length > 1 ? idx + 1 : ""}`.trim(), src });
    });
  }

  function renderField(f) {
    const v = (submission.values || {})[f.key];

    if (f.type === "image") {
      return "";
    }

    if (f.type === "matrix") {
      return renderMatrixHtml(f, submission.values || {}, site);
    }

    return `
      <div class="row">
        <div class="label">${escapeHtml(f.label)}</div>
        <div class="value">${escapeHtml(v === undefined || v === null || v === "" ? "-" : v)}</div>
      </div>
    `;
  }

  const fieldsByKey = new Map((template.fields || []).map((f) => [f.key, f]));
  const defaultOrder = (template.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const photosBreak = images.length >= 4;
  const imagesHtml = images.length
    ? `
        <div class="photos-row photos-block ${photosBreak ? "photos-break" : ""}">
          <div class="photos-label">Fotoğraflar</div>
          <div class="photos-value">
            <div class="img-grid ${images.length === 1 ? "single" : ""}">
              ${images
                .map(
                  (img) => `
                <div class="img-item">
                  <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.label)}" />
                  <div class="img-cap">${escapeHtml(img.label)}</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      `
    : "";

  const logoSrc = getStaticPdfLogoSrc();
  const formDescription = String(template?.description || "").trim();
  const submissionMeta = submission?.values?._meta && typeof submission.values._meta === "object" ? submission.values._meta : {};
  const projectMeta = [
    { label: "Proje Adı", value: String(site?.name || "").trim() || String(template?.projectName || "").trim() || "-" },
    {
      label: "Proje Sorumlusu",
      value: String(submissionMeta.projectResponsible || "").trim() || String(template?.projectResponsible || "").trim() || "-",
    },
    {
      label: "Tarih",
      value: formatLongTrDate(submissionMeta.reportDate || template?.reportDate || ""),
    },
  ];
  const companyAddress =
    "Kurtköy Mah. Yeditepe Sk. No:17/1 A Blok D:10 Pendik/İstanbul Istanbul, Turkey";

  const formInfoHtml = `
    <div class="form-box">
      <div class="form-head">
        <div class="form-main">
          <div class="form-title">${escapeHtml(template?.name || "Form")}</div>
        </div>
        <div class="form-brand">
          ${logoSrc ? `<img class="form-logo" src="${escapeHtml(logoSrc)}" alt="CNS Logo" />` : ""}
          <div class="form-address">${escapeHtml(companyAddress)}</div>
        </div>
      </div>
      ${formDescription ? `<div class="form-sub">${escapeHtml(formDescription)}</div>` : ""}
      <div class="form-meta">
        ${projectMeta
          .map(
            (item) => `
              <div class="form-meta-item">
                <div class="form-meta-label">${escapeHtml(item.label)}</div>
                <div class="form-meta-value">${escapeHtml(item.value)}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;

  const useGrid =
    pdfGrid &&
    Number(pdfGrid.rows) > 0 &&
    Number(pdfGrid.cols) > 0 &&
    pdfGrid.cells &&
    typeof pdfGrid.cells === "object" &&
    Object.keys(pdfGrid.cells).length > 0;
  let gridStyle = "";
  let gridBody = "";

  if (useGrid) {
    const rows = Math.max(1, parseInt(pdfGrid.rows, 10) || 1);
    const cols = Math.max(1, parseInt(pdfGrid.cols, 10) || 1);
    const cellMap = pdfGrid.cells && typeof pdfGrid.cells === "object" ? pdfGrid.cells : {};
    const rowRatios =
      Array.isArray(pdfGrid.rowRatios) && pdfGrid.rowRatios.length === rows ? pdfGrid.rowRatios : Array(rows).fill(1);
    const colRatios =
      Array.isArray(pdfGrid.colRatios) && pdfGrid.colRatios.length === cols ? pdfGrid.colRatios : Array(cols).fill(1);

    const cellOrder = [];
    for (let r = 1; r <= rows; r += 1) {
      for (let c = 1; c <= cols; c += 1) {
        cellOrder.push(`r${r}c${c}`);
      }
    }

    const allKeys = cellOrder.map((id) => cellMap[id]).filter(Boolean);
    const layoutHasPhotos = allKeys.includes("__photos__");

    const cellHtml = cellOrder.map((id) => {
      const keyOrBlock = cellMap[id];
      let html = "";
      if (keyOrBlock === "__photos__") {
        html = "__PHOTOS__";
      } else if (keyOrBlock) {
        const f = fieldsByKey.get(String(keyOrBlock));
        if (f && !(layoutHasPhotos && f.type === "image")) html = renderField(f);
      }
      if (layoutHasPhotos) html = html.replace("__PHOTOS__", imagesHtml);
      return `<div class="pdf-cell">${html}</div>`;
    });

    if (!layoutHasPhotos && imagesHtml) {
      cellHtml[0] = `${cellHtml[0] || ""}${imagesHtml}`;
    }

    gridStyle = [
      `grid-template-columns: ${colRatios.map((r) => `${r}fr`).join(" ")};`,
      `grid-template-rows: ${rowRatios.map((r) => `${r}fr`).join(" ")};`,
    ].join(" ");

    gridBody = cellHtml.join("");
  } else {
    const slotOrderByMode = {
      "1x1": ["a"],
      "1x2": ["top", "bottom"],
      "2x1": ["left", "right"],
      "2x2": ["tl", "tr", "bl", "br"],
    };

    const slotOrder = slotOrderByMode[layoutMode] || slotOrderByMode["1x1"];

    const normalizedSlots = (() => {
      if (layoutSlots && Object.keys(layoutSlots).length) return layoutSlots;
      if (legacyLayout.length) return { a: legacyLayout };
      return { a: defaultOrder.map((f) => f.key) };
    })();

    const allSlotKeys = slotOrder.flatMap((slot) => normalizedSlots[slot] || []);
    const layoutHasPhotos = allSlotKeys.includes("__photos__");

    const renderSlot = (slotKeys) => {
      const html = (slotKeys || [])
        .map((keyOrBlock) => {
          if (keyOrBlock === "__photos__") return "__PHOTOS__";
          const f = fieldsByKey.get(String(keyOrBlock));
          if (!f) return "";
          if (layoutHasPhotos && f.type === "image") return "";
          return renderField(f);
        })
        .join("");

      return html;
    };

    const slotHtml = {};
    for (const slot of slotOrder) {
      const html = renderSlot(normalizedSlots[slot] || []);
      slotHtml[slot] = layoutHasPhotos ? html.replace("__PHOTOS__", imagesHtml) : html;
    }

    if (!layoutHasPhotos && imagesHtml) {
      const firstSlot = slotOrder[0];
      slotHtml[firstSlot] = `${slotHtml[firstSlot] || ""}${imagesHtml}`;
    }

    const cols = Array.isArray(layoutRatios.cols) ? layoutRatios.cols : null;
    const rows = Array.isArray(layoutRatios.rows) ? layoutRatios.rows : null;
    gridStyle = [
      layoutMode === "2x1" || layoutMode === "2x2"
        ? `grid-template-columns: ${cols ? `${cols[0]}fr ${cols[1]}fr` : "1fr 1fr"};`
        : "",
      layoutMode === "1x2" || layoutMode === "2x2"
        ? `grid-template-rows: ${rows ? `${rows[0]}fr ${rows[1]}fr` : "1fr 1fr"};`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    gridBody = slotOrder.map((slot) => `<div class="pdf-slot">${slotHtml[slot] || ""}</div>`).join("");
  }

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }

        .grid { display: grid; gap: 10px; }
        .pdf-grid { display: grid; gap: 12px; }
        .pdf-grid.mode-1x1 { grid-template-columns: 1fr; }
        .pdf-grid.mode-1x2 { grid-template-columns: 1fr; }
        .pdf-grid.mode-2x1 { grid-template-rows: 1fr; }
        .pdf-grid.mode-2x2 { }
        .pdf-slot { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; break-inside: avoid-page; page-break-inside: avoid; }
        .pdf-cell { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; break-inside: avoid-page; page-break-inside: avoid; }

        .row { display: grid; grid-template-columns: 180px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; break-inside: avoid-page; page-break-inside: avoid; }
        .row:last-child { border-bottom: 0; }
        .matrix-row { padding: 10px 0; border-bottom: 1px solid #f1f5f9; break-inside: avoid-page; page-break-inside: avoid; }
        .matrix-row:last-child { border-bottom: 0; }

        .label { color: #334155; font-weight: 600; }
        .matrix-label { color: #334155; font-weight: 600; margin-bottom: 8px; }
        .value { color: #0f172a; }
        .muted { color: #94a3b8; }

        img { border-radius: 10px; border: 1px solid #e2e8f0; }

        .photos-row { padding: 10px 0; border-bottom: 1px solid #f1f5f9; break-inside: avoid-page; page-break-inside: avoid; }
        .photos-row:last-child { border-bottom: 0; }
        .photos-label { color: #334155; font-weight: 600; margin-bottom: 8px; }
        .photos-value { width: 100%; }
        .img-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
        .img-grid.single { grid-template-columns: 1fr; }
        .photos-break { page-break-before: always; break-before: page; }
        .img-item { break-inside: avoid-page; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px; background: #fff; }
        .img-item img { width: 100%; height: auto; max-height: 420px; object-fit: contain; background: #fff; }
        .img-cap { margin-top: 6px; font-size: 10px; color: #64748b; }

        /* Matrix table styles */
        .mtable-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; break-inside: avoid-page; page-break-inside: avoid; }
        .mtable { width: 100%; border-collapse: collapse; min-width: 720px; table-layout: auto; font-size: 12px; }
        .mtable thead { display: table-header-group; }
        .mtable tr { break-inside: avoid-page; page-break-inside: avoid; }
        .mtable thead th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: bottom; }
        .mtable tbody td { border-bottom: 1px solid #f1f5f9; padding: 8px; }
        .mtable tbody tr:last-child td { border-bottom: 0; }

        .mth-left { text-align: left; width: 260px; }
        .mtd-left { text-align: left; color: #0f172a; font-weight: 600; word-break: break-word; }
        .mth { text-align: center; white-space: normal; word-break: break-word; }
        .mtd { text-align: center; word-break: break-word; }

        .mcol-title { font-weight: 700; font-size: 12px; }
        .mcol-sub { margin-top: 3px; font-size: 10px; color: #64748b; font-weight: 500; }
        .mtable.dense .mth { white-space: normal; word-break: break-word; }
        .mtable.dense thead th { padding: 6px; }
        .mtable.dense .mcol-title { font-size: 10px; }
        .mtable.dense .mcol-sub { font-size: 9px; }

        .form-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 14px; break-inside: avoid-page; page-break-inside: avoid; }
        .form-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .form-main { flex: 1; min-width: 0; }
        .form-brand { width: 220px; flex: 0 0 220px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .form-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        .form-sub { margin-top: 10px; color: #64748b; white-space: pre-wrap; }
        .form-meta { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .form-meta-item { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
        .form-meta-label { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
        .form-meta-value { color: #0f172a; font-weight: 600; word-break: break-word; }
        .form-address { font-size: 11px; line-height: 1.45; color: #475569; text-align: right; }
        .form-logo { max-height: 70px; max-width: 160px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; padding: 4px; background: #fff; }
      </style>
    </head>
    <body>
      ${formInfoHtml}

      <div class="pdf-grid mode-${layoutMode}" style="${gridStyle}">
        ${gridBody}
      </div>
    </body>
  </html>
  `;

  const browser = await puppeteer.launch(getBrowserLaunchOptions());
  let pdfBuffer = null;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    pdfBuffer = await page.pdf({
      path: shouldWriteFile ? outPath : undefined,
      format: "A4",
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  if (!shouldWriteFile) {
    return { pdfBuffer: Buffer.from(pdfBuffer) };
  }

  return { pdfPath: `/uploads/pdfs/${fileName}` };
}

module.exports = { renderPdf };

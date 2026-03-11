import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import { useToast } from "./ToastProvider";
import { http } from "../api/http";
import type { FieldDto, FieldType, MatrixCellType, MatrixColumn, MatrixColumnMode, Option } from "../types/field";

type Props =
  | {
      open: boolean;
      onClose: () => void;
      templateId: string;
      mode: "add";
      onCreated: () => Promise<void> | void;
      initialField?: never;
      sites?: { _id: string; name: string }[];
      defaultSiteId?: string;
    }
  | {
      open: boolean;
      onClose: () => void;
      templateId: string;
      mode: "edit";
      onCreated: () => Promise<void> | void;
      initialField: FieldDto | null;
      sites?: { _id: string; name: string }[];
      defaultSiteId?: string;
    };

type MatrixRow = { key: string; label: string };

function uniqCheck(items: { key: string }[]) {
  const set = new Set<string>();
  for (const it of items) {
    if (set.has(it.key)) return it.key;
    set.add(it.key);
  }
  return null;
}

function safeTrim(s: any) {
  return String(s ?? "").trim();
}

function nowLocalInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function slugifyKey(raw: string, fallback: string) {
  const base = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return base || fallback;
}

function dedupeKeys<T extends { key: string }>(items: T[]) {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const count = seen.get(it.key) || 0;
    seen.set(it.key, count + 1);
    if (count === 0) return it;
    return { ...it, key: `${it.key}_${count + 1}` };
  });
}

export default function AddFieldModal(props: Props) {
  const toast = useToast();
  const isEdit = props.mode === "edit";

  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);

  const [min, setMin] = useState<number | "">("");
  const [max, setMax] = useState<number | "">("");
  const [defaultValue, setDefaultValue] = useState<any>("");

  const [optionsText, setOptionsText] = useState(""); // select: "label:value" satır satır

  // ✅ matrix inputs
  const [matrixColumnMode, setMatrixColumnMode] = useState<MatrixColumnMode>("manual");
  const [matrixColumns, setMatrixColumns] = useState<MatrixColumn[]>([]);
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);

  // modal açıldığında (edit/add) state doldur
  useEffect(() => {
    if (!props.open) return;

    if (isEdit) {
      const f = props.initialField;
      if (!f) return;

      setLabel(f.label ?? "");
      setType((f.type as FieldType) ?? "text");
      setRequired(Boolean(f.required));

      setMin(typeof f.min === "number" ? f.min : "");
      setMax(typeof f.max === "number" ? f.max : "");
      setDefaultValue(f.defaultValue ?? (f.type === "boolean" ? false : f.type === "date" ? nowLocalInputValue() : ""));

      const opts = (f.options || []).map((o) => `${o.label}:${o.value}`).join("\n");
      setOptionsText(opts);

      // ✅ matrix edit fill
      if (String(f.type) === "matrix") {
        const cols = (f as any)?.columns || [];
        const rows = (f as any)?.rows || [];
        const mode = (f as any)?.columnMode || (cols?.length ? "manual" : "personnel");

        setMatrixColumnMode(mode);
        setMatrixColumns(
          (cols || []).map((c: any, idx: number) => ({
            key: c.key || slugifyKey(c.label, `col_${idx + 1}`),
            label: c.label || "",
            subLabel: c.subLabel,
            cellType: c.cellType || "boolean",
          }))
        );
        setMatrixRows(
          (rows || []).map((r: any, idx: number) => ({
            key: r.key || slugifyKey(r.label, `row_${idx + 1}`),
            label: r.label || "",
          }))
        );
      } else {
        setMatrixColumnMode("manual");
        setMatrixColumns([]);
        setMatrixRows([]);
      }
    } else {
      // add
      setLabel("");
      setType("text");
      setRequired(false);
      setMin("");
      setMax("");
      setDefaultValue("");
      setOptionsText("");
      setMatrixColumnMode("manual");
      setMatrixColumns([]);
      setMatrixRows([]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // ✅ modal kapanınca temizle (UX için)
  useEffect(() => {
    if (props.open) return;
    setSaving(false);
    setOptionsText("");
    setMatrixColumns([]);
    setMatrixRows([]);
    // key/label vs kapatınca temizlemek istemiyorsan kaldırabilirsin
  }, [props.open]);

  const options: Option[] = useMemo(() => {
    if (type !== "select") return [];
    const lines = optionsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const out: Option[] = [];
    for (const line of lines) {
      const [l, v] = line.split(":");
      const label = (l ?? "").trim();
      const value = (v ?? label).trim();
      if (!label) continue;
      out.push({ label, value });
    }
    return out;
  }, [optionsText, type]);

  const matrixColumnsNormalized: MatrixColumn[] = useMemo(() => {
    if (type !== "matrix") return [];
    if (matrixColumnMode !== "manual") return [];
    const cols = (matrixColumns || [])
      .map((c, idx) => ({
        key: slugifyKey(c.label, `col_${idx + 1}`),
        label: String(c.label || "").trim(),
        subLabel: c.subLabel,
        cellType: c.cellType || "boolean",
      }))
      .filter((c) => c.label);
    return dedupeKeys(cols);
  }, [matrixColumns, matrixColumnMode, type]);

  const matrixRowsNormalized: MatrixRow[] = useMemo(() => {
    if (type !== "matrix") return [];
    const rows = (matrixRows || [])
      .map((r, idx) => ({
        key: slugifyKey(r.label, `row_${idx + 1}`),
        label: String(r.label || "").trim(),
      }))
      .filter((r) => r.label);
    return dedupeKeys(rows);
  }, [matrixRows, type]);

  const submit = async () => {
    if (saving) return;

    const l = safeTrim(label);

    if (!l) return toast.error("Başlık zorunlu.", "Eksik Bilgi");
    const k = isEdit ? safeTrim(props.initialField?.key) : slugifyKey(l, "field");

    // ✅ matrix validation
    if (type === "matrix") {
      if (matrixColumnMode === "manual" && !matrixColumnsNormalized.length)
        return toast.error("Matrix sütunları boş olamaz.", "Eksik Bilgi");
      if (!matrixRowsNormalized.length) return toast.error("Matrix satırları boş olamaz.", "Eksik Bilgi");

      if (matrixColumnMode === "manual") {
        const dupCol = uniqCheck(matrixColumnsNormalized);
        if (dupCol) return toast.error(`Matrix sütun key tekrar ediyor: ${dupCol}`, "Geçersiz");
      }

      const dupRow = uniqCheck(matrixRowsNormalized);
      if (dupRow) return toast.error(`Matrix satır key tekrar ediyor: ${dupRow}`, "Geçersiz");
    }

    // ✅ payload (Yol A): matrix ise columns/rows gönder; diğer alanları temiz tut
    const payload: any = {
      key: k,
      label: l,
      type,
      required,
    };

    if (type === "number") {
      payload.min = min === "" ? undefined : Number(min);
      payload.max = max === "" ? undefined : Number(max);
      payload.defaultValue = defaultValue === "" ? undefined : Number(defaultValue);
    } else if (type === "boolean") {
      payload.defaultValue = Boolean(defaultValue);
    } else if (type === "select") {
      payload.options = options;
      payload.defaultValue = defaultValue === "" ? undefined : defaultValue;
    } else if (type === "text" || type === "image" || type === "date") {
      payload.defaultValue = defaultValue === "" ? undefined : defaultValue;
    } else if (type === "matrix") {
      const allTextCols =
        matrixColumnMode === "manual" &&
        matrixColumnsNormalized.length > 0 &&
        matrixColumnsNormalized.every((c) => c.cellType === "text");
      payload.columnMode = matrixColumnMode;
      payload.cellType = matrixColumnMode === "personnel" ? "boolean" : allTextCols ? "text" : "boolean";
      payload.columns = matrixColumnMode === "manual" ? matrixColumnsNormalized : undefined;
      payload.rows = matrixRowsNormalized;
      // matrix’te default/min/max/options gönderme (backend’e temiz gitsin)
    }

    try {
      setSaving(true);

      if (isEdit) {
        // ✅ edit’te endpoint key’i: initialField.key üzerinden gitmek daha güvenli
        const originalKey = safeTrim(props.initialField?.key);
        if (!originalKey) throw new Error("initialField.key bulunamadı");

        await http.patch(`/forms/${props.templateId}/fields/${encodeURIComponent(originalKey)}`, payload);
      } else {
        await http.post(`/forms/${props.templateId}/fields`, payload);
      }

      toast.success(isEdit ? "Alan güncellendi." : "Alan eklendi.", "Başarılı");
      await props.onCreated?.();
      props.onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "İşlem başarısız.", "Hata");
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  return (
    <Modal title={isEdit ? "Alan Düzenle" : "Alan Ekle"} onClose={props.onClose}>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field">
          <div className="label">Başlık</div>
          <input className="ctrl" value={label} onChange={(e) => setLabel(e.target.value)} disabled={saving} />
        </div>

        <div className="field">
          <div className="label">Benzersiz Alan İsmi</div>
          {isEdit ? (
            <div className="hint">{props.initialField?.key || "-"}</div>
          ) : (
            <div className="hint">Otomatik oluşturulur: {slugifyKey(label, "field")}</div>
          )}
        </div>

        <div className="field">
          <div className="label">Alan Tipi</div>
          <select className="ctrl" value={type} onChange={(e) => setType(e.target.value as FieldType)} disabled={saving}>
            <option value="text">Metin</option>
            <option value="number">Sayı</option>
            <option value="select">Çoktan Seçmeli</option>
            <option value="image">Resim</option>
            <option value="date">Tarih</option>
            <option value="matrix">Matrix (Tablo)</option>
          </select>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} disabled={saving} />
          <span>Zorunlu</span>
        </label>

        {type === "number" ? (
          <div className="numberGrid2">
            <div className="field">
              <div className="label">Min</div>
              <input
                className="ctrl"
                type="number"
                value={min}
                onChange={(e) => setMin(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={saving}
              />
            </div>
            <div className="field">
              <div className="label">Max</div>
              <input
                className="ctrl"
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={saving}
              />
            </div>
          </div>
        ) : null}

        {type === "select" ? (
          <div className="field">
            <div className="label">Seçenekler</div>
            <textarea
              className="ctrl"
              rows={5}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              disabled={saving}
              placeholder={"Örn:\nKamera:camera\nTurnike:turnike"}
            />
            <div className="hint">Her satır: label:value (value boşsa label kullanılır)</div>
          </div>
        ) : null}

        {/* ✅ MATRIX */}
        {type === "matrix" ? (
          <div className="field">
            <div className="label">Matrix Tanımı</div>

            <div className="field" style={{ marginTop: 8 }}>
              <div className="label">Sütun Kaynağı</div>
              <select
                className="ctrl"
                value={matrixColumnMode}
                onChange={(e) => {
                  const next = e.target.value as MatrixColumnMode;
                  setMatrixColumnMode(next);
                }}
                disabled={saving}
              >
                <option value="manual">Manuel</option>
                <option value="personnel">Personel</option>
              </select>
              <div className="hint" style={{ marginTop: 6 }}>
                {matrixColumnMode === "manual"
                  ? "Sütunları manuel girersin."
                  : "Sütunlar form doldurma ekranında personel seçilerek oluşur."}
              </div>
            </div>

            {matrixColumnMode === "manual" ? (
              <>
                <div className="hint" style={{ marginTop: 10, marginBottom: 6 }}>
                  Sütunlar
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(matrixColumns || []).map((c, idx) => (
                    <div key={`col-${idx}`} className="matrixColumnRow">
                      <input
                        className="ctrl"
                        placeholder={`Sütun ${idx + 1} adı`}
                        value={c.label || ""}
                        onChange={(e) => {
                          const next = [...matrixColumns];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setMatrixColumns(next);
                        }}
                        disabled={saving}
                      />
                      <select
                        className="ctrl"
                        value={c.cellType || "boolean"}
                        onChange={(e) => {
                          const next = [...matrixColumns];
                          next[idx] = { ...next[idx], cellType: e.target.value as MatrixCellType };
                          setMatrixColumns(next);
                        }}
                        disabled={saving}
                      >
                        <option value="boolean">Evet / Hayır</option>
                        <option value="text">Metin</option>
                      </select>
                      <button
                        className="btn"
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          const next = matrixColumns.filter((_, i) => i !== idx);
                          setMatrixColumns(next);
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn"
                    type="button"
                    disabled={saving}
                    onClick={() => setMatrixColumns([...matrixColumns, { key: "", label: "", cellType: "boolean" }])}
                  >
                    + Sütun Ekle
                  </button>
                </div>
              </>
            ) : null}

            <div className="hint" style={{ marginTop: 10, marginBottom: 6 }}>
              Satırlar
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {(matrixRows || []).map((r, idx) => (
                <div key={`row-${idx}`} className="matrixRowLine">
                  <input
                    className="ctrl"
                    placeholder={`Satır ${idx + 1} sorusu`}
                    value={r.label || ""}
                    onChange={(e) => {
                      const next = [...matrixRows];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setMatrixRows(next);
                    }}
                    disabled={saving}
                  />
                  <button
                    className="btn"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const next = matrixRows.filter((_, i) => i !== idx);
                      setMatrixRows(next);
                    }}
                  >
                    Sil
                  </button>
                </div>
              ))}
              <button
                className="btn"
                type="button"
                disabled={saving}
                onClick={() => setMatrixRows([...matrixRows, { key: "", label: "" }])}
              >
                + Satır Ekle
              </button>
            </div>

            <div className="hint" style={{ marginTop: 8 }}>
              İpucu: Sorular benzersiz olmalı.
            </div>
          </div>
        ) : null}

        {/* Default value */}
        <div className="field">
          <div className="label">Default Value</div>
          {type === "boolean" ? (
            <select
              className="ctrl"
              value={String(Boolean(defaultValue))}
              onChange={(e) => setDefaultValue(e.target.value === "true")}
              disabled={saving}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          ) : type === "date" ? (
            <input
              className="ctrl"
              type="date"
              value={defaultValue || nowLocalInputValue()}
              onChange={(e) => setDefaultValue(e.target.value)}
              disabled={saving}
            />
          ) : (
            <input
              className="ctrl"
              value={defaultValue ?? ""}
              onChange={(e) => setDefaultValue(e.target.value)}
              disabled={saving || type === "matrix"}
              placeholder={type === "matrix" ? "Matrix için kullanılmaz" : undefined}
            />
          )}
          {type === "matrix" ? <div className="hint">Matrix alanlarında default value kullanılmaz.</div> : null}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" onClick={props.onClose} disabled={saving}>
            Vazgeç
          </button>
          <button className="btn btnPrimary" onClick={submit} disabled={saving}>
            {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Ekle"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
  

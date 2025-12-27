import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import { useToast } from "./ToastProvider";
import { http } from "../api/http";
import type { FieldDto, FieldType, Option } from "../types/field";

type Props =
  | {
      open: boolean;
      onClose: () => void;
      templateId: string;
      mode: "add";
      onCreated: () => Promise<void> | void;
      initialField?: never;
    }
  | {
      open: boolean;
      onClose: () => void;
      templateId: string;
      mode: "edit";
      onCreated: () => Promise<void> | void;
      initialField: FieldDto | null;
    };

type MatrixColumn = { key: string; label: string; subLabel?: string };
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

export default function AddFieldModal(props: Props) {
  const toast = useToast();
  const isEdit = props.mode === "edit";

  const [saving, setSaving] = useState(false);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);

  const [min, setMin] = useState<number | "">("");
  const [max, setMax] = useState<number | "">("");
  const [defaultValue, setDefaultValue] = useState<any>("");

  const [optionsText, setOptionsText] = useState(""); // select: "label:value" satır satır

  // ✅ matrix text inputs
  const [matrixColsText, setMatrixColsText] = useState("");
  const [matrixRowsText, setMatrixRowsText] = useState("");

  // modal açıldığında (edit/add) state doldur
  useEffect(() => {
    if (!props.open) return;

    if (isEdit) {
      const f = props.initialField;
      if (!f) return;

      setKey(f.key ?? "");
      setLabel(f.label ?? "");
      setType((f.type as FieldType) ?? "text");
      setRequired(Boolean(f.required));

      setMin(typeof f.min === "number" ? f.min : "");
      setMax(typeof f.max === "number" ? f.max : "");
      setDefaultValue(f.defaultValue ?? (f.type === "boolean" ? false : ""));

      const opts = (f.options || []).map((o) => `${o.label}:${o.value}`).join("\n");
      setOptionsText(opts);

      // ✅ matrix edit fill
      if (String(f.type) === "matrix") {
        const cols = (f as any)?.columns || [];
        const rows = (f as any)?.rows || [];

        setMatrixColsText(
          cols
            .map((c: any) => `${c.key}|${c.label}${c.subLabel ? `|${c.subLabel}` : ""}`)
            .join("\n")
        );

        setMatrixRowsText(rows.map((r: any) => `${r.key}|${r.label}`).join("\n"));
      } else {
        setMatrixColsText("");
        setMatrixRowsText("");
      }
    } else {
      // add
      setKey("");
      setLabel("");
      setType("text");
      setRequired(false);
      setMin("");
      setMax("");
      setDefaultValue("");
      setOptionsText("");
      setMatrixColsText("");
      setMatrixRowsText("");
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // ✅ modal kapanınca temizle (UX için)
  useEffect(() => {
    if (props.open) return;
    setSaving(false);
    setOptionsText("");
    setMatrixColsText("");
    setMatrixRowsText("");
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

  // ✅ matrix parse
  const matrixColumns: MatrixColumn[] = useMemo(() => {
    if (type !== "matrix") return [];
    return matrixColsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((x) => (x ?? "").trim());
        const k = parts[0];
        const l = parts[1];
        const s = parts[2];
        if (!k || !l) return null;
        return { key: k, label: l, subLabel: s ? s : undefined };
      })
      .filter(Boolean) as MatrixColumn[];
  }, [matrixColsText, type]);

  const matrixRows: MatrixRow[] = useMemo(() => {
    if (type !== "matrix") return [];
    return matrixRowsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((x) => (x ?? "").trim());
        const k = parts[0];
        const l = parts[1];
        if (!k || !l) return null;
        return { key: k, label: l };
      })
      .filter(Boolean) as MatrixRow[];
  }, [matrixRowsText, type]);

  const submit = async () => {
    if (saving) return;

    const k = safeTrim(key);
    const l = safeTrim(label);

    if (!k) return toast.error("Benzersiz Alan İsmi zorunlu.", "Eksik Bilgi");
    if (!isEdit && k.includes(".")) return toast.error("Benzersiz Alan İsmi '.' içeremez.", "Geçersiz");
    if (!l) return toast.error("Başlık zorunlu.", "Eksik Bilgi");

    // ✅ matrix validation
    if (type === "matrix") {
      if (!matrixColumns.length) return toast.error("Matrix sütunları boş olamaz.", "Eksik Bilgi");
      if (!matrixRows.length) return toast.error("Matrix satırları boş olamaz.", "Eksik Bilgi");

      const dupCol = uniqCheck(matrixColumns);
      if (dupCol) return toast.error(`Matrix sütun key tekrar ediyor: ${dupCol}`, "Geçersiz");

      const dupRow = uniqCheck(matrixRows);
      if (dupRow) return toast.error(`Matrix satır key tekrar ediyor: ${dupRow}`, "Geçersiz");

      // opsiyonel: satır/sütun formatını kullanıcıya daha net anlat
      const colsRaw = matrixColsText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const badColLine = colsRaw.find((line) => line.split("|").filter(Boolean).length < 2);
      if (badColLine) return toast.error(`Sütun formatı hatalı: "${badColLine}"`, "Geçersiz");

      const rowsRaw = matrixRowsText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const badRowLine = rowsRaw.find((line) => line.split("|").filter(Boolean).length < 2);
      if (badRowLine) return toast.error(`Satır formatı hatalı: "${badRowLine}"`, "Geçersiz");
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
    } else if (type === "text" || type === "image") {
      payload.defaultValue = defaultValue === "" ? undefined : defaultValue;
    } else if (type === "matrix") {
      payload.columns = matrixColumns;
      payload.rows = matrixRows;
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
          <input
            className="ctrl"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={saving || isEdit}
            placeholder="örn: kameraSayisi"
          />
          {isEdit ? <div className="hint">Benzersiz Alan ismi değiştirilemez.</div> : null}
        </div>

        <div className="field">
          <div className="label">Alan Tipi</div>
          <select className="ctrl" value={type} onChange={(e) => setType(e.target.value as FieldType)} disabled={saving}>
            <option value="text">Metin</option>
            <option value="number">Sayı</option>
            <option value="select">Çoktan Seçmeli</option>
            <option value="image">Resim</option>
            {/* <option value="matrix">Matrix (Tablo)</option> */}
          </select>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} disabled={saving} />
          <span>Zorunlu</span>
        </label>

        {type === "number" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

            <div className="hint" style={{ marginBottom: 6 }}>
              Sütunlar (her satır: key|label|altBaşlık)
            </div>
            <textarea
              className="ctrl"
              rows={4}
              value={matrixColsText}
              onChange={(e) => setMatrixColsText(e.target.value)}
              disabled={saving}
              placeholder={
                "Örn:\nbaris|Barış Sarıcan|Güvenlik Görevlisi\ncaner|Caner Tascı|Güvenlik Görevlisi\nmehmet|Mehmetcan Ateş|Başvuran"
              }
            />

            <div className="hint" style={{ marginTop: 10, marginBottom: 6 }}>
              Satırlar (her satır: key|label)
            </div>
            <textarea
              className="ctrl"
              rows={6}
              value={matrixRowsText}
              onChange={(e) => setMatrixRowsText(e.target.value)}
              disabled={saving}
              placeholder={
                "Örn:\n5188|5188 sayılı özel güvenlik yasası kapsamında görev/yetkilerini uyguluyor mu?\nhiyerarsi|Ast-üst ilişkisi kapsamında hiyerarşi kurallarına uyuyor mu?\nkıyafet|Kıyafet, saç ve sakal düzeni uygun mu?"
              }
            />

            <div className="hint" style={{ marginTop: 8 }}>
              İpucu: <b>key</b> alanları benzersiz olmalı. PDF’de sütunlar başlık + alt başlık olarak basılır.
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
  
import React, { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal"; // sende modal nerede ise ona göre
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

      const opts = (f.options || [])
        .map((o) => `${o.label}:${o.value}`)
        .join("\n");
      setOptionsText(opts);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const submit = async () => {
    if (saving) return;

    const k = key.trim();
    const l = label.trim();

    if (!k) return toast.error("Key zorunlu.", "Eksik Bilgi");
    if (!isEdit && k.includes(".")) return toast.error("Key '.' içeremez.", "Geçersiz");
    if (!l) return toast.error("Label zorunlu.", "Eksik Bilgi");

    const payload: any = {
      key: k,
      label: l,
      type,
      required,
      defaultValue:
        type === "number"
          ? (defaultValue === "" ? undefined : Number(defaultValue))
          : type === "boolean"
            ? Boolean(defaultValue)
            : defaultValue === "" ? undefined : defaultValue,
      min: type === "number" ? (min === "" ? undefined : Number(min)) : undefined,
      max: type === "number" ? (max === "" ? undefined : Number(max)) : undefined,
      options: type === "select" ? options : undefined,
      // ✅ order burada YOK
    };

    try {
      setSaving(true);

      if (isEdit) {
        // sende edit endpoint nasıl ise ona göre: burada örnek PATCH
        await http.patch(`/forms/${props.templateId}/fields/${encodeURIComponent(k)}`, payload);
      } else {
        // ✅ yeni alan ekleme route'u: POST /forms/:id/fields
        await http.post(`/forms/${props.templateId}/fields`, payload);
      }

      toast.success(isEdit ? "Alan güncellendi." : "Alan eklendi.", "Başarılı");
      await props.onCreated?.();
      props.onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "İşlem başarısız.", "Hata");
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
            disabled={saving || isEdit} // edit'te key kilitli
            placeholder="örn: kameraSayisi"
          />
          {isEdit ? <div className="hint">Benzersiz Alan ismi değiştirilemez.</div> : null}
        </div>

        <div className="field">
          <div className="label">Alan Tipi</div>
          <select className="ctrl" value={type} onChange={(e) => setType(e.target.value as FieldType)} disabled={saving}>
            <option value="text">Metin</option>
            <option value="number">Sayı</option>
            {/* <option value="boolean">boolean</option> */}
            <option value="select">Çoktan Seçmeli</option>
            <option value="image">Resim</option>
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
            <input className="ctrl" value={defaultValue ?? ""} onChange={(e) => setDefaultValue(e.target.value)} disabled={saving} />
          )}
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

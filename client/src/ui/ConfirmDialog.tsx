import { useState } from "react";
import Modal from "./Modal";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;

  /**
   * Dışarıdan gelen global saving state varsa bunu da kullanabiliriz.
   * Ama asıl önemli olan: ConfirmDialog kendi local loading'ini de yönetir.
   */
  disabled?: boolean;

  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid rgba(255,255,255,.35)",
        borderTopColor: "rgba(255,255,255,.95)",
        display: "inline-block",
        animation: "spin .8s linear infinite",
      }}
    />
  );
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Onayla",
  cancelText = "Vazgeç",
  danger = false,
  disabled = false,
  onClose,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const isDisabled = disabled || busy;

  const handleConfirm = async () => {
    if (isDisabled) return;

    try {
      setBusy(true);
      await onConfirm();
      // Not: kapanmayı dışarıda yönetiyorsun (setOpen(false) vs).
      // onConfirm zaten success'te kapatıyorsa burada ekstra kapatmayalım.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Modal
        title={title}
        onClose={() => {
          // loading sırasında kapatmayı engellemek istersen:
          if (busy) return;
          onClose();
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ lineHeight: 1.5 }}>{message}</div>

          {busy ? (
            <div className="hint" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Spinner />
              <span>İşlem yapılıyor, lütfen bekleyin…</span>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn" onClick={onClose} disabled={isDisabled}>
              {cancelText}
            </button>

            <button
              className={`btn ${danger ? "btnDanger" : "btnPrimary"}`}
              onClick={handleConfirm}
              disabled={isDisabled}
            >
              {busy ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Spinner />
                  {confirmText}…
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

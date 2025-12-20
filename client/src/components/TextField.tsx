import type { InputHTMLAttributes } from "react";

export default function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <input className="input" {...props} />
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

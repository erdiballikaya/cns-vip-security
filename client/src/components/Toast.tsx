export type ToastType = "success" | "error" | "info";

export default function Toast({
  title,
  message,
  type = "info",
  onClose,
}: {
  title?: string;
  message: string;
  type?: ToastType;
  onClose: () => void;
}) {
  return (
    <div
      className={`toast toast-${type}`}
      role="status"
      onClick={onClose}
    >
      {title && <div className="toastTitle">{title}</div>}
      <div className="toastMsg">{message}</div>
    </div>
  );
}
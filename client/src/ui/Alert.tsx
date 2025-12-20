export default function Alert({
  type,
  title,
  message,
}: {
  type: "ok" | "err" | "info";
  title: string;
  message: string;
}) {
  return (
    <div className={`alert alert-${type}`}>
      <div className="alertTitle">{title}</div>
      <div className="alertMsg">{message}</div>
    </div>
  );
}

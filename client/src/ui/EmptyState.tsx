import React from "react";

export default function EmptyState({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="emptyTitle">{title}</div>
      {description ? <div className="emptyDesc">{description}</div> : null}
      {right ? <div className="emptyRight">{right}</div> : null}
    </div>
  );
}

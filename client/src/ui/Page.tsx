import React from "react";

export default function Page({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <div className="pageHead">
        <div>
          <div className="pageTitle">{title}</div>
          {subtitle ? <div className="pageSub">{subtitle}</div> : null}
        </div>
        {right ? <div className="pageRight">{right}</div> : null}
      </div>

      <div className="pageBody">{children}</div>
    </div>
  );
}

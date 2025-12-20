import React from "react";

export default function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cardX ${className}`.trim()}>
      <div className="cardXHead">
        <div>
          <div className="cardXTitle">{title}</div>
          {subtitle ? <div className="cardXSub">{subtitle}</div> : null}
        </div>
        {right ? <div className="cardXRight">{right}</div> : null}
      </div>

      <div className="cardXBody">{children}</div>
    </section>
  );
}

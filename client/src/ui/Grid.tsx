import React from "react";

export function TwoCol({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="twoCol">
      <div className="twoColLeft">{left}</div>
      <div className="twoColRight">{right}</div>
    </div>
  );
}

export function Stack({ children }: { children: React.ReactNode }) {
  return <div className="stack">{children}</div>;
}

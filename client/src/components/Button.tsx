import React from "react";

export default function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" }) {
  const { variant = "default", className = "", ...rest } = props;
  const cls = `btn ${variant === "primary" ? "btnPrimary" : ""} ${className}`.trim();
  return <button className={cls} {...rest} />;
}

import type { Me } from "../types/auth";

export function can(me: Me | null | undefined, key: string): boolean {
  if (!me) return false;
  if (me.role === "ADMIN") return true;
  return (me.enabledModules || []).includes(key);
}

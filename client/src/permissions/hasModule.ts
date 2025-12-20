import type { Me } from "../types/auth";
import { can } from "../auth/permissions";

export function hasModule(me: Me | null | undefined, key: string) {
  return can(me, key);
}

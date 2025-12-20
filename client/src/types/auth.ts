export type Role = "ADMIN" | "MANAGER" | "PERSONNEL";

export type Me = {
  id: string;
  email: string;
  role: Role;
  enabledModules: string[];
};

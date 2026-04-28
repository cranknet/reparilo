export const Role = {
  OWNER: "OWNER",
  TECHNICIAN: "TECHNICIAN",
  FRONT_DESK: "FRONT_DESK",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<RoleType, string> = {
  OWNER: "role.OWNER",
  TECHNICIAN: "role.TECHNICIAN",
  FRONT_DESK: "role.FRONT_DESK",
};

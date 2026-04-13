export const Role = {
  OWNER: 'OWNER',
  TECHNICIAN: 'TECHNICIAN',
  FRONT_DESK: 'FRONT_DESK',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<RoleType, string> = {
  OWNER: 'Owner',
  TECHNICIAN: 'Technician',
  FRONT_DESK: 'Front Desk',
};

export const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  OWNER: [
    'jobs:read',
    'jobs:write',
    'jobs:delete',
    'jobs:update_status',
    'parts:read',
    'parts:write',
    'customers:read',
    'customers:write',
    'users:read',
    'users:write',
    'settings:read',
    'settings:write',
    'ai:access',
    'notifications:manage',
    'reports:view',
  ],
  TECHNICIAN: [
    'jobs:read',
    'jobs:write',
    'jobs:update_status',
    'parts:read',
    'parts:write',
    'customers:read',
    'notifications:read',
  ],
  FRONT_DESK: [
    'jobs:read',
    'jobs:update_status',
    'customers:read',
    'customers:write',
    'notifications:send',
  ],
};

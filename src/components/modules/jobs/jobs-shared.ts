import type { JobStatusType } from "@shared/constants";

export interface JobRow {
  customer: string;
  customerTier?: string;
  device: string;
  deviceIcon?: string;
  deviceSpec?: string;
  id: string;
  status: JobStatusType;
  technician?: string;
}

const STATUS_GROUP_ACTIVE: JobStatusType[] = ["INTAKE", "IN_REPAIR", "ON_HOLD"];
const STATUS_GROUP_WAITING: JobStatusType[] = ["WAITING_FOR_PARTS", "DONE"];
const STATUS_GROUP_CLOSED: JobStatusType[] = [
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

export const STATUS_GROUPS = [
  {
    key: "active",
    labelKey: "status_group_active",
    statuses: STATUS_GROUP_ACTIVE,
  },
  {
    key: "waiting",
    labelKey: "status_group_waiting",
    statuses: STATUS_GROUP_WAITING,
  },
  {
    key: "closed",
    labelKey: "status_group_closed",
    statuses: STATUS_GROUP_CLOSED,
  },
] as const;

export type StatusGroupKey = (typeof STATUS_GROUPS)[number]["key"];

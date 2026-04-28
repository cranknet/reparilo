import type { JobStatusType } from "@shared/constants";

export const STATUS_DOT_COLORS: Record<JobStatusType, string> = {
  INTAKE: "bg-secondary",
  WAITING_FOR_PARTS: "bg-tertiary",
  IN_REPAIR: "bg-primary",
  ON_HOLD: "bg-error",
  DONE: "bg-on-secondary-container",
  DELIVERED: "bg-on-secondary-container",
  RETURNED: "bg-outline-variant",
  CANCELLED: "bg-outline-variant",
};

export const STATUS_CHIP_STYLES: Record<JobStatusType, string> = {
  INTAKE: "bg-secondary-container text-on-secondary-container",
  WAITING_FOR_PARTS: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  IN_REPAIR: "bg-primary/10 text-primary",
  ON_HOLD: "bg-error-container text-on-error-container",
  DONE: "bg-on-secondary-container/10 text-on-secondary-container",
  DELIVERED: "bg-on-secondary-container/10 text-on-secondary-container",
  RETURNED: "bg-outline-variant/20 text-on-surface-variant",
  CANCELLED: "bg-outline-variant/20 text-on-surface-variant",
};

export const STATUS_BADGE_STYLES: Record<JobStatusType, string> = {
  INTAKE: "bg-secondary-container text-on-secondary-container",
  WAITING_FOR_PARTS: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  IN_REPAIR: "bg-primary/10 text-primary",
  ON_HOLD: "bg-surface-container-high text-on-surface-variant",
  DONE: "bg-primary-fixed text-on-primary-fixed-variant",
  DELIVERED: "bg-surface-container text-on-surface-variant",
  RETURNED: "bg-error-container text-on-error-container",
  CANCELLED: "bg-surface-container-high text-on-surface-variant line-through",
};

export const STATUS_COLORS: Record<string, string> = {
  IN_REPAIR: "bg-primary",
  WAITING_FOR_PARTS: "bg-tertiary",
  INTAKE: "bg-secondary",
  TESTING: "bg-outline-variant",
  DONE: "bg-on-secondary-container",
};

import type { Prisma } from "@generated/client";

export type User = Prisma.UserGetPayload<Record<string, never>>;
export type SafeUser = Omit<User, "password">;
export type Customer = Prisma.CustomerGetPayload<Record<string, never>>;
export type Device = Prisma.DeviceGetPayload<Record<string, never>>;
export type Job = Prisma.JobGetPayload<{
  include: {
    customer: true;
    device: true;
    technician: { select: { id: true; name: true; username: true } };
    photos: true;
    notes: {
      include: {
        createdBy: { select: { id: true; name: true; username: true } };
      };
    };
    partsUsed: true;
    repairs: true;
  };
}>;
export type JobPhoto = Prisma.JobPhotoGetPayload<Record<string, never>>;
export type JobNote = Prisma.JobNoteGetPayload<{
  include: { createdBy: { select: { id: true; name: true; username: true } } };
}>;
export type JobPart = Prisma.JobPartGetPayload<Record<string, never>>;
export type JobRepair = Prisma.JobRepairGetPayload<Record<string, never>>;
export type PartsCatalog = Prisma.PartsCatalogGetPayload<Record<string, never>>;
export type RepairCatalog = Prisma.RepairCatalogGetPayload<
  Record<string, never>
>;
export type AuditLog = Prisma.AuditLogGetPayload<Record<string, never>>;
export type NotificationTemplate = Prisma.NotificationTemplateGetPayload<
  Record<string, never>
>;
export type ShopSettings = Prisma.ShopSettingsGetPayload<Record<string, never>>;
export type AiSettings = Prisma.AiSettingsGetPayload<Record<string, never>>;
export type AiChatHistory = Prisma.AiChatHistoryGetPayload<
  Record<string, never>
>;

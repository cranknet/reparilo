import { OutboxStatus } from "@generated/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  outboxCreate: vi.fn(),
  outboxFindMany: vi.fn(),
  outboxUpdate: vi.fn(),
  shopSettingsFindUnique: vi.fn(),
  sendWhatsApp: vi.fn(),
  decryptWhatsAppConfig: vi.fn(),
}));

vi.mock("../services/notification-renderer.js", () => ({
  renderTemplate: (body: string, vars: Record<string, string | number>) =>
    body.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) =>
      String(vars[k] ?? "")
    ),
}));

vi.mock("../services/notification-sender.js", () => ({
  sendWhatsApp: mocks.sendWhatsApp,
  decryptWhatsAppConfig: mocks.decryptWhatsAppConfig,
}));

const prisma = {
  notificationOutbox: {
    create: mocks.outboxCreate,
    findMany: mocks.outboxFindMany,
    update: mocks.outboxUpdate,
  },
  shopSettings: {
    findUnique: mocks.shopSettingsFindUnique,
  },
} as any;

import {
  getOutboxLogs,
  processOutbox,
  queueNotification,
} from "../services/notification-outbox.service.js";

describe("queueNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an outbox entry with QUEUED status", async () => {
    mocks.outboxCreate.mockResolvedValue({ id: "out-1" });

    await queueNotification(prisma, {
      templateName: "job-ready",
      channel: "WHATSAPP",
      recipientPhone: "05551234567",
      templateVars: { name: "Ahmed", jobCode: "RPR-001" },
      templateBody: "Hello {{name}}, job {{jobCode}} is ready.",
    });

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        channel: "WHATSAPP",
        jobId: null,
        recipientPhone: "05551234567",
        renderedBody: "Hello Ahmed, job RPR-001 is ready.",
        status: OutboxStatus.QUEUED,
        templateName: "job-ready",
      },
    });
  });

  it("passes jobId when provided", async () => {
    mocks.outboxCreate.mockResolvedValue({ id: "out-2" });

    await queueNotification(prisma, {
      jobId: "job-42",
      templateName: "job-ready",
      channel: "WHATSAPP",
      recipientPhone: "05551234567",
      templateVars: {},
      templateBody: "Your repair is done.",
    });

    expect(mocks.outboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobId: "job-42" }),
      })
    );
  });
});

describe("processOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends pending WHATSAPP entries and updates to SENT", async () => {
    mocks.outboxFindMany.mockResolvedValue([
      {
        id: "out-1",
        channel: "WHATSAPP",
        recipientPhone: "05551234567",
        renderedBody: "Hello Ahmed, job RPR-001 is ready.",
      },
    ]);
    mocks.shopSettingsFindUnique.mockResolvedValue({
      whatsappApiTokenEncrypted: "enc-token",
      whatsappBusinessId: "biz-1",
      whatsappPhoneNumberId: "phone-1",
    });
    mocks.decryptWhatsAppConfig.mockReturnValue({
      apiToken: "decrypted-token",
      businessId: "biz-1",
      phoneNumberId: "phone-1",
    });
    mocks.sendWhatsApp.mockResolvedValue({ success: true });
    mocks.outboxUpdate.mockResolvedValue({ id: "out-1" });

    await processOutbox(prisma);

    expect(mocks.outboxFindMany).toHaveBeenCalledWith({
      where: { status: OutboxStatus.QUEUED },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    expect(mocks.sendWhatsApp).toHaveBeenCalledWith(
      {
        apiToken: "decrypted-token",
        businessId: "biz-1",
        phoneNumberId: "phone-1",
      },
      "05551234567",
      "Hello Ahmed, job RPR-001 is ready."
    );
    expect(mocks.outboxUpdate).toHaveBeenCalledWith({
      where: { id: "out-1" },
      data: {
        error: undefined,
        sentAt: expect.any(Date),
        status: OutboxStatus.SENT,
      },
    });
  });

  it("updates to FAILED when send fails and records error", async () => {
    mocks.outboxFindMany.mockResolvedValue([
      {
        id: "out-2",
        channel: "WHATSAPP",
        recipientPhone: "05551234567",
        renderedBody: "Hello",
      },
    ]);
    mocks.shopSettingsFindUnique.mockResolvedValue({
      whatsappApiTokenEncrypted: "enc-token",
      whatsappBusinessId: "biz-1",
      whatsappPhoneNumberId: "phone-1",
    });
    mocks.decryptWhatsAppConfig.mockReturnValue({
      apiToken: "decrypted-token",
      businessId: "biz-1",
      phoneNumberId: "phone-1",
    });
    mocks.sendWhatsApp.mockResolvedValue({
      success: false,
      error: "WhatsApp API 403: Invalid token",
    });

    await processOutbox(prisma);

    expect(mocks.outboxUpdate).toHaveBeenCalledWith({
      where: { id: "out-2" },
      data: {
        error: "WhatsApp API 403: Invalid token",
        sentAt: null,
        status: OutboxStatus.FAILED,
      },
    });
  });

  it("does nothing when no pending entries exist", async () => {
    mocks.outboxFindMany.mockResolvedValue([]);

    await processOutbox(prisma);

    expect(mocks.shopSettingsFindUnique).not.toHaveBeenCalled();
    expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
    expect(mocks.outboxUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when WhatsApp config is missing", async () => {
    mocks.outboxFindMany.mockResolvedValue([
      {
        id: "out-4",
        channel: "WHATSAPP",
        recipientPhone: "05551234567",
        renderedBody: "Hello",
      },
    ]);
    mocks.shopSettingsFindUnique.mockResolvedValue(null);

    await processOutbox(prisma);

    expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
    expect(mocks.outboxUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when decryptWhatsAppConfig returns null", async () => {
    mocks.outboxFindMany.mockResolvedValue([
      {
        id: "out-5",
        channel: "WHATSAPP",
        recipientPhone: "05551234567",
        renderedBody: "Hello",
      },
    ]);
    mocks.shopSettingsFindUnique.mockResolvedValue({
      whatsappApiTokenEncrypted: "enc-token",
      whatsappBusinessId: "biz-1",
      whatsappPhoneNumberId: "phone-1",
    });
    mocks.decryptWhatsAppConfig.mockReturnValue(null);

    await processOutbox(prisma);

    expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
    expect(mocks.outboxUpdate).not.toHaveBeenCalled();
  });
});

describe("getOutboxLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns outbox entries ordered by createdAt desc", async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 60_000);
    mocks.outboxFindMany.mockResolvedValue([
      {
        id: "out-2",
        channel: "WHATSAPP",
        createdAt: now,
        error: null,
        jobId: "job-2",
        recipientPhone: "05551111111",
        renderedBody: "Recent",
        status: OutboxStatus.SENT,
        templateName: "job-ready",
      },
      {
        id: "out-1",
        channel: "WHATSAPP",
        createdAt: earlier,
        error: "Send failed: rate limited",
        jobId: null,
        recipientPhone: "05550000000",
        renderedBody: "Older",
        status: OutboxStatus.FAILED,
        templateName: "job-delayed",
      },
    ]);

    const logs = await getOutboxLogs(prisma);

    expect(mocks.outboxFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 50,
      where: {},
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual({
      channel: "WHATSAPP",
      createdAt: now,
      error: null,
      id: "out-2",
      jobId: "job-2",
      renderedBody: "Recent",
      recipientPhone: "05551111111",
      status: OutboxStatus.SENT,
      templateName: "job-ready",
    });
    expect(logs[1]).toEqual({
      channel: "WHATSAPP",
      createdAt: earlier,
      error: "Send failed: rate limited",
      id: "out-1",
      jobId: null,
      renderedBody: "Older",
      recipientPhone: "05550000000",
      status: OutboxStatus.FAILED,
      templateName: "job-delayed",
    });
  });

  it("respects custom limit", async () => {
    mocks.outboxFindMany.mockResolvedValue([]);

    await getOutboxLogs(prisma, 10);

    expect(mocks.outboxFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: {},
    });
  });
});

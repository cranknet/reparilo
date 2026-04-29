import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { useSettingsStore } from "@/stores/settings";

interface ChannelSettingsProps {
  onFetchWhatsAppSettings: () => Promise<void>;
  onSaveWhatsAppSettings: (data: {
    apiToken?: string;
    businessId?: string;
    phoneNumberId?: string;
    enabled?: boolean;
  }) => Promise<void>;
  whatsAppSettings: ReturnType<
    typeof useSettingsStore.getState
  >["whatsAppSettings"];
}

export default function ChannelSettings({
  whatsAppSettings,
  onFetchWhatsAppSettings,
  onSaveWhatsAppSettings,
}: ChannelSettingsProps) {
  const { t } = useTranslation();
  const [whatsAppForm, setWhatsAppForm] = useState({
    apiToken: "",
    businessId: "",
    phoneNumberId: "",
    enabled: false,
  });
  const [whatsAppSaving, setWhatsAppSaving] = useState(false);
  const [whatsAppLoaded, setWhatsAppLoaded] = useState(false);

  useEffect(() => {
    if (!whatsAppLoaded) {
      onFetchWhatsAppSettings().catch(() => {
        /* intentionally swallowed */
      });
      setWhatsAppLoaded(true);
    }
  }, [whatsAppLoaded, onFetchWhatsAppSettings]);

  useEffect(() => {
    if (whatsAppSettings && !whatsAppSaving) {
      setWhatsAppForm((prev) => ({
        apiToken: prev.apiToken || "",
        businessId: whatsAppSettings.businessId ?? "",
        phoneNumberId: whatsAppSettings.phoneNumberId ?? "",
        enabled: whatsAppSettings.enabled,
      }));
    }
  }, [whatsAppSettings, whatsAppSaving]);

  const handleWhatsAppSave = useCallback(async () => {
    setWhatsAppSaving(true);
    try {
      await onSaveWhatsAppSettings({
        apiToken: whatsAppForm.apiToken || undefined,
        businessId: whatsAppForm.businessId || undefined,
        phoneNumberId: whatsAppForm.phoneNumberId || undefined,
        enabled: whatsAppForm.enabled,
      });
    } catch {
      // Error is stored in Zustand state
    } finally {
      setWhatsAppSaving(false);
    }
  }, [whatsAppForm, onSaveWhatsAppSettings]);

  return (
    <div>
      <h3 className="font-extrabold font-headline text-lg text-on-surface tracking-tight">
        {t("whatsapp_settings")}
      </h3>
      <div className="mt-4 rounded-2xl bg-surface-container-low p-5">
        <label className="flex cursor-pointer select-none items-center gap-3">
          <input
            checked={whatsAppForm.enabled}
            className="sr-only"
            onChange={(e) =>
              setWhatsAppForm((f) => ({ ...f, enabled: e.target.checked }))
            }
            type="checkbox"
          />
          <span
            className="relative inline-block h-6 w-11 rounded-full transition-colors"
            style={{
              backgroundColor: whatsAppForm.enabled
                ? "var(--color-primary)"
                : "var(--color-outline-variant)",
            }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-on-primary shadow-sm transition-all"
              style={{
                insetInlineStart: whatsAppForm.enabled ? "22px" : "2px",
              }}
            />
          </span>
          <span className="font-medium text-on-surface text-sm">
            {t("whatsapp_enabled")}
          </span>
        </label>

        {whatsAppForm.enabled && (
          <div className="mt-5 space-y-4">
            <div>
              <label
                className="mb-1.5 block font-medium text-on-surface text-sm"
                htmlFor="wa-business-id"
              >
                {t("whatsapp_business_id")}
              </label>
              <input
                className="w-full rounded-xl bg-surface-container px-4 py-2.5 text-on-surface text-sm outline outline-1 outline-outline-variant focus:outline-2 focus:outline-primary"
                id="wa-business-id"
                onChange={(e) =>
                  setWhatsAppForm((f) => ({
                    ...f,
                    businessId: e.target.value,
                  }))
                }
                type="text"
                value={whatsAppForm.businessId}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block font-medium text-on-surface text-sm"
                htmlFor="wa-phone-id"
              >
                {t("whatsapp_phone_number_id")}
              </label>
              <input
                className="w-full rounded-xl bg-surface-container px-4 py-2.5 text-on-surface text-sm outline outline-1 outline-outline-variant focus:outline-2 focus:outline-primary"
                id="wa-phone-id"
                onChange={(e) =>
                  setWhatsAppForm((f) => ({
                    ...f,
                    phoneNumberId: e.target.value,
                  }))
                }
                type="text"
                value={whatsAppForm.phoneNumberId}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block font-medium text-on-surface text-sm"
                htmlFor="wa-api-token"
              >
                {t("whatsapp_api_token")}
              </label>
              <input
                autoComplete="off"
                className="w-full rounded-xl bg-surface-container px-4 py-2.5 text-on-surface text-sm outline outline-1 outline-outline-variant focus:outline-2 focus:outline-primary"
                id="wa-api-token"
                onChange={(e) =>
                  setWhatsAppForm((f) => ({ ...f, apiToken: e.target.value }))
                }
                placeholder={whatsAppSettings?.hasApiToken ? "••••••••" : ""}
                type="password"
                value={whatsAppForm.apiToken}
              />
            </div>
            <button
              className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-semibold text-on-primary text-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50"
              disabled={whatsAppSaving}
              onClick={handleWhatsAppSave}
              type="button"
            >
              {whatsAppSaving ? t("settings_saving") : t("save_changes")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

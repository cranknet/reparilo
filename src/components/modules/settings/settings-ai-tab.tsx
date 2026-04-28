import type { FormEvent } from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settings";

const AI_MODELS = [
  {
    id: "gpt-4o-mini",
    labelKey: "model_label_fast",
    labelShort: "GPT-4o Mini",
  },
  { id: "gpt-4o", labelKey: "model_label_balanced", labelShort: "GPT-4o" },
  {
    id: "gpt-4-turbo",
    labelKey: "model_label_best",
    labelShort: "GPT-4 Turbo",
  },
  {
    id: "o1-preview",
    labelKey: "model_label_advanced",
    labelShort: "o1-preview",
  },
];

const TEST_BUTTON_CLASSES: Record<string, string> = {
  success: "bg-success text-on-success",
  fail: "bg-error text-on-error",
};

const TEST_ICON: Record<string, string> = {
  loading: "progress_activity",
  success: "check_circle",
  fail: "error",
};

function getCreativityLabel(value: number, t: (key: string) => string): string {
  if (value <= 0.2) {
    return t("creativity_very_precise");
  }
  if (value <= 0.5) {
    return t("creativity_slightly_precise");
  }
  if (value <= 0.7) {
    return t("creativity_balanced");
  }
  return t("creativity_creative");
}

export interface SettingsAiTabHandle {
  requestSubmit: () => void;
  reset: () => void;
}

interface SettingsAiTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
  onToast: (message: string, type: "success" | "error") => void;
  ref?: React.Ref<SettingsAiTabHandle>;
}

export default function SettingsAiTab({
  ref,
  onDirtyChange,
  onSavingChange,
  onToast,
}: SettingsAiTabProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);

  const { aiSettings, fetchAiSettings, saveAiSettings, testAiConnection } =
    useSettingsStore();

  const [aiForm, setAiForm] = useState({
    endpointUrl: "",
    apiKey: "",
    model: "gpt-4o",
    temperature: 0.4,
    enabled: false,
  });
  const [aiFormInitial, setAiFormInitial] = useState(aiForm);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "fail"
  >("idle");

  useImperativeHandle(ref, () => ({
    requestSubmit: () => formRef.current?.requestSubmit(),
    reset: () => setAiForm({ ...aiFormInitial }),
  }));

  useEffect(() => {
    if (aiSettings) {
      const form = {
        endpointUrl: aiSettings.endpointUrl ?? "",
        apiKey: "",
        model: aiSettings.model ?? "gpt-4o",
        temperature: aiSettings.temperature ?? 0.4,
        enabled: aiSettings.enabled ?? false,
      };
      setAiForm(form);
      setAiFormInitial(form);
    }
  }, [aiSettings]);

  useEffect(() => {
    if (!aiSettings) {
      fetchAiSettings().catch(() => {
        // Error is stored in the Zustand state via fetchAiSettings
      });
    }
  }, [aiSettings, fetchAiSettings]);

  async function handleTestConnection() {
    setTestStatus("loading");
    const result = await testAiConnection();
    if (result.success) {
      setTestStatus("success");
    } else {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  }

  async function handleAiSubmit(e: FormEvent) {
    e.preventDefault();
    if (!aiForm.endpointUrl.trim()) {
      onToast(t("settings_error_endpoint_required"), "error");
      return;
    }
    onSavingChange(true);
    try {
      await saveAiSettings(aiForm);
      setAiFormInitial({ ...aiForm });
      onDirtyChange(false);
      onToast(t("ai_config_saved"), "success");
    } catch {
      onToast(t("settings_save_error"), "error");
    } finally {
      onSavingChange(false);
    }
  }

  const isTesting = testStatus === "loading";

  return (
    <form className="space-y-6" onSubmit={handleAiSubmit} ref={formRef}>
      <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${aiForm.enabled ? "bg-primary/10" : "bg-surface-container-highest"}`}
          >
            <span
              className={`material-symbols-outlined text-xl ${aiForm.enabled ? "text-primary" : "text-on-surface-variant"}`}
            >
              smart_toy
            </span>
          </div>
          <div>
            <p className="font-semibold text-on-surface text-sm">
              {t("ai_analyst")}
            </p>
            <p className="text-on-surface-variant text-xs">
              {aiForm.enabled ? t("ai_enabled_desc") : t("ai_disabled_desc")}
            </p>
          </div>
        </div>
        <Switch
          ariaLabel={t("ai_analyst")}
          checked={aiForm.enabled}
          onChange={(checked) => {
            setAiForm((f) => ({ ...f, enabled: checked }));
            onDirtyChange(true);
          }}
        />
      </div>
      <div className="rounded-2xl bg-surface-container-low p-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <label
              className="block font-semibold text-on-surface text-sm"
              htmlFor="ai-endpoint"
            >
              {t("ai_endpoint_label")}
              <span aria-hidden="true" className="ms-0.5 text-error">
                *
              </span>
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="ai-endpoint"
              onChange={(e) => {
                setAiForm((f) => ({ ...f, endpointUrl: e.target.value }));
                onDirtyChange(true);
              }}
              placeholder="https://api.openai.com/v1"
              required
              type="url"
              value={aiForm.endpointUrl}
            />
            <p className="text-on-surface-variant text-xs">
              {t("ai_endpoint_hint")}
            </p>
          </div>
          <div className="space-y-2">
            <label
              className="block font-semibold text-on-surface text-sm"
              htmlFor="ai-key"
            >
              {t("ai_key_label")}
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 pe-12 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="ai-key"
                onChange={(e) => {
                  setAiForm((f) => ({ ...f, apiKey: e.target.value }));
                  onDirtyChange(true);
                }}
                placeholder="sk-••••••••••••••"
                type={showApiKey ? "text" : "password"}
                value={aiForm.apiKey}
              />
              <button
                aria-label={
                  showApiKey ? t("auth_hide_password") : t("auth_show_password")
                }
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                onClick={() => setShowApiKey(!showApiKey)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showApiKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <p className="text-on-surface-variant text-xs">
              {t("ai_key_hint")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-container-low p-5">
        <div className="space-y-2">
          <label
            className="block font-semibold text-on-surface text-sm"
            htmlFor="ai-model"
          >
            {t("analytical_model")}
          </label>
          <div className="relative">
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 pe-10 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="ai-model"
              onChange={(e) => {
                setAiForm((f) => ({ ...f, model: e.target.value }));
                onDirtyChange(true);
              }}
              value={aiForm.model}
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.labelKey)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">
                expand_more
              </span>
            </span>
          </div>
        </div>
        <button
          aria-expanded={showAdvanced}
          className="mt-4 flex items-center gap-2 text-on-surface-variant text-sm transition-colors hover:text-primary"
          onClick={() => setShowAdvanced(!showAdvanced)}
          type="button"
        >
          <span
            className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
          {t("advanced_settings")}
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label
                className="font-semibold text-on-surface text-sm"
                htmlFor="ai-temp"
              >
                {t("ai_creativity_label")}
              </label>
              <span className="font-mono font-semibold text-primary text-sm">
                {aiForm.temperature.toFixed(1)}
              </span>
            </div>
            <input
              aria-labelledby="ai-temp"
              aria-valuetext={getCreativityLabel(aiForm.temperature, t)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-outline-variant/30 accent-primary"
              id="ai-temp"
              max="1"
              min="0"
              onChange={(e) => {
                setAiForm((f) => ({
                  ...f,
                  temperature: Number.parseFloat(e.target.value),
                }));
                onDirtyChange(true);
              }}
              step="0.1"
              type="range"
              value={aiForm.temperature}
            />
            <div className="flex justify-between text-on-surface-variant text-xs">
              <span>{t("precise")}</span>
              <span>{t("creative")}</span>
            </div>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              {t("temperature_note")}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          className={`flex min-h-11 items-center gap-2 rounded-xl px-6 py-3 font-bold text-sm transition-all ${TEST_BUTTON_CLASSES[testStatus] ?? "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
          disabled={isTesting}
          onClick={handleTestConnection}
          type="button"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${isTesting ? "animate-spin" : ""}`}
          >
            {TEST_ICON[testStatus] ?? "network_check"}
          </span>
          {isTesting ? t("testing_connection") : t("test_connection")}
        </button>
        {testStatus === "success" && (
          <span className="font-medium text-sm text-success">
            {t("connection_success")}
          </span>
        )}
        {testStatus === "fail" && (
          <span className="font-medium text-error text-sm">
            {t("connection_failed")}
          </span>
        )}
      </div>

      <div className="rounded-2xl bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">
            psychology
          </span>
          <div>
            <p className="font-semibold text-on-surface text-sm">
              {t("ai_memory_title")}
            </p>
            <p className="mt-0.5 max-w-prose text-on-surface-variant text-xs leading-relaxed">
              {t("ai_memory_desc")}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

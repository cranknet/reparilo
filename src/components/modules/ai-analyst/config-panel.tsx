import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function getPingIcon(status: string) {
  if (status === "testing") {
    return "progress_activity";
  }
  if (status === "success") {
    return "check_circle";
  }
  if (status === "failed") {
    return "error";
  }
  return "wifi_tethering";
}

function getTemperatureLabel(temp: number): string {
  if (temp <= 0.3) {
    return "precise";
  }
  if (temp <= 0.6) {
    return "balanced";
  }
  return "creative";
}

interface AiConfigPanelProps {
  onClose: () => void;
  open: boolean;
}

export default function AiConfigPanel({ open, onClose }: AiConfigPanelProps) {
  const { t } = useTranslation();
  const [endpoint, setEndpoint] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.4);
  const [showKey, setShowKey] = useState(false);
  const [pingStatus, setPingStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");

  const handleTestConnection = () => {
    setPingStatus("testing");
    setTimeout(() => setPingStatus("success"), 1500);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (window.matchMedia("(min-width: 1280px)").matches) {
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  return (
    <aside
      aria-label={t("ai_configuration")}
      className={`fixed end-0 top-0 z-40 h-full w-80 max-w-[85vw] overflow-y-auto bg-surface-container-high transition-transform duration-300 md:w-96 md:max-w-none xl:static xl:z-auto xl:h-auto xl:translate-x-0 ${open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"}`}
      {...(open ? { role: "dialog", "aria-modal": true as const } : {})}
    >
      <div className="p-6">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="font-bold font-headline text-lg text-on-surface">
            {t("ai_configuration")}
          </h3>
          <button
            aria-label={t("close")}
            className="p-3 text-on-surface-variant transition-colors hover:text-primary focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30 xl:hidden"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <span className="hidden text-on-surface-variant xl:inline-block">
            <span className="material-symbols-outlined text-sm">tune</span>
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <label
                className="block font-bold text-on-surface-variant text-xs uppercase tracking-wider"
                htmlFor="ai-api-key"
              >
                {t("access_key")}
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-xl bg-surface-container-lowest px-4 py-3 text-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  id="ai-api-key"
                  onChange={(e) => setApiKey(e.target.value)}
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                />
                <button
                  aria-label={
                    showKey ? t("auth_hide_password") : t("auth_show_password")
                  }
                  className="absolute end-3 top-2.5 rounded-lg p-2 text-on-surface-variant text-sm focus-visible:ring-2 focus-visible:ring-primary/30"
                  onClick={() => setShowKey((v) => !v)}
                  type="button"
                >
                  <span className="material-symbols-outlined">
                    {showKey ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label
                className="block font-bold text-on-surface-variant text-xs uppercase tracking-wider"
                htmlFor="ai-model"
              >
                {t("analytical_model")}
              </label>
              <div className="relative">
                <select
                  className="w-full cursor-pointer appearance-none rounded-xl bg-surface-container-lowest px-4 py-3 text-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  id="ai-model"
                  onChange={(e) => setModel(e.target.value)}
                  value={model}
                >
                  <option value="gpt-4o">{t("gpt_4o_default")}</option>
                  <option value="gpt-4o-mini">{t("gpt_4o_mini")}</option>
                  <option value="gpt-3.5-turbo">{t("gpt_3_5_turbo")}</option>
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute end-3 top-2.5 text-on-surface-variant text-sm">
                  expand_more
                </span>
              </div>
            </div>

            <div className="pt-6">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-fixed px-4 py-3 font-bold text-on-secondary-fixed text-sm transition-all hover:bg-secondary-fixed-dim"
                onClick={handleTestConnection}
                type="button"
              >
                <span
                  className={`material-symbols-outlined text-lg ${pingStatus === "testing" ? "animate-spin" : ""}`}
                >
                  {getPingIcon(pingStatus)}
                </span>
                {pingStatus === "testing"
                  ? t("testing_connection")
                  : t("test_connection")}
              </button>
              <p className="mt-3 text-center text-on-surface-variant text-xs">
                {pingStatus === "success" &&
                  t("last_ping", { time: t("just_now") })}
                {pingStatus === "failed" && t("connection_failed")}
                {pingStatus === "idle" && t("last_ping", { time: "—" })}
              </p>
            </div>

            <details>
              <summary className="cursor-pointer rounded-lg font-bold text-on-surface-variant text-xs uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-primary/30">
                {t("advanced_settings")}
              </summary>
              <div className="mt-4 space-y-6">
                <div className="space-y-3">
                  <label
                    className="block font-bold text-on-surface-variant text-xs uppercase tracking-wider"
                    htmlFor="ai-endpoint"
                  >
                    {t("connection_url")}
                  </label>
                  <div className="relative">
                    <input
                      className="w-full rounded-xl bg-surface-container-lowest px-4 py-3 text-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                      id="ai-endpoint"
                      onChange={(e) => setEndpoint(e.target.value)}
                      type="text"
                      value={endpoint}
                    />
                    <span className="material-symbols-outlined absolute end-3 top-2.5 text-primary/40 text-sm">
                      link
                    </span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="font-bold text-on-surface-variant text-xs uppercase tracking-wider"
                      htmlFor="ai-temperature"
                    >
                      {t("ai_creativity_setting")}
                    </label>
                    <span className="font-bold font-mono text-primary text-xs">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    aria-valuetext={t(getTemperatureLabel(temperature))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                    id="ai-temperature"
                    max="1"
                    min="0"
                    onChange={(e) =>
                      setTemperature(Number.parseFloat(e.target.value))
                    }
                    step="0.1"
                    type="range"
                    value={temperature}
                  />
                  <div className="flex justify-between font-bold text-on-surface-variant text-xs uppercase">
                    <span>{t("precise")}</span>
                    <span>{t("creative")}</span>
                  </div>
                  <div className="rounded-lg bg-surface-container-lowest/50 p-3 text-on-surface-variant text-xs leading-relaxed">
                    <span className="font-bold text-primary italic">
                      {t("note")}:
                    </span>{" "}
                    {t("temperature_note")}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </form>

        <div className="mt-12 rounded-xl bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-sm">
              database
            </span>
            <span className="font-bold text-primary text-xs uppercase">
              {t("ai_data_scope")}
            </span>
          </div>
          <p className="text-on-surface-variant text-xs italic">
            {t("ai_data_scope_desc")}
          </p>
        </div>
      </div>
    </aside>
  );
}

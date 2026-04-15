import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";

type SettingsTab = "ai" | "shop" | "notifications" | "users";

const TAB_KEYS: SettingsTab[] = ["ai", "shop", "notifications", "users"];

const TAB_ICONS: Record<SettingsTab, string> = {
  ai: "psychology",
  shop: "storefront",
  notifications: "notifications",
  users: "group",
};

const AI_MODELS = [
  { id: "gpt-4o-mini", label: "Fast & Affordable", labelShort: "GPT-4o Mini" },
  { id: "gpt-4o", label: "Balanced (Recommended)", labelShort: "GPT-4o" },
  { id: "gpt-4-turbo", label: "Best Quality", labelShort: "GPT-4 Turbo" },
  { id: "o1-preview", label: "Advanced Reasoning", labelShort: "o1-preview" },
];

const MOCK_TEMPLATES = [
  {
    id: "1",
    name: "Job Status Update",
    channel: "WHATSAPP" as const,
    body: "Hello {{customer}}, your device {{device}} status is now: {{status}}. \u2014 {{shopName}}",
    isDefault: true,
  },
  {
    id: "2",
    name: "Job Ready",
    channel: "WHATSAPP" as const,
    body: "{{device}} is ready for pickup! Total: {{cost}} {{currency}}. \u2014 {{shopName}}",
    isDefault: false,
  },
  {
    id: "3",
    name: "Status SMS",
    channel: "SMS" as const,
    body: "{{shopName}}: {{device}} status \u2192 {{status}}. Track: {{trackingUrl}}",
    isDefault: true,
  },
];

const MOCK_USERS = [
  {
    id: "1",
    username: "karim",
    email: "karim@reparilo.dz",
    role: "OWNER",
    isActive: true,
  },
  {
    id: "2",
    username: "yacine",
    email: "yacine@reparilo.dz",
    role: "TECHNICIAN",
    isActive: true,
  },
  {
    id: "3",
    username: "amina",
    email: "amina@reparilo.dz",
    role: "FRONT_DESK",
    isActive: true,
  },
  {
    id: "4",
    username: "said",
    email: "said@reparilo.dz",
    role: "TECHNICIAN",
    isActive: false,
  },
];

const ROLE_CONFIG: Record<string, { color: string; icon: string }> = {
  OWNER: { color: "bg-primary/10 text-primary", icon: "admin_panel_settings" },
  TECHNICIAN: {
    color: "bg-on-secondary-container/10 text-on-secondary-container",
    icon: "build",
  },
  FRONT_DESK: { color: "bg-tertiary/10 text-tertiary", icon: "desk" },
};

type ToastType = "success" | "error" | null;

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

export default function SettingsPage() {
  const { t } = useTranslation();
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");
  const [dirtyTabs, setDirtyTabs] = useState<Set<SettingsTab>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const aiFormRef = useRef<HTMLFormElement>(null);
  const shopFormRef = useRef<HTMLFormElement>(null);
  const tabPanelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({
    ai: null,
    shop: null,
    notifications: null,
    users: null,
  });
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const [aiForm, setAiForm] = useState({
    endpointUrl: "",
    apiKey: "",
    model: "gpt-4o",
    temperature: 0.4,
  });
  const [aiFormInitial, setAiFormInitial] = useState(aiForm);
  const [shopForm, setShopForm] = useState({
    shopName: "",
    address: "",
    phone: "",
    currency: "DZD",
    receiptFooter: "",
  });
  const [shopFormInitial, setShopFormInitial] = useState(shopForm);
  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "fail"
  >("idle");

  const dirty = dirtyTabs.size > 0;
  const currentTabDirty = dirtyTabs.has(activeTab);
  const tabId = (key: SettingsTab) => `${baseId}-tab-${key}`;
  const headingId = (key: SettingsTab) => `${baseId}-heading-${key}`;
  const panelId = (key: SettingsTab) => `${baseId}-panel-${key}`;

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    const timer = setTimeout(() => setToast(null), 5000);
    setToastTimer(timer);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer) {
      clearTimeout(toastTimer);
      setToastTimer(null);
    }
  }, [toastTimer]);

  useEffect(() => {
    return () => {
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
    };
  }, [toastTimer]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "ai", label: t("ai_configuration") },
    { key: "shop", label: t("shop_information") },
    { key: "notifications", label: t("notifications_settings") },
    { key: "users", label: t("users_management") },
  ];

  function markTabDirty(tab: SettingsTab) {
    setDirtyTabs((prev) => new Set(prev).add(tab));
  }

  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  function switchTab(key: SettingsTab) {
    if (dirtyTabs.has(activeTab) && activeTab !== key) {
      setPendingTab(key);
      return;
    }
    setActiveTab(key);
    tabRefs.current[key]?.focus();
  }

  useEffect(() => {
    if (!pendingTab) {
      return;
    }
    previousActiveElement.current = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();

    function handleDialogKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setPendingTab(null);
        return;
      }
      if (e.key !== "Tab") {
        return;
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        return;
      }
      const first = focusable[0];
      const last = Array.from(focusable).at(-1);
      if (!last) {
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      previousActiveElement.current?.focus();
    };
  }, [pendingTab]);

  function handleDiscardAndSwitch() {
    if (!pendingTab) {
      return;
    }
    if (activeTab === "ai") {
      setAiForm({ ...aiFormInitial });
    } else if (activeTab === "shop") {
      setShopForm({ ...shopFormInitial });
    }
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      next.delete(activeTab);
      return next;
    });
    setActiveTab(pendingTab);
    tabRefs.current[pendingTab]?.focus();
    setPendingTab(null);
  }

  function handleKeepEditing() {
    setPendingTab(null);
  }

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = TAB_KEYS.indexOf(activeTab);
    let nextIndex: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % TAB_KEYS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TAB_KEYS.length - 1;
    }
    if (nextIndex !== undefined) {
      e.preventDefault();
      const nextTab = TAB_KEYS[nextIndex];
      switchTab(nextTab);
    }
  }

  async function handleTestConnection() {
    setTestStatus("loading");
    try {
      await api.post("/settings/ai/test");
      setTestStatus("success");
    } catch {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  }

  async function handleAiSubmit(e: FormEvent) {
    e.preventDefault();
    if (!aiForm.endpointUrl.trim()) {
      showToast(t("settings_error_endpoint_required"), "error");
      return;
    }
    setSaving(true);
    try {
      await api.put("/settings/ai", aiForm);
      setAiFormInitial({ ...aiForm });
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.delete("ai");
        return next;
      });
      showToast(t("ai_config_saved"), "success");
    } catch {
      showToast(t("settings_save_error"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleShopSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shopForm.shopName.trim()) {
      showToast(t("settings_error_shop_name_required"), "error");
      return;
    }
    setSaving(true);
    try {
      await api.put("/settings/shop", shopForm);
      setShopFormInitial({ ...shopForm });
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.delete("shop");
        return next;
      });
      showToast(t("shop_config_saved"), "success");
    } catch {
      showToast(t("settings_save_error"), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (activeTab === "ai") {
      setAiForm({ ...aiFormInitial });
    } else if (activeTab === "shop") {
      setShopForm({ ...shopFormInitial });
    }
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      next.delete(activeTab);
      return next;
    });
  }

  function renderAiSection() {
    const isTesting = testStatus === "loading";
    return (
      <form className="space-y-6" onSubmit={handleAiSubmit} ref={aiFormRef}>
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
                  markTabDirty("ai");
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
                    markTabDirty("ai");
                  }}
                  placeholder="sk-\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  type={showApiKey ? "text" : "password"}
                  value={aiForm.apiKey}
                />
                <button
                  aria-label={
                    showApiKey
                      ? t("auth_hide_password")
                      : t("auth_show_password")
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
                  markTabDirty("ai");
                }}
                value={aiForm.model}
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
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
                  markTabDirty("ai");
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

  function renderShopSection() {
    return (
      <form className="space-y-6" onSubmit={handleShopSubmit} ref={shopFormRef}>
        <div className="rounded-2xl bg-surface-container-low p-5">
          <p className="mb-4 font-semibold text-on-surface text-sm">
            {t("shop_identity_label")}
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label
                className="block font-semibold text-on-surface text-sm"
                htmlFor="shop-name"
              >
                {t("shop_name")}
                <span aria-hidden="true" className="ms-0.5 text-error">
                  *
                </span>
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="shop-name"
                onChange={(e) => {
                  setShopForm((f) => ({ ...f, shopName: e.target.value }));
                  markTabDirty("shop");
                }}
                placeholder="Reparilo"
                required
                type="text"
                value={shopForm.shopName}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block font-semibold text-on-surface text-sm"
                htmlFor="shop-phone"
              >
                {t("shop_phone")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="shop-phone"
                onChange={(e) => {
                  setShopForm((f) => ({ ...f, phone: e.target.value }));
                  markTabDirty("shop");
                }}
                placeholder="+213 XX XXX XXXX"
                type="tel"
                value={shopForm.phone}
              />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <label
              className="block font-semibold text-on-surface text-sm"
              htmlFor="shop-address"
            >
              {t("shop_address")}
            </label>
            <textarea
              className="w-full resize-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="shop-address"
              onChange={(e) => {
                setShopForm((f) => ({ ...f, address: e.target.value }));
                markTabDirty("shop");
              }}
              placeholder="123 Rue Didouche Mourad, Algiers"
              rows={3}
              value={shopForm.address}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-container-low p-5">
          <p className="mb-4 font-semibold text-on-surface text-sm">
            {t("regional_settings_label")}
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label
                className="block font-semibold text-on-surface text-sm"
                htmlFor="shop-currency"
              >
                {t("currency")}
              </label>
              <div className="relative">
                <select
                  className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 pe-10 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  id="shop-currency"
                  onChange={(e) => {
                    setShopForm((f) => ({ ...f, currency: e.target.value }));
                    markTabDirty("shop");
                  }}
                  value={shopForm.currency}
                >
                  <option value="DZD">DZD \u2014 Algerian Dinar (DA)</option>
                  <option value="USD">USD \u2014 US Dollar ($)</option>
                  <option value="EUR">EUR \u2014 Euro (\u20ac)</option>
                </select>
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">
                    expand_more
                  </span>
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label
                className="block font-semibold text-on-surface text-sm"
                htmlFor="shop-receipt"
              >
                {t("receipt_footer")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="shop-receipt"
                onChange={(e) => {
                  setShopForm((f) => ({ ...f, receiptFooter: e.target.value }));
                  markTabDirty("shop");
                }}
                placeholder="Thanks for choosing Reparilo!"
                type="text"
                value={shopForm.receiptFooter}
              />
            </div>
          </div>
        </div>
      </form>
    );
  }

  function renderTemplateGroup(
    title: string,
    icon: string,
    templates: typeof MOCK_TEMPLATES
  ) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-on-surface">
            {icon}
          </span>
          <h4 className="font-bold font-headline text-on-surface text-sm">
            {title}
          </h4>
        </div>
        {templates.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
              markdown
            </span>
            <p className="mt-3 text-on-surface-variant text-sm">
              {t("no_templates")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div
                className="rounded-2xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container-high/60"
                key={tpl.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-surface text-sm">
                        {tpl.name}
                      </span>
                      {tpl.isDefault && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary text-xs uppercase">
                          {t("default_template")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-mono text-on-surface-variant text-xs leading-relaxed sm:text-sm">
                      {tpl.body}
                    </p>
                  </div>
                  <button
                    aria-label={`${t("edit")} ${tpl.name}`}
                    className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-primary"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      edit
                    </span>
                    <span className="hidden sm:inline">{t("edit")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderNotificationsSection() {
    const whatsappTemplates = MOCK_TEMPLATES.filter(
      (tpl) => tpl.channel === "WHATSAPP"
    );
    const smsTemplates = MOCK_TEMPLATES.filter((tpl) => tpl.channel === "SMS");
    return (
      <div className="space-y-8">
        {renderTemplateGroup(
          t("whatsapp_templates"),
          "chat",
          whatsappTemplates
        )}
        {renderTemplateGroup(t("sms_templates"), "sms", smsTemplates)}
      </div>
    );
  }

  function renderUsersSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <button
            className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary text-sm transition-all active:opacity-80"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              person_add
            </span>
            {t("add_user")}
          </button>
        </div>
        <div className="space-y-3">
          {MOCK_USERS.map((user) => {
            const roleCfg = ROLE_CONFIG[user.role] ?? {
              color: "bg-surface-container text-on-surface-variant",
              icon: "person",
            };
            return (
              <div
                className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container-high/60"
                key={user.id}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest font-bold text-on-surface-variant text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-on-surface text-sm">
                      {user.username}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-xs uppercase ${roleCfg.color}`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {roleCfg.icon}
                      </span>
                      {t(`role.${user.role}`)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-on-surface-variant text-xs">
                    {user.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs ${user.isActive ? "bg-success/10 text-success" : "bg-on-surface-variant/10 text-on-surface-variant"}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-success" : "bg-on-surface-variant/40"}`}
                    />
                    {user.isActive ? t("status_active") : t("status_inactive")}
                  </span>
                  <button
                    aria-label={`${t("edit")} ${user.username}`}
                    className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg p-2 text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-primary"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      edit
                    </span>
                    <span className="hidden sm:inline">{t("edit")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const sectionDescriptions: Record<SettingsTab, string> = {
    ai: t("ai_configuration_desc"),
    shop: t("shop_information_desc"),
    notifications: t("notifications_settings_desc"),
    users: t("users_management_desc"),
  };

  const sectionRenderers: Record<SettingsTab, () => ReactNode> = {
    ai: renderAiSection,
    shop: renderShopSection,
    notifications: renderNotificationsSection,
    users: renderUsersSection,
  };

  const isFormTab = activeTab === "ai" || activeTab === "shop";

  return (
    <>
      <div className="mb-8">
        <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
          {t("settings_page")}
        </h2>
        <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
          {t("settings_page_desc")}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div
          aria-label={t("settings_page")}
          className="grid grid-cols-5 gap-1 lg:sticky lg:top-24 lg:flex lg:w-52 lg:shrink-0 lg:flex-col lg:self-start"
          role="tablist"
        >
          {tabs.map(({ key, label }) => (
            <button
              aria-controls={panelId(key)}
              aria-selected={activeTab === key}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 text-center transition-all lg:flex-row lg:gap-2.5 lg:px-4 lg:py-3 lg:text-left ${
                activeTab === key
                  ? "bg-primary/10 font-bold text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
              id={tabId(key)}
              key={key}
              onClick={() => switchTab(key)}
              onKeyDown={handleTabKeyDown}
              ref={(el) => {
                tabRefs.current[key] = el;
              }}
              role="tab"
              tabIndex={activeTab === key ? 0 : -1}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">
                {TAB_ICONS[key]}
              </span>
              <span className="text-xs leading-tight lg:hidden">{label}</span>
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            aria-labelledby={headingId(activeTab)}
            className="rounded-3xl bg-surface-container-lowest p-5 md:p-7"
            id={panelId(activeTab)}
            ref={tabPanelRef}
            role="tabpanel"
          >
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[22px] text-primary">
                  {TAB_ICONS[activeTab]}
                </span>
                <h3
                  className="font-extrabold font-headline text-lg text-on-surface"
                  id={headingId(activeTab)}
                >
                  {tabs.find((tab) => tab.key === activeTab)?.label}
                </h3>
              </div>
              <p className="mt-1 ps-9 text-on-surface-variant text-sm">
                {sectionDescriptions[activeTab]}
              </p>
            </div>
            {sectionRenderers[activeTab]()}
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              currentTabDirty && isFormTab
                ? "mt-4 max-h-24 opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-on-surface-variant text-sm">
                {t("unsaved_changes")}
              </span>
              <div className="flex gap-3">
                <button
                  className="rounded-xl px-4 py-2 font-semibold text-on-surface-variant text-sm transition-colors hover:bg-surface-container"
                  onClick={handleCancel}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2 font-bold text-on-primary text-sm transition-all active:opacity-80"
                  disabled={saving}
                  onClick={() => {
                    const form =
                      activeTab === "ai"
                        ? aiFormRef.current
                        : shopFormRef.current;
                    if (form) {
                      form.requestSubmit();
                    }
                  }}
                  type="submit"
                >
                  {saving ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">
                      save
                    </span>
                  )}
                  {saving ? t("settings_saving") : t("save_changes")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          aria-live="polite"
          className={`fixed start-4 end-4 bottom-4 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-sm shadow-lg transition-all sm:start-auto sm:end-6 sm:bottom-6 ${
            toast.type === "success"
              ? "bg-success text-on-success"
              : "bg-error text-on-error"
          }`}
          role="status"
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="min-w-0 flex-1 truncate">{toast.message}</span>
          <button
            aria-label={t("cancel")}
            className="ms-2 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
            onClick={dismissToast}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {pendingTab && (
        <div
          aria-label={t("confirm_tab_switch_title")}
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/40 transition-all duration-200"
          role="dialog"
        >
          <div
            className="mx-4 w-full max-w-sm animate-[fadeSlideUp_0.2s_ease-out] rounded-2xl bg-surface-container-lowest p-6 shadow-xl"
            ref={dialogRef}
          >
            <h4 className="font-extrabold font-headline text-base text-on-surface">
              {t("confirm_tab_switch_title")}
            </h4>
            <p className="mt-2 text-on-surface-variant text-sm">
              {t("confirm_tab_switch_desc")}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl px-4 py-2 font-semibold text-on-surface-variant text-sm transition-colors hover:bg-surface-container"
                onClick={handleKeepEditing}
                type="button"
              >
                {t("keep_editing")}
              </button>
              <button
                className="rounded-xl bg-primary px-4 py-2 font-bold text-on-primary text-sm transition-all active:opacity-80"
                onClick={handleDiscardAndSwitch}
                type="button"
              >
                {t("discard_changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

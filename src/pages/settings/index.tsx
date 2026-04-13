import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";

type SettingsTab = "ai" | "shop" | "notifications" | "users";

const TAB_ICONS: Record<SettingsTab, string> = {
  ai: "psychology",
  shop: "storefront",
  notifications: "notifications",
  users: "group",
};

const AI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o (Default)" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "o1-preview", label: "o1-preview" },
];

const MOCK_TEMPLATES = [
  {
    id: "1",
    name: "Job Status Update",
    channel: "WHATSAPP" as const,
    body: "Hello {{customer}}, your device {{device}} status is now: {{status}}. — {{shopName}}",
    isDefault: true,
  },
  {
    id: "2",
    name: "Job Ready",
    channel: "WHATSAPP" as const,
    body: "{{device}} is ready for pickup! Total: {{cost}} {{currency}}. — {{shopName}}",
    isDefault: false,
  },
  {
    id: "3",
    name: "Status SMS",
    channel: "SMS" as const,
    body: "{{shopName}}: {{device}} status → {{status}}. Track: {{trackingUrl}}",
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

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");
  const [dirty, setDirty] = useState(false);

  const [aiForm, setAiForm] = useState({
    endpointUrl: "",
    apiKey: "",
    model: "gpt-4o",
    temperature: 0.4,
  });

  const [shopForm, setShopForm] = useState({
    shopName: "",
    address: "",
    phone: "",
    currency: "DZD",
    receiptFooter: "",
  });

  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "fail"
  >("idle");

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "ai", label: t("ai_configuration") },
    { key: "shop", label: t("shop_information") },
    { key: "notifications", label: t("notifications_settings") },
    { key: "users", label: t("users_management") },
  ];

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

  function handleAiSubmit(e: FormEvent) {
    e.preventDefault();
    api.put("/settings/ai", aiForm);
    setDirty(false);
  }

  function handleShopSubmit(e: FormEvent) {
    e.preventDefault();
    api.put("/settings/shop", shopForm);
    setDirty(false);
  }

  function renderAiSection() {
    return (
      <form className="space-y-8" onSubmit={handleAiSubmit}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-2">
            <label
              className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="ai-endpoint"
            >
              {t("api_endpoint_url")}
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="ai-endpoint"
                onChange={(e) => {
                  setAiForm((f) => ({ ...f, endpointUrl: e.target.value }));
                  setDirty(true);
                }}
                placeholder="https://api.openai.com/v1"
                type="url"
                value={aiForm.endpointUrl}
              />
              <span className="material-symbols-outlined absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-primary/30">
                link
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="ai-key"
            >
              {t("master_api_key")}
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="ai-key"
                onChange={(e) => {
                  setAiForm((f) => ({ ...f, apiKey: e.target.value }));
                  setDirty(true);
                }}
                placeholder="sk-••••••••••••••••"
                type="password"
                value={aiForm.apiKey}
              />
              <span className="material-symbols-outlined absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-on-surface-variant">
                visibility_off
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
            htmlFor="ai-model"
          >
            {t("analytical_model")}
          </label>
          <select
            className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            id="ai-model"
            onChange={(e) => {
              setAiForm((f) => ({ ...f, model: e.target.value }));
              setDirty(true);
            }}
            value={aiForm.model}
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label
              className="font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="ai-temp"
            >
              {t("inference_temperature")}
            </label>
            <span className="font-bold font-mono text-primary text-sm">
              {aiForm.temperature.toFixed(1)}
            </span>
          </div>
          <input
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-outline-variant/30 accent-primary"
            id="ai-temp"
            max="1"
            min="0"
            onChange={(e) => {
              setAiForm((f) => ({
                ...f,
                temperature: Number.parseFloat(e.target.value),
              }));
              setDirty(true);
            }}
            step="0.1"
            type="range"
            value={aiForm.temperature}
          />
          <div className="flex justify-between font-bold text-[10px] text-on-surface-variant uppercase">
            <span>{t("precise")}</span>
            <span>{t("creative")}</span>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest/60 p-3">
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              <span className="font-bold text-primary italic">
                {t("note")}:
              </span>{" "}
              {t("temperature_note")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            className="flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-sm transition-all"
            disabled={testStatus === "loading"}
            onClick={handleTestConnection}
            style={{
              backgroundColor:
                testStatus === "success"
                  ? "oklch(0.72 0.19 155)"
                  : testStatus === "fail"
                    ? "oklch(0.55 0.2 25)"
                    : undefined,
              color: "#fff",
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              {testStatus === "loading"
                ? "progress_activity"
                : testStatus === "success"
                  ? "check_circle"
                  : testStatus === "fail"
                    ? "error"
                    : "network_check"}
            </span>
            {t("test_connection")}
          </button>
          <span className="text-[11px] text-on-surface-variant">
            {testStatus === "success"
              ? t("connection_success")
              : testStatus === "fail"
                ? t("connection_failed")
                : ""}
          </span>
        </div>

        <div className="mt-8 rounded-xl bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px] text-primary">
              database
            </span>
            <span className="font-bold text-primary text-xs uppercase">
              {t("training_context")}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant italic leading-relaxed">
            {t("training_context_desc")}
          </p>
        </div>
      </form>
    );
  }

  function renderShopSection() {
    return (
      <form className="space-y-8" onSubmit={handleShopSubmit}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-2">
            <label
              className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="shop-name"
            >
              {t("shop_name")}
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="shop-name"
              onChange={(e) => {
                setShopForm((f) => ({ ...f, shopName: e.target.value }));
                setDirty(true);
              }}
              placeholder="Reparilo"
              type="text"
              value={shopForm.shopName}
            />
          </div>
          <div className="space-y-2">
            <label
              className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="shop-phone"
            >
              {t("shop_phone")}
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="shop-phone"
              onChange={(e) => {
                setShopForm((f) => ({ ...f, phone: e.target.value }));
                setDirty(true);
              }}
              placeholder="+213 XX XXX XXXX"
              type="tel"
              value={shopForm.phone}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
            htmlFor="shop-address"
          >
            {t("shop_address")}
          </label>
          <textarea
            className="w-full resize-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            id="shop-address"
            onChange={(e) => {
              setShopForm((f) => ({ ...f, address: e.target.value }));
              setDirty(true);
            }}
            placeholder="123 Rue Didouche Mourad, Algiers"
            rows={3}
            value={shopForm.address}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-2">
            <label
              className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="shop-currency"
            >
              {t("currency")}
            </label>
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="shop-currency"
              onChange={(e) => {
                setShopForm((f) => ({ ...f, currency: e.target.value }));
                setDirty(true);
              }}
              value={shopForm.currency}
            >
              <option value="DZD">DZD — Algerian Dinar (DA)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label
              className="block font-bold text-[11px] text-on-surface-variant uppercase tracking-wider"
              htmlFor="shop-receipt"
            >
              {t("receipt_footer")}
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
              id="shop-receipt"
              onChange={(e) => {
                setShopForm((f) => ({ ...f, receiptFooter: e.target.value }));
                setDirty(true);
              }}
              placeholder="Thanks for choosing Reparilo!"
              type="text"
              value={shopForm.receiptFooter}
            />
          </div>
        </div>
      </form>
    );
  }

  function renderNotificationsSection() {
    const whatsappTemplates = MOCK_TEMPLATES.filter(
      (t) => t.channel === "WHATSAPP"
    );
    const smsTemplates = MOCK_TEMPLATES.filter((t) => t.channel === "SMS");

    function renderTemplateGroup(
      title: string,
      templates: typeof MOCK_TEMPLATES
    ) {
      return (
        <div className="space-y-4">
          <h4 className="font-bold font-headline text-on-surface text-sm">
            {title}
          </h4>
          {templates.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
                markdown
              </span>
              <p className="mt-3 text-on-surface-variant text-xs">
                {t("no_templates")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div
                  className="rounded-xl bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container-low/80"
                  key={tpl.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface text-sm">
                          {tpl.name}
                        </span>
                        {tpl.isDefault && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary uppercase">
                            {t("default_template")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 font-mono text-[12px] text-on-surface-variant leading-relaxed">
                        {tpl.body}
                      </p>
                    </div>
                    <button
                      className="shrink-0 p-2 text-on-surface-variant transition-colors hover:text-primary"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        edit
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-10">
        {renderTemplateGroup(t("whatsapp_templates"), whatsappTemplates)}
        <div className="h-px bg-outline-variant/15" />
        {renderTemplateGroup(t("sms_templates"), smsTemplates)}
      </div>
    );
  }

  function renderUsersSection() {
    const roleColors: Record<string, string> = {
      OWNER: "bg-primary/10 text-primary",
      TECHNICIAN: "bg-on-secondary-container/10 text-on-secondary-container",
      FRONT_DESK: "bg-tertiary/10 text-tertiary",
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <button
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-5 py-2.5 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all active:opacity-80"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              person_add
            </span>
            {t("add_user")}
          </button>
        </div>
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest">
          <table className="w-full">
            <thead>
              <tr className="border-outline-variant/10 border-b bg-surface-container-low">
                <th className="px-5 py-3 text-left font-bold text-[11px] text-on-surface-variant uppercase tracking-wider">
                  {t("username")}
                </th>
                <th className="px-5 py-3 text-left font-bold text-[11px] text-on-surface-variant uppercase tracking-wider">
                  {t("email")}
                </th>
                <th className="px-5 py-3 text-left font-bold text-[11px] text-on-surface-variant uppercase tracking-wider">
                  {t("user_role")}
                </th>
                <th className="px-5 py-3 text-left font-bold text-[11px] text-on-surface-variant uppercase tracking-wider">
                  {t("active")}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map((user) => (
                <tr
                  className="border-outline-variant/5 border-b transition-colors last:border-0 hover:bg-surface-container-low/60"
                  key={user.id}
                >
                  <td className="px-5 py-4 font-bold text-on-surface text-sm">
                    {user.username}
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant text-sm">
                    {user.email}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 font-bold text-[11px] uppercase ${roleColors[user.role] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {t(`role.${user.role}`)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${user.isActive ? "bg-primary" : "bg-on-surface-variant/30"}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

  const sectionRenderers: Record<SettingsTab, () => JSX.Element> = {
    ai: renderAiSection,
    shop: renderShopSection,
    notifications: renderNotificationsSection,
    users: renderUsersSection,
  };

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

      <div className="flex flex-col gap-8 lg:flex-row">
        <nav className="flex flex-row gap-1 lg:sticky lg:top-24 lg:w-56 lg:shrink-0 lg:flex-col lg:self-start">
          {tabs.map(({ key, label }) => (
            <button
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all ${
                activeTab === key
                  ? "bg-primary/8 font-bold text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
              key={key}
              onClick={() => setActiveTab(key)}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">
                {TAB_ICONS[key]}
              </span>
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <section className="rounded-2xl bg-surface-container-lowest/80 p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[22px] text-primary">
                  {TAB_ICONS[activeTab]}
                </span>
                <h3 className="font-extrabold font-headline text-lg text-on-surface">
                  {tabs.find((t) => t.key === activeTab)?.label}
                </h3>
              </div>
              <p className="mt-1 pl-9 text-on-surface-variant text-sm">
                {sectionDescriptions[activeTab]}
              </p>
            </div>

            <div className="mb-8 h-px bg-outline-variant/10" />

            {sectionRenderers[activeTab]()}
          </section>

          {dirty && (activeTab === "ai" || activeTab === "shop") && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-tertiary/8 px-5 py-3">
              <span className="font-medium text-on-surface-variant text-xs">
                {t("unsaved_changes")}
              </span>
              <div className="flex gap-3">
                <button
                  className="rounded-lg px-4 py-2 font-bold text-on-surface-variant text-xs transition-colors hover:bg-surface-container-low"
                  onClick={() => setDirty(false)}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-5 py-2.5 font-bold text-sm text-white shadow-lg shadow-primary/20 transition-all active:opacity-80"
                  form={activeTab === "ai" ? undefined : undefined}
                  onClick={() => {
                    const form = document.querySelector("form");
                    if (form) {
                      form.requestSubmit();
                    }
                  }}
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    save
                  </span>
                  {t("save_changes")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

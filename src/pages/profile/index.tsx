import type { FormEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

type ProfileTab = "personal" | "security" | "activity";

const TAB_ICONS: Record<ProfileTab, string> = {
  personal: "person",
  security: "lock",
  activity: "history",
};

const RE_UPPERCASE = /[A-Z]/;
const RE_DIGIT = /[0-9]/;
const RE_SPECIAL = /[^A-Za-z0-9]/;

const STRENGTH_COLORS = [
  "bg-error",
  "bg-tertiary",
  "bg-yellow-500",
  "bg-emerald-500",
];

const STRENGTH_LABELS = [
  "profile_strength_weak",
  "profile_strength_fair",
  "profile_strength_good",
  "profile_strength_strong",
];

const ACTIVITY_ICONS: Record<string, string> = {
  edit_square: "bg-secondary-container text-on-secondary-container",
  inventory_2: "bg-surface-container-high text-on-surface-variant",
  check_circle: "bg-emerald-50 text-emerald-600",
  person_add: "bg-primary/10 text-primary",
  settings: "bg-surface-container-high text-on-surface-variant",
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

const MOCK_ACTIVITY = [
  {
    id: "1",
    icon: "edit_square",
    textKey: "profile_activity_status_update",
    interpolations: { id: "2025-0042", status: "IN_REPAIR" },
    time: "2h ago",
  },
  {
    id: "2",
    icon: "inventory_2",
    textKey: "profile_activity_part_ordered",
    interpolations: { part: "Gasket Set (V6-Turbo)" },
    time: "Yesterday, 14:22",
  },
  {
    id: "3",
    icon: "check_circle",
    textKey: "profile_activity_marked_done",
    interpolations: { id: "2025-0039" },
    time: "Yesterday, 11:05",
  },
  {
    id: "4",
    icon: "person_add",
    textKey: "profile_activity_user_added",
    interpolations: { name: "Amina K." },
    time: "2 days ago",
  },
  {
    id: "5",
    icon: "settings",
    textKey: "profile_activity_settings_update",
    interpolations: {},
    time: "3 days ago",
  },
];

const INPUT_CLS =
  "w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20";

const LABEL_CLS =
  "block font-bold text-xs text-on-surface-variant uppercase tracking-wider";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function passwordStrength(pw: string): number {
  if (!pw) {
    return 0;
  }
  let score = 0;
  if (pw.length >= 8) {
    score++;
  }
  if (RE_UPPERCASE.test(pw)) {
    score++;
  }
  if (RE_DIGIT.test(pw)) {
    score++;
  }
  if (RE_SPECIAL.test(pw)) {
    score++;
  }
  return score;
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const username = useAuthStore((s) => s.user?.username);

  const displayName = username || "Reparilo User";
  const initials = getInitials(displayName);

  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");
  const [personalDirty, setPersonalDirty] = useState(false);
  const [securityDirty, setSecurityDirty] = useState(false);

  function detectLanguage(): string {
    if (i18n.language.startsWith("ar")) {
      return "ar";
    }
    if (i18n.language.startsWith("fr")) {
      return "fr";
    }
    return "en";
  }

  const [personalForm, setPersonalForm] = useState({
    username: username || "",
    email: "",
    phone: "",
    language: detectLanguage(),
  });

  const [personalInitial, setPersonalInitial] = useState(personalForm);

  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [personalError, setPersonalError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const personalFormRef = useRef<HTMLFormElement>(null);
  const securityFormRef = useRef<HTMLFormElement>(null);

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "personal", label: t("profile_tab_personal") },
    { key: "security", label: t("profile_tab_security") },
    { key: "activity", label: t("profile_tab_activity") },
  ];

  async function handlePersonalSubmit(e: FormEvent) {
    e.preventDefault();
    setPersonalError("");
    try {
      await api.put("/users/me", personalForm);
      setPersonalInitial(personalForm);
      setPersonalDirty(false);
    } catch {
      setPersonalError(t("profile_update_failed"));
    }
  }

  async function handleSecuritySubmit(e: FormEvent) {
    e.preventDefault();

    if (!securityForm.newPassword.trim()) {
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setPasswordError(t("profile_password_mismatch"));
      return;
    }

    if (securityForm.newPassword && !securityForm.currentPassword) {
      setPasswordError(t("profile_current_password_required"));
      return;
    }

    setPasswordError("");
    try {
      await api.put("/users/me/password", {
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword,
      });
      setSecurityForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setSecurityDirty(false);
    } catch {
      setPasswordError(t("profile_password_update_failed"));
    }
  }

  function handleCancelPersonal() {
    setPersonalForm(personalInitial);
    setPersonalDirty(false);
  }

  function handleCancelSecurity() {
    setSecurityForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError("");
    setSecurityDirty(false);
  }

  const isDirty = personalDirty || securityDirty;

  function renderPersonalSection() {
    return (
      <form
        className="space-y-8"
        onSubmit={handlePersonalSubmit}
        ref={personalFormRef}
      >
        {personalError && (
          <div className="rounded-xl bg-error-container p-4">
            <p className="font-bold text-on-error-container text-xs">
              {personalError}
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="profile-username">
              {t("username")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-username"
              onChange={(e) => {
                setPersonalForm((f) => ({ ...f, username: e.target.value }));
                setPersonalDirty(true);
              }}
              type="text"
              value={personalForm.username}
            />
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="profile-email">
              {t("email")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-email"
              onChange={(e) => {
                setPersonalForm((f) => ({ ...f, email: e.target.value }));
                setPersonalDirty(true);
              }}
              type="email"
              value={personalForm.email}
            />
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="profile-phone">
              {t("profile_phone")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-phone"
              onChange={(e) => {
                setPersonalForm((f) => ({ ...f, phone: e.target.value }));
                setPersonalDirty(true);
              }}
              placeholder="+213 XX XXX XXXX"
              type="tel"
              value={personalForm.phone}
            />
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="profile-language">
              {t("profile_language")}
            </label>
            <div className="relative">
              <select
                className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="profile-language"
                onChange={(e) => {
                  setPersonalForm((f) => ({ ...f, language: e.target.value }));
                  setPersonalDirty(true);
                }}
                value={personalForm.language}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute end-4 top-3.5 text-[18px] text-on-surface-variant/40">
                expand_more
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-low p-5">
          <div>
            <h4 className="font-bold font-headline text-on-surface text-sm">
              {t("profile_data_localization")}
            </h4>
            <p className="text-on-surface-variant text-xs">
              {t("profile_data_localization_desc")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <span className="font-semibold text-sm">
              {t("profile_gdpr_compliant")}
            </span>
          </div>
        </div>
      </form>
    );
  }

  function renderSecuritySection() {
    const strength = passwordStrength(securityForm.newPassword);

    return (
      <form
        className="space-y-8"
        onSubmit={handleSecuritySubmit}
        ref={securityFormRef}
      >
        <h4 className="font-bold font-headline text-on-surface text-sm">
          {t("profile_change_password")}
        </h4>

        {passwordError && (
          <div className="rounded-xl bg-error-container p-4">
            <p className="font-bold text-on-error-container text-xs">
              {passwordError}
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="current-password">
              {t("profile_current_password")}
            </label>
            <div className="relative">
              <input
                autoComplete="current-password"
                className={INPUT_CLS}
                id="current-password"
                onChange={(e) => {
                  setSecurityForm((f) => ({
                    ...f,
                    currentPassword: e.target.value,
                  }));
                  setSecurityDirty(true);
                }}
                placeholder="••••••••"
                type={showCurrentPassword ? "text" : "password"}
                value={securityForm.currentPassword}
              />
              <button
                className="absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showCurrentPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="new-password">
              {t("profile_new_password")}
            </label>
            <div className="relative">
              <input
                autoComplete="new-password"
                className={INPUT_CLS}
                id="new-password"
                onChange={(e) => {
                  setSecurityForm((f) => ({
                    ...f,
                    newPassword: e.target.value,
                  }));
                  setSecurityDirty(true);
                }}
                placeholder="••••••••"
                type={showNewPassword ? "text" : "password"}
                value={securityForm.newPassword}
              />
              <button
                className="absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                onClick={() => setShowNewPassword(!showNewPassword)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showNewPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
            {securityForm.newPassword && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-all ${i < strength ? (STRENGTH_COLORS[strength - 1] ?? "") : "bg-surface-container-high"}`}
                      key={i}
                    />
                  ))}
                </div>
                <p className="font-bold text-on-surface-variant text-xs uppercase">
                  {t(STRENGTH_LABELS[strength - 1] ?? "profile_strength_weak")}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLS} htmlFor="confirm-password">
              {t("profile_confirm_password")}
            </label>
            <input
              autoComplete="new-password"
              className={INPUT_CLS}
              id="confirm-password"
              onChange={(e) => {
                setSecurityForm((f) => ({
                  ...f,
                  confirmPassword: e.target.value,
                }));
                setSecurityDirty(true);
              }}
              placeholder="••••••••"
              type="password"
              value={securityForm.confirmPassword}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-surface-tint px-6 py-2.5 font-bold text-on-primary text-sm shadow-lg shadow-primary/20 transition-all active:opacity-80"
            type="submit"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            {t("profile_update_password")}
          </button>
        </div>

        <div className="h-px bg-outline-variant/10" />

        <div className="space-y-4">
          <h4 className="font-bold font-headline text-on-surface text-sm">
            {t("profile_active_sessions")}
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                  laptop_mac
                </span>
                <div>
                  <p className="font-semibold text-sm">
                    Chrome on macOS — {t("profile_current_session")}
                  </p>
                  <p className="text-on-surface-variant text-xs">
                    Algiers, DZ — 192.168.1.42
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-600 text-xs uppercase">
                  {t("profile_active")}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                  monitor
                </span>
                <div>
                  <p className="font-semibold text-sm">Firefox on Windows</p>
                  <p className="text-on-surface-variant text-xs">
                    Oran, DZ — 10.0.0.15 — 3 days ago
                  </p>
                </div>
              </div>
              <button
                className="font-bold text-tertiary text-xs transition-colors hover:text-tertiary-container"
                type="button"
              >
                {t("profile_revoke")}
              </button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  function renderActivitySection() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="font-bold font-headline text-on-surface">
            {t("profile_recent_activity")}
          </h4>
          <button className="font-bold text-primary text-xs" type="button">
            {t("profile_view_full_history")}
          </button>
        </div>

        <div className="space-y-6">
          {MOCK_ACTIVITY.map((item, idx) => (
            <div className="flex gap-4" key={item.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${ACTIVITY_ICONS[item.icon] ?? "bg-surface-container-high text-on-surface-variant"}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {item.icon}
                  </span>
                </div>
                {idx < MOCK_ACTIVITY.length - 1 && (
                  <div className="my-1 h-full w-0.5 bg-surface-container-high" />
                )}
              </div>
              <div className="pb-2">
                <p className="font-semibold text-sm">
                  {t(item.textKey, item.interpolations)}
                </p>
                <p className="mt-1 font-bold text-on-surface-variant/50 text-xs uppercase">
                  {item.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sectionRenderers: Record<ProfileTab, () => ReactNode> = {
    personal: renderPersonalSection,
    security: renderSecuritySection,
    activity: renderActivitySection,
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
          {t("profile_title")}
        </h2>
        <p className="mt-1 text-on-surface-variant text-sm md:text-base">
          {t("profile_subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <section className="flex w-full flex-col items-center rounded-xl bg-surface-container-lowest/95 p-8 text-center shadow-[0_40px_80px_-20px_rgba(0,64,161,0.06)] lg:w-[320px] lg:shrink-0">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-low font-bold font-headline text-3xl text-primary">
              {initials}
            </div>
            <div className="absolute end-0 bottom-1 h-4 w-4 rounded-full border-4 border-surface-container-lowest bg-emerald-500" />
          </div>

          <h3 className="mt-4 font-bold font-headline text-on-surface text-xl">
            {displayName}
          </h3>
          <div className="mt-2 rounded-full bg-primary/10 px-3 py-1 font-bold text-primary text-xs tracking-wide">
            {t(`role.${role}`)}
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-4 border-surface-container-high border-t pt-6">
            <div className="text-start">
              <p className="font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                {t("profile_completed")}
              </p>
              <p className="font-extrabold font-headline text-2xl text-primary">
                127
              </p>
              <p className="text-on-secondary-container text-xs">
                {t("profile_total_jobs")}
              </p>
            </div>
            <div className="text-start">
              <p className="font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                {t("profile_monthly")}
              </p>
              <p className="font-extrabold font-headline text-2xl text-primary">
                43
              </p>
              <p className="text-on-secondary-container text-xs">
                {t("profile_repairs")}
              </p>
            </div>
          </div>

          <button
            className="mt-6 flex items-center gap-2 font-semibold text-primary text-sm transition-colors hover:underline"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">
              photo_camera
            </span>
            {t("profile_change_avatar")}
          </button>
        </section>

        <section className="min-w-0 flex-1 space-y-6">
          <div className="flex gap-2" role="tablist">
            {tabs.map(({ key, label }) => (
              <button
                aria-selected={activeTab === key}
                className={`rounded-xl px-6 py-2.5 font-medium text-sm transition-all ${
                  activeTab === key
                    ? "bg-primary/10 font-bold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
                key={key}
                onClick={() => setActiveTab(key)}
                role="tab"
                type="button"
              >
                <span className="material-symbols-outlined me-1.5 align-middle text-[18px]">
                  {TAB_ICONS[key]}
                </span>
                <span className="align-middle">{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-surface-container-lowest/95 p-6 shadow-[0_40px_80px_-20px_rgba(0,64,161,0.06)] md:p-8">
            {sectionRenderers[activeTab]()}
          </div>

          {isDirty && (
            <div className="flex items-center justify-between rounded-xl bg-surface-container-highest/95 px-5 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  info
                </span>
                <span className="font-medium text-on-surface-variant text-sm">
                  {t("profile_unsaved_changes")}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  className="rounded-xl px-4 py-2 font-bold text-on-surface-variant text-xs transition-colors hover:bg-surface-container-high"
                  onClick={() => {
                    if (personalDirty) {
                      handleCancelPersonal();
                    }
                    if (securityDirty) {
                      handleCancelSecurity();
                    }
                  }}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-surface-tint px-5 py-2.5 font-bold text-on-primary text-sm shadow-lg shadow-primary/20 transition-all active:opacity-80"
                  onClick={() => {
                    if (personalDirty) {
                      personalFormRef.current?.requestSubmit();
                    }
                    if (securityDirty) {
                      securityFormRef.current?.requestSubmit();
                    }
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    save
                  </span>
                  {t("save_changes")}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

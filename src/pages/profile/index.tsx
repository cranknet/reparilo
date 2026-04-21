import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import SessionsModal from "@/components/modules/profile/sessions-modal";
import ResetPasswordModal from "@/components/modules/settings/reset-password-modal";
import { Avatar } from "@/components/ui/avatar";
import { useProfileMultiUser } from "@/hooks/use-profile-multi-user";
import api from "@/lib/api";
import { getAvatarSrc, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useUsersStore } from "@/stores/users";

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
  "bg-success",
];

const STRENGTH_LABELS = [
  "profile_strength_weak",
  "profile_strength_fair",
  "profile_strength_good",
  "profile_strength_strong",
];

const ACTION_ICONS: Record<string, string> = {
  JOB_CREATED: "add_circle",
  STATUS_CHANGED: "edit_square",
  TECHNICIAN_ASSIGNED: "person_add",
  COST_UPDATED: "payments",
  PART_ADDED: "inventory_2",
  PART_REMOVED: "remove_circle",
  REPAIR_ADDED: "build",
  REPAIR_REMOVED: "remove_circle",
  NOTE_ADDED: "note_add",
  PHOTO_ADDED: "photo_camera",
  PHOTO_REMOVED: "remove_circle",
  JOB_UPDATED: "edit_square",
  WARRANTY_RETURN_CREATED: "replay",
  NOTIFICATION_SENT: "notifications",
  USER_SIGN_IN: "login",
  USER_SIGN_OUT: "logout",
  USER_CREATED: "person_add",
  PASSWORD_RESET: "lock_reset",
  API_MUTATION: "api",
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

const INPUT_CLS =
  "w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20";

const LABEL_CLS =
  "block font-bold text-xs text-on-surface-variant uppercase tracking-wider";

interface ActivityItem {
  action: string;
  createdAt: string;
  fromValue: string | null;
  id: string;
  metadata?: { jobId?: string } | null;
  toValue: string | null;
}

interface SessionItem {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  userAgent: string | null;
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

function formatAction(action: string): string {
  return `profile_activity_${action.toLowerCase()}`;
}

function formatTimeAgo(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) {
    return t("profile_just_now");
  }
  if (diffMins < 60) {
    return t("profile_minutes_ago", { count: diffMins });
  }
  if (diffHours < 24) {
    return t("profile_hours_ago", { count: diffHours });
  }
  if (diffDays < 7) {
    return t("profile_days_ago", { count: diffDays });
  }
  return date.toLocaleDateString();
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const _user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const {
    avatarUploading,
    displayUser,
    fileInputRef,
    handleAvatarRemove,
    handleAvatarUpload,
    isSelf,
    userId,
  } = useProfileMultiUser(role);

  const displayName = displayUser.name || t("default_user_display");
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

  const prevUserIdRef = useRef<string>("");

  const personalFormDefault = {
    name: displayUser.name || displayUser.username || "",
    email: displayUser.email || "",
    language: detectLanguage(),
    username: displayUser.username || "",
  };

  const [personalForm, setPersonalForm] = useState(personalFormDefault);
  const [personalInitial, setPersonalInitial] = useState(personalFormDefault);

  useEffect(() => {
    if (displayUser.id && displayUser.id !== prevUserIdRef.current) {
      prevUserIdRef.current = displayUser.id;
    }
    if (displayUser.id && !personalDirty) {
      setPersonalForm(personalFormDefault);
      setPersonalInitial(personalFormDefault);
    }
  }, [displayUser.id, personalFormDefault, personalDirty]);

  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [personalError, setPersonalError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [hasMoreActivity, setHasMoreActivity] = useState(false);
  const [stats, setStats] = useState({ completedJobs: 0, monthlyJobs: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  const personalFormRef = useRef<HTMLFormElement>(null);
  const securityFormRef = useRef<HTMLFormElement>(null);

  const loadActivity = useCallback(
    async (append = false) => {
      if (!userId) {
        return;
      }
      setActivityLoading(true);
      try {
        const params: Record<string, string> = {};
        if (append && activityCursor) {
          params.cursor = activityCursor;
        }
        const res = await api.get(`/users/${userId}/activity`, { params });
        const data = res.data;
        const items: ActivityItem[] = data.items ?? data;
        if (append) {
          setActivity((prev) => [...prev, ...items]);
        } else {
          setActivity(items);
        }
        setActivityCursor(data.nextCursor ?? null);
        setHasMoreActivity(!!data.nextCursor);
      } catch {
        if (!append) {
          setActivity([]);
        }
      } finally {
        setActivityLoading(false);
      }
    },
    [userId, activityCursor]
  );

  const loadStats = useCallback(async () => {
    if (!userId) {
      return;
    }
    setStatsLoading(true);
    try {
      const res = await api.get(`/users/${userId}/stats`);
      setStats(res.data);
    } catch {
      setStats({ completedJobs: 0, monthlyJobs: 0 });
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);

  const loadSessions = useCallback(async () => {
    if (!userId) {
      return;
    }
    setSessionsLoading(true);
    try {
      const res = await api.get(`/users/${userId}/sessions`);
      setSessions(res.data);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [userId]);

  async function handleRevokeSession(sessionId: string) {
    if (!userId) {
      return;
    }
    try {
      await api.delete(`/users/${userId}/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // error already handled by axios interceptor
    }
  }

  const loadActivityRef = useRef(loadActivity);
  loadActivityRef.current = loadActivity;

  useEffect(() => {
    if (activeTab === "activity") {
      setActivityCursor(null);
      setHasMoreActivity(false);
      setActivity([]);
      loadActivityRef.current();
    }
  }, [activeTab]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === "security") {
      loadSessions();
    }
  }, [activeTab, loadSessions]);

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "personal", label: t("profile_tab_personal") },
    { key: "security", label: t("profile_tab_security") },
    { key: "activity", label: t("profile_tab_activity") },
  ];

  async function handlePersonalSubmit(e: FormEvent) {
    e.preventDefault();
    setPersonalError("");
    if (!userId) {
      return;
    }
    try {
      await api.patch(`/users/${userId}`, {
        name: personalForm.name,
        email: personalForm.email,
        username: personalForm.username,
      });
      if (isSelf) {
        const { updateUser } = useAuthStore.getState();
        updateUser({
          name: personalForm.name,
          email: personalForm.email,
          username: personalForm.username,
        });
      }
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
      await api.post("/auth/change-password", {
        oldPassword: securityForm.currentPassword,
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
            <label className={LABEL_CLS} htmlFor="profile-name">
              {t("profile_name")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-name"
              onChange={(e) => {
                setPersonalForm((f) => ({ ...f, name: e.target.value }));
                setPersonalDirty(true);
              }}
              type="text"
              value={personalForm.name}
            />
          </div>

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
            <label className={LABEL_CLS} htmlFor="profile-language">
              {t("profile_language")}
            </label>
            <div className="relative">
              <select
                className="w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="profile-language"
                onChange={(e) => {
                  i18n.changeLanguage(e.target.value);
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
      </form>
    );
  }

  function renderSessionButton() {
    return (
      <div className="space-y-4">
        <h4 className="font-bold font-headline text-on-surface text-sm">
          {t("profile_active_sessions")}
        </h4>
        <button
          className="flex w-full items-center justify-between rounded-xl bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container-low"
          onClick={() => {
            loadSessions();
            setShowSessionsModal(true);
          }}
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
              devices
            </span>
            <span className="font-medium text-sm">
              {sessionsLoading
                ? t("loading")
                : t("profile_sessions_count", { count: sessions.length })}
            </span>
          </div>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            chevron_right
          </span>
        </button>
      </div>
    );
  }

  function renderPasswordForm() {
    const strength = passwordStrength(securityForm.newPassword);

    return (
      <>
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
      </>
    );
  }

  function renderSecuritySection() {
    if (!isSelf) {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h4 className="font-bold font-headline text-on-surface text-sm">
              {t("profile_change_password")}
            </h4>
            <button
              className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-surface-tint px-5 py-2.5 font-bold text-on-primary text-sm shadow-lg shadow-primary/20 transition-all active:opacity-80"
              onClick={() => setShowResetModal(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                lock_reset
              </span>
              {t("reset_password_title")}
            </button>
          </div>

          <div className="h-px bg-outline-variant/10" />

          {renderSessionButton()}
        </div>
      );
    }

    return (
      <form
        className="space-y-8"
        onSubmit={handleSecuritySubmit}
        ref={securityFormRef}
      >
        {renderPasswordForm()}

        <div className="h-px bg-outline-variant/10" />

        {renderSessionButton()}
      </form>
    );
  }

  function renderActivitySection() {
    if (activityLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-[24px] text-on-surface-variant">
            progress_activity
          </span>
        </div>
      );
    }

    if (activity.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="material-symbols-outlined mb-3 text-[48px] text-on-surface-variant/40">
            timeline
          </span>
          <p className="font-semibold text-on-surface-variant text-sm">
            {t("profile_no_activity")}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h4 className="font-bold font-headline text-on-surface">
          {t("profile_recent_activity")}
        </h4>

        <div className="space-y-6">
          {activity.map((item, idx) => (
            <div className="flex gap-4" key={item.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${ACTION_ICONS[item.action] ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {ACTION_ICONS[item.action] ?? "history"}
                  </span>
                </div>
                {idx < activity.length - 1 && (
                  <div className="my-1 h-full w-0.5 bg-surface-container-high" />
                )}
              </div>
              <div className="pb-2">
                <p className="font-semibold text-sm">
                  {t(formatAction(item.action), {
                    from: item.fromValue ?? "",
                    to: item.toValue ?? "",
                  })}
                </p>
                <p className="mt-1 font-bold text-on-surface-variant/50 text-xs uppercase">
                  {formatTimeAgo(item.createdAt, t)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {hasMoreActivity && (
          <div className="flex justify-center pt-4">
            <button
              className="flex items-center gap-2 rounded-xl bg-surface-container-low px-5 py-2.5 font-bold text-primary text-sm transition-all hover:bg-surface-container-high active:opacity-80"
              disabled={activityLoading}
              onClick={() => loadActivity(true)}
              type="button"
            >
              {activityLoading ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">
                  expand_more
                </span>
              )}
              {t("load_more")}
            </button>
          </div>
        )}
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
      {!isSelf && (
        <button
          className="mb-4 flex items-center gap-1 font-semibold text-primary text-sm transition-colors hover:underline"
          onClick={() => navigate("/settings")}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          {t("profile_back_to_users")}
        </button>
      )}

      <div className="mb-8">
        <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
          {isSelf
            ? t("profile_title")
            : t("profile_viewing_user", { name: displayName })}
        </h2>
        <p className="mt-1 text-on-surface-variant text-sm md:text-base">
          {t("profile_subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <section className="flex w-full flex-col items-center rounded-xl bg-surface-container-lowest/95 p-8 text-center shadow-[0_40px_80px_-20px_rgba(0,64,161,0.06)] lg:w-[320px] lg:shrink-0">
          <div className="relative">
            <Avatar
              alt={displayName}
              className="h-24 w-24 text-3xl"
              initials={initials}
              size="md"
              src={getAvatarSrc(displayUser.image)}
            />
            {isSelf && (
              <button
                className="absolute end-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-md transition-all hover:bg-primary/90 active:scale-95"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  photo_camera
                </span>
              </button>
            )}
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-on-surface/30">
                <span className="material-symbols-outlined animate-spin text-[24px] text-on-primary">
                  progress_activity
                </span>
              </div>
            )}
            <div className="absolute end-0 bottom-1 h-4 w-4 rounded-full border-4 border-surface-container-lowest bg-success" />
            <input
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleAvatarUpload(file, (msg) => setPersonalError(t(msg)));
                }
                e.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>

          <h3 className="mt-4 font-bold font-headline text-on-surface text-xl">
            {displayName}
          </h3>
          <div className="mt-2 rounded-full bg-primary/10 px-3 py-1 font-bold text-primary text-xs tracking-wide">
            {t(`role.${displayUser.role}`)}
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-4 border-surface-container-high border-t pt-6">
            <div className="text-start">
              <p className="font-bold text-on-surface-variant text-xs uppercase tracking-wider">
                {t("profile_completed")}
              </p>
              <p className="font-extrabold font-headline text-2xl text-primary">
                {statsLoading ? "—" : stats.completedJobs}
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
                {statsLoading ? "—" : stats.monthlyJobs}
              </p>
              <p className="text-on-secondary-container text-xs">
                {t("profile_repairs")}
              </p>
            </div>
          </div>

          {isSelf && (
            <div className="mt-6 flex items-center gap-3">
              <button
                className="flex items-center gap-2 font-semibold text-primary text-sm transition-colors hover:underline"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">
                  photo_camera
                </span>
                {t("profile_change_avatar")}
              </button>
              {displayUser.image && (
                <button
                  className="flex items-center gap-2 font-semibold text-sm text-tertiary transition-colors hover:underline"
                  onClick={handleAvatarRemove}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">
                    delete
                  </span>
                  {t("remove")}
                </button>
              )}
            </div>
          )}
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

      {showResetModal && !isSelf && userId && (
        <ResetPasswordModal
          onClose={() => setShowResetModal(false)}
          onSubmit={async (password) => {
            await useUsersStore.getState().resetUserPassword(userId, password);
            setShowResetModal(false);
          }}
          username={displayUser.username}
        />
      )}

      {showSessionsModal && (
        <SessionsModal
          loading={sessionsLoading}
          onClose={() => setShowSessionsModal(false)}
          onRevoke={handleRevokeSession}
          sessions={sessions}
        />
      )}
    </>
  );
}

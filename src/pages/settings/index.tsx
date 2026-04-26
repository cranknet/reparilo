import type { RoleType } from "@shared/constants";
import type { NotificationTemplate } from "@shared/types";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import AddUserModal from "@/components/modules/settings/add-user-modal";
import ResetPasswordModal from "@/components/modules/settings/reset-password-modal";
import type { SettingsAiTabHandle } from "@/components/modules/settings/settings-ai-tab";
import SettingsAiTab from "@/components/modules/settings/settings-ai-tab";
import SettingsNotificationsTab from "@/components/modules/settings/settings-notifications-tab";
import type { SettingsShopTabHandle } from "@/components/modules/settings/settings-shop-tab";
import SettingsShopTab from "@/components/modules/settings/settings-shop-tab";
import SettingsUsersTab from "@/components/modules/settings/settings-users-tab";
import TemplateEditor from "@/components/modules/settings/template-editor";
import { useSettingsStore } from "@/stores/settings";
import { useUsersStore } from "@/stores/users";

type SettingsTab = "ai" | "shop" | "notifications" | "users";

const TAB_KEYS: SettingsTab[] = ["ai", "shop", "notifications", "users"];

const TAB_ICONS: Record<SettingsTab, string> = {
  ai: "psychology",
  shop: "storefront",
  notifications: "notifications",
  users: "group",
};

type ToastType = "success" | "error" | null;

export default function SettingsPage() {
  const { t } = useTranslation();
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");
  const [dirtyTabs, setDirtyTabs] = useState<Set<SettingsTab>>(new Set());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const tabPanelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({
    ai: null,
    shop: null,
    notifications: null,
    users: null,
  });
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<NotificationTemplate | null>(null);

  const aiTabRef = useRef<SettingsAiTabHandle>(null);
  const shopTabRef = useRef<SettingsShopTabHandle>(null);

  const { notificationTemplates, fetchNotificationTemplates } =
    useSettingsStore();
  const navigate = useNavigate();

  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    if (activeTab === "notifications" && notificationTemplates.length === 0) {
      fetchNotificationTemplates().catch(() => {
        // Error is stored in the Zustand state via fetchNotificationTemplates
      });
    }
  }, [activeTab, notificationTemplates.length, fetchNotificationTemplates]);

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

  useEffect(
    () => () => {
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
    },
    [toastTimer]
  );

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

  function markTabDirty(tab: SettingsTab, isDirty = true) {
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      if (isDirty) {
        next.add(tab);
      } else {
        next.delete(tab);
      }
      return next;
    });
  }

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
      aiTabRef.current?.reset();
    } else if (activeTab === "shop") {
      shopTabRef.current?.reset();
    }
    markTabDirty(activeTab, false);
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

  function handleCancel() {
    if (activeTab === "ai") {
      aiTabRef.current?.reset();
    } else if (activeTab === "shop") {
      shopTabRef.current?.reset();
    }
    markTabDirty(activeTab, false);
  }

  async function handleCreateUser(data: {
    username: string;
    email: string;
    password: string;
    role: RoleType;
  }) {
    await useUsersStore.getState().createUser(data);
    setShowAddUserModal(false);
  }

  async function handleResetPassword(password: string) {
    if (!resetTarget) {
      return;
    }
    await useUsersStore.getState().resetUserPassword(resetTarget.id, password);
    setShowResetModal(false);
    setResetTarget(null);
  }

  const sectionDescriptions: Record<SettingsTab, string> = {
    ai: t("ai_configuration_desc"),
    shop: t("shop_information_desc"),
    notifications: t("notifications_settings_desc"),
    users: t("users_management_desc"),
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
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 text-center transition-all lg:flex-row lg:gap-2.5 lg:px-4 lg:py-3 lg:text-start ${
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
            {activeTab === "ai" && (
              <SettingsAiTab
                onDirtyChange={(d) => markTabDirty("ai", d)}
                onSavingChange={setSaving}
                onToast={(msg, type) => showToast(msg, type)}
                ref={aiTabRef}
              />
            )}
            {activeTab === "shop" && (
              <SettingsShopTab
                onDirtyChange={(d) => markTabDirty("shop", d)}
                onSavingChange={setSaving}
                onToast={(msg, type) => showToast(msg, type)}
                ref={shopTabRef}
              />
            )}
            {activeTab === "notifications" && (
              <SettingsNotificationsTab
                onEditTemplate={(tpl) => setEditingTemplate(tpl)}
              />
            )}
            {activeTab === "users" && (
              <SettingsUsersTab
                onAddUser={() => setShowAddUserModal(true)}
                onEditUser={(id) => navigate(`/profile/${id}`)}
                onResetPassword={(id, username) => {
                  setResetTarget({ id, username });
                  setShowResetModal(true);
                }}
              />
            )}
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
                    if (activeTab === "ai") {
                      aiTabRef.current?.requestSubmit();
                    } else if (activeTab === "shop") {
                      shopTabRef.current?.requestSubmit();
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

      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSubmit={handleCreateUser}
        />
      )}
      {showResetModal && resetTarget && (
        <ResetPasswordModal
          onClose={() => {
            setShowResetModal(false);
            setResetTarget(null);
          }}
          onSubmit={handleResetPassword}
          username={resetTarget.username}
        />
      )}
      <TemplateEditor
        onClose={() => setEditingTemplate(null)}
        onSaved={() => fetchNotificationTemplates()}
        open={editingTemplate !== null}
        template={editingTemplate}
      />
    </>
  );
}

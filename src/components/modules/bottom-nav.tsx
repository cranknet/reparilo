import type { PermissionCheck } from "@shared/permissions";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { can, useCan } from "@/hooks/use-can";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

interface NavItem {
  icon: string;
  labelKey: string;
  perm: PermissionCheck;
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: "dashboard",
    labelKey: "dashboard",
    perm: { jobs: ["view"] },
    to: "/",
  },
  {
    icon: "build",
    labelKey: "jobs",
    perm: { jobs: ["view"] },
    to: "/jobs",
  },
  {
    icon: "settings",
    labelKey: "settings",
    perm: { settings: ["view"] },
    to: "/settings",
  },
];

const MORE_ITEMS: NavItem[] = [
  {
    icon: "menu_book",
    labelKey: "repairs",
    perm: { repairs: ["viewCatalog"] },
    to: "/repairs",
  },
  {
    icon: "inventory_2",
    labelKey: "parts_inventory",
    perm: { parts: ["viewCatalog"] },
    to: "/parts",
  },
  {
    icon: "notifications",
    labelKey: "notifications",
    perm: { notifications: ["read"] },
    to: "/notifications",
  },
  {
    icon: "person",
    labelKey: "profile",
    perm: { jobs: ["view"] },
    to: "/profile",
  },
];

const ACTIVE_FONT_SETTINGS = '"FILL" 1, "wght" 700, "GRAD" 0, "opsz" 24';

function NavTab({
  icon,
  labelKey,
  to,
}: {
  icon: string;
  labelKey: string;
  to: string;
}) {
  const { t } = useTranslation();
  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-h-[44px] min-w-0 flex-1 flex-col items-center rounded-xl px-1 py-1.5 transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-on-surface-variant active:bg-surface-container-high active:text-primary"
        }`
      }
      to={to}
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`material-symbols-outlined text-[22px] ${isActive ? "text-primary" : ""}`}
            style={
              isActive
                ? { fontVariationSettings: ACTIVE_FONT_SETTINGS }
                : undefined
            }
          >
            {icon}
          </span>
          <span
            className={`mt-0.5 text-[12px] leading-tight ${isActive ? "font-bold text-primary" : "text-on-surface-variant"}`}
          >
            {t(labelKey)}
          </span>
        </>
      )}
    </NavLink>
  );
}

function FabButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      aria-label={t("new_checkin")}
      className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-end px-1 pb-0.5"
      onClick={onClick}
      type="button"
    >
      <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-surface-tint shadow-lg transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 motion-reduce:active:scale-100">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[26px] text-on-primary"
          style={{ fontVariationSettings: ACTIVE_FONT_SETTINGS }}
        >
          add_circle
        </span>
      </span>
      <span className="mt-0.5 font-semibold text-[12px] text-primary leading-tight">
        {t("new_checkin")}
      </span>
    </button>
  );
}

export default function BottomNav() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const canCreateJob = useCan({ jobs: ["create"] });
  const openIntakeModal = useUiStore((s) => s.openIntakeModal);
  const moreSheetOpen = useUiStore((s) => s.moreSheetOpen);
  const openMoreSheet = useUiStore((s) => s.openMoreSheet);
  const closeMoreSheet = useUiStore((s) => s.closeMoreSheet);
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.perm && can(role, item.perm)
  );
  const visibleMoreItems = MORE_ITEMS.filter(
    (item) => item.perm && can(role, item.perm)
  );
  const hasMore = visibleMoreItems.length > 0;
  const isMoreActive = visibleMoreItems.some(
    (item) => item.to === location.pathname
  );

  // Split nav items around the center FAB: left group | FAB | right group
  const half = Math.ceil((visibleItems.length + (hasMore ? 1 : 0)) / 2);
  const leftItems = visibleItems.slice(0, half);
  const rightItems = visibleItems.slice(half);

  useEffect(() => {
    if (!moreSheetOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMoreSheet();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [moreSheetOpen, closeMoreSheet]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: closeMoreSheet is a stable zustand action; we intentionally react to pathname changes
  useEffect(() => {
    closeMoreSheet();
  }, [location.pathname]);

  if (!role) {
    return null;
  }

  const moreButton = hasMore ? (
    <button
      aria-expanded={moreSheetOpen}
      aria-label={t("more")}
      className={`flex min-h-[44px] min-w-0 flex-1 flex-col items-center rounded-xl px-1 py-1.5 transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        isMoreActive || moreSheetOpen
          ? "bg-primary/10 text-primary"
          : "text-on-surface-variant active:bg-surface-container-high active:text-primary"
      }`}
      onClick={moreSheetOpen ? closeMoreSheet : openMoreSheet}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined text-[22px] ${isMoreActive || moreSheetOpen ? "text-primary" : ""}`}
        style={
          isMoreActive || moreSheetOpen
            ? { fontVariationSettings: ACTIVE_FONT_SETTINGS }
            : undefined
        }
      >
        more_horiz
      </span>
      <span
        className={`mt-0.5 text-[12px] leading-tight ${isMoreActive || moreSheetOpen ? "font-bold text-primary" : "text-on-surface-variant"}`}
      >
        {t("more")}
      </span>
    </button>
  ) : null;

  const navBar = (
    <nav
      aria-label={t("navigation")}
      className="fixed right-0 bottom-0 left-0 z-50 flex items-center bg-surface-container-low px-1 pt-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-outline-variant)] backdrop-blur-sm lg:hidden"
    >
      {leftItems.map((item) => (
        <NavTab
          icon={item.icon}
          key={item.to}
          labelKey={item.labelKey}
          to={item.to}
        />
      ))}
      {canCreateJob && <FabButton onClick={openIntakeModal} />}
      {rightItems.map((item) => (
        <NavTab
          icon={item.icon}
          key={item.to}
          labelKey={item.labelKey}
          to={item.to}
        />
      ))}
      {moreButton}
    </nav>
  );

  if (!hasMore) {
    return navBar;
  }

  return (
    <>
      {moreSheetOpen && (
        <div
          aria-label={t("more_navigation")}
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
          role="dialog"
        >
          <button
            aria-label={t("close")}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            onClick={closeMoreSheet}
            type="button"
          />
          <div className="pointer-events-auto relative rounded-t-2xl bg-surface-container-low pb-[env(safe-area-inset-bottom)] shadow-lg motion-reduce:block">
            <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-on-surface-variant/30" />
            <nav className="p-3">
              {visibleMoreItems.map(({ icon, labelKey, to }) => (
                <NavLink
                  className={({ isActive }) =>
                    `flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      isActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-on-surface-variant active:bg-surface-container-high active:text-primary"
                    }`
                  }
                  key={to}
                  onClick={() => closeMoreSheet()}
                  to={to}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={`material-symbols-outlined text-[22px] ${isActive ? "text-primary" : ""}`}
                        style={
                          isActive
                            ? { fontVariationSettings: ACTIVE_FONT_SETTINGS }
                            : undefined
                        }
                      >
                        {icon}
                      </span>
                      <span
                        className={`text-sm ${isActive ? "font-bold text-primary" : "text-on-surface-variant"}`}
                      >
                        {t(labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
      {navBar}
    </>
  );
}

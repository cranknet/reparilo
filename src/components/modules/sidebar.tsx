import type { RoleType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { useAuthStore } from "@/stores/auth";

interface NavItem {
  icon: string;
  labelKey: string;
  to: string;
}

const OWNER_NAV_ITEMS: NavItem[] = [
  { icon: "dashboard", labelKey: "dashboard", to: "/" },
  { icon: "build", labelKey: "jobs", to: "/jobs" },
  { icon: "inventory_2", labelKey: "parts_catalog", to: "/parts" },
  { icon: "menu_book", labelKey: "service_catalog", to: "/repairs" },
  { icon: "psychology", labelKey: "ai_analyst", to: "/ai-analyst" },
  { icon: "settings", labelKey: "settings", to: "/settings" },
];

const TECHNICIAN_NAV_ITEMS: NavItem[] = [
  { icon: "dashboard", labelKey: "dashboard", to: "/" },
  { icon: "work_history", labelKey: "my_jobs", to: "/jobs" },
  { icon: "inventory_2", labelKey: "parts_inventory", to: "/parts" },
  { icon: "build", labelKey: "service_catalog", to: "/repairs" },
  { icon: "notifications", labelKey: "notifications", to: "/notifications" },
];

const NAV_ITEMS_BY_ROLE: Record<RoleType, NavItem[]> = {
  OWNER: OWNER_NAV_ITEMS,
  TECHNICIAN: TECHNICIAN_NAV_ITEMS,
  FRONT_DESK: OWNER_NAV_ITEMS,
};

const ROLE_LABEL_KEYS: Record<RoleType, string> = {
  OWNER: "role.OWNER",
  TECHNICIAN: "role.TECHNICIAN",
  FRONT_DESK: "role.FRONT_DESK",
};

const ROLE_SUBTITLE_KEYS: Record<RoleType, string> = {
  OWNER: "shop_owner",
  TECHNICIAN: "senior_technician",
  FRONT_DESK: "front_desk_role_subtitle",
};

export default function Sidebar() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const navItems = NAV_ITEMS_BY_ROLE[role] ?? [];

  const handleLogout = () => {
    useAuthStore.getState().logout();
  };

  return (
    <aside className="fixed start-0 top-0 z-40 hidden h-screen w-64 flex-col bg-surface-container-low p-4 lg:flex">
      <div className="mb-8 px-2 py-6">
        <h1 className="font-black font-headline text-primary text-xl tracking-tight">
          Reparilo
        </h1>
        <p className="font-medium text-on-surface-variant text-xs tracking-wide">
          {t("app_tagline")}
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ icon, labelKey, to }) => (
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200 ${
                isActive
                  ? "translate-x-1 bg-surface-container-lowest font-semibold text-primary shadow-sm rtl:-translate-x-1"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
              }`
            }
            key={to}
            to={to}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              {icon}
            </span>
            <span className="font-medium text-sm">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary transition-all duration-200 active:scale-[0.98]"
          type="button"
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            {role === "TECHNICIAN" ? "swap_horiz" : "add_circle"}
          </span>
          <span>
            {role === "TECHNICIAN"
              ? t("tech_dashboard.update_job_status")
              : t("new_intake")}
          </span>
        </button>

        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-on-surface-variant text-xl"
              >
                person
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-on-surface text-xs">
                {t(ROLE_LABEL_KEYS[role])}
              </p>
              <p className="truncate text-on-surface-variant text-xs">
                {t(ROLE_SUBTITLE_KEYS[role])}
              </p>
            </div>
            <button
              aria-label={t("auth_sign_out_instead")}
              className="flex items-center justify-center rounded-xl px-3 py-3 text-on-surface-variant transition-all duration-200 hover:bg-surface-container hover:text-on-surface"
              onClick={handleLogout}
              title={t("auth_sign_out_instead")}
              type="button"
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-lg"
              >
                logout
              </span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

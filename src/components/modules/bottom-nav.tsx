import type { RoleType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { useAuthStore } from "@/stores/auth";

interface NavItem {
  icon: string;
  labelKey: string;
  roles: RoleType[];
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: "dashboard",
    labelKey: "dashboard",
    roles: ["OWNER", "TECHNICIAN", "FRONT_DESK"],
    to: "/",
  },
  {
    icon: "build",
    labelKey: "jobs",
    roles: ["OWNER", "TECHNICIAN", "FRONT_DESK"],
    to: "/jobs",
  },
  {
    icon: "menu_book",
    labelKey: "repair_services",
    roles: ["OWNER", "TECHNICIAN"],
    to: "/repairs",
  },
  {
    icon: "psychology",
    labelKey: "ai_assistant",
    roles: ["OWNER", "FRONT_DESK"],
    to: "/ai-analyst",
  },
  {
    icon: "settings",
    labelKey: "settings",
    roles: ["OWNER", "TECHNICIAN", "FRONT_DESK"],
    to: "/settings",
  },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-outline-variant border-t bg-surface/80 px-2 py-1 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur-lg lg:hidden">
      {visibleItems.map(({ icon, labelKey, to }) => (
        <NavLink
          className={({ isActive }) =>
            `flex min-w-0 flex-col items-center rounded-xl px-3 py-2 transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
            }`
          }
          key={to}
          to={to}
        >
          {({ isActive }) => (
            <>
              <span
                className={`material-symbols-outlined text-[22px] ${isActive ? "font-bold" : ""}`}
              >
                {icon}
              </span>
              <span
                className={`mt-0.5 text-[10px] leading-tight transition-all ${isActive ? "max-h-6 font-bold opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}
              >
                {t(labelKey)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

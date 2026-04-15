import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { icon: "dashboard", labelKey: "dashboard", to: "/" },
  { icon: "build", labelKey: "jobs", to: "/jobs" },
  { icon: "menu_book", labelKey: "repair_services", to: "/repairs" },
  { icon: "psychology", labelKey: "ai_assistant", to: "/ai-analyst" },
  { icon: "settings", labelKey: "settings", to: "/settings" },
] as const;

export default function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-outline-variant border-t bg-surface/80 px-2 py-1 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur-lg lg:hidden">
      {NAV_ITEMS.map(({ icon, labelKey, to }) => (
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

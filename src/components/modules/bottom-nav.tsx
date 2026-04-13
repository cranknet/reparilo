import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { icon: "dashboard", labelKey: "dashboard", to: "/" },
  { icon: "build", labelKey: "jobs", to: "/jobs" },
  { icon: "menu_book", labelKey: "repairs", to: "/repairs" },
  { icon: "psychology", labelKey: "ai_analyst", to: "/ai-analyst" },
  { icon: "settings", labelKey: "settings", to: "/settings" },
] as const;

export default function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-slate-200 border-t bg-white/80 px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur-lg lg:hidden">
      {NAV_ITEMS.map(({ icon, labelKey, to }) => (
        <NavLink
          className={({ isActive }) =>
            `flex flex-col items-center p-2 transition-colors ${
              isActive ? "text-primary" : "text-slate-500 hover:text-primary"
            }`
          }
          key={to}
          to={to}
        >
          {({ isActive }) => (
            <>
              <span
                className={`material-symbols-outlined ${isActive ? "font-bold" : ""}`}
              >
                {icon}
              </span>
              <span
                className={`mt-1 text-[10px] ${isActive ? "font-bold" : "font-medium"}`}
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

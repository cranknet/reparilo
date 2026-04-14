import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { icon: "dashboard", labelKey: "dashboard", to: "/" },
  { icon: "build", labelKey: "jobs", to: "/jobs" },
  { icon: "inventory_2", labelKey: "parts_catalog", to: "/parts" },
  { icon: "menu_book", labelKey: "repairs", to: "/repairs" },
  { icon: "psychology", labelKey: "ai_analyst", to: "/ai-analyst" },
  { icon: "settings", labelKey: "settings", to: "/settings" },
] as const;

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="fixed top-0 left-0 z-40 hidden h-screen w-64 flex-col bg-surface-container-low p-4 lg:flex">
      <div className="mb-8 px-2 py-6">
        <h1 className="font-black font-headline text-primary text-xl tracking-tighter">
          Reparilo
        </h1>
        <p className="font-medium text-on-surface-variant text-xs uppercase tracking-widest">
          {t("app_tagline")}
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ icon, labelKey, to }) => (
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-200 ${
                isActive
                  ? "translate-x-1 bg-white font-semibold text-primary shadow-sm"
                  : "text-slate-600 hover:bg-slate-200 hover:text-primary"
              }`
            }
            key={to}
            to={to}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="font-medium text-sm">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-1 rounded-xl bg-surface-container-high p-2">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-95"
          type="button"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span>{t("new_intake")}</span>
        </button>
        <div className="mt-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300">
            <span className="material-symbols-outlined text-slate-600 text-xl">
              person
            </span>
          </div>
          <div>
            <p className="font-bold text-on-surface text-xs">
              {t("role.OWNER")}
            </p>
            <p className="text-[10px] text-on-surface-variant">
              {t("shop_owner")}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

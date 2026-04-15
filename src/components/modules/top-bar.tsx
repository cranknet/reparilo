import type { RoleType } from "@shared/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import LanguageToggle from "./language-toggle";

const DEV_ROLES: RoleType[] = ["OWNER", "TECHNICIAN", "FRONT_DESK"];

export default function TopBar() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const role = useAuthStore((s) => s.role);
  const setRole = useAuthStore((s) => s.setRole);

  return (
    <header className="fixed top-0 right-0 z-40 flex h-16 w-full items-center justify-between border-outline-variant border-b bg-surface/95 px-4 shadow-sm backdrop-blur-sm md:px-8 lg:w-[calc(100%-16rem)]">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="material-symbols-outlined font-bold text-primary">
            build_circle
          </span>
          <span className="font-black font-headline text-on-surface text-sm uppercase tracking-tighter">
            Reparilo
          </span>
        </div>
        <div className="group relative hidden w-full max-w-xs md:block md:w-96">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">
            search
          </span>
          <input
            className="w-full rounded-full border-none bg-surface-container-high py-2 pr-4 pl-10 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            type="text"
            value={search}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {import.meta.env.DEV && (
          <select
            aria-label="DEV: Switch role"
            className="rounded-lg border border-tertiary-container bg-tertiary-container px-2 py-1 font-bold text-on-tertiary-container text-xs uppercase"
            onChange={(e) => setRole(e.target.value as RoleType)}
            title="DEV: Switch role"
            value={role}
          >
            {DEV_ROLES.map((r) => (
              <option key={r} value={r}>
                DEV: {r}
              </option>
            ))}
          </select>
        )}
        <LanguageToggle />
        <button
          aria-label={t("notifications")}
          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
          type="button"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="hidden h-8 w-px bg-outline-variant md:block" />
        <button
          className="hidden items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-surface-tint px-3 py-2 font-semibold text-on-primary text-xs shadow-md transition-transform hover:scale-95 md:flex md:px-4 md:text-sm"
          type="button"
        >
          <span className="material-symbols-outlined">
            {role === "TECHNICIAN" ? "swap_horiz" : "add_circle"}
          </span>
          {role === "TECHNICIAN"
            ? t("tech_dashboard.update_job_status")
            : t("new_intake")}
        </button>
      </div>
    </header>
  );
}

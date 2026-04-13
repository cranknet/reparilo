import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const NAV_ITEMS = [
	{ icon: "dashboard", labelKey: "dashboard", to: "/" },
	{ icon: "build", labelKey: "jobs", to: "/jobs" },
	{ icon: "inventory_2", labelKey: "parts_catalog", to: "/parts" },
	{ icon: "history_edu", labelKey: "repair_catalog", to: "/repairs" },
	{ icon: "psychology", labelKey: "ai_analyst", to: "/ai-analyst" },
	{ icon: "settings", labelKey: "settings", to: "/settings" },
] as const;

interface SidebarProps {
	onClose: () => void;
	open: boolean;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
	const { t } = useTranslation();

	return (
		<>
			{open && (
				<button
					aria-label="Close menu"
					className="fixed inset-0 z-40 bg-black/40 lg:hidden"
					onClick={onClose}
					type="button"
				/>
			)}
			<aside
				className={`fixed top-0 left-0 z-50 flex h-screen w-64 flex-col bg-slate-100 p-4 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
			>
				<div className="mb-8 flex items-center justify-between px-2">
					<div>
						<h1 className="font-bold font-headline text-primary text-xl tracking-tighter">
							Reparilo
						</h1>
						<p className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">
							{t("app_tagline")}
						</p>
					</div>
					<button
						className="p-2 text-slate-500 lg:hidden"
						onClick={onClose}
						type="button"
					>
						<span className="material-symbols-outlined">close</span>
					</button>
				</div>

				<nav className="flex-1 space-y-1">
					{NAV_ITEMS.map(({ icon, labelKey, to }) => (
						<NavLink
							className={({ isActive }) =>
								`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors duration-200 ${
									isActive
										? "bg-slate-200 font-bold text-primary"
										: "text-slate-500 hover:bg-slate-200 hover:text-primary"
								}`
							}
							key={to}
							onClick={onClose}
							to={to}
						>
							<span className="material-symbols-outlined">{icon}</span>
							<span className="text-sm">{t(labelKey)}</span>
						</NavLink>
					))}
				</nav>

				<div className="mt-auto border-slate-200 border-t pt-6">
					<button
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-4 py-3 font-bold font-headline text-white transition-all active:opacity-80"
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
		</>
	);
}

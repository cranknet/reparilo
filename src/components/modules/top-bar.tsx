import { useState } from "react";
import { useTranslation } from "react-i18next";

interface TopBarProps {
	onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
	const { t } = useTranslation();
	const [search, setSearch] = useState("");

	return (
		<header className="fixed top-0 right-0 z-40 flex h-16 w-full items-center justify-between border-slate-100 border-b bg-white/80 px-4 shadow-sm backdrop-blur-md md:px-8 lg:w-[calc(100%-16rem)]">
			<div className="flex flex-1 items-center gap-4">
				<button
					className="p-2 text-slate-500 transition-colors hover:text-primary lg:hidden"
					onClick={onMenuToggle}
					type="button"
				>
					<span className="material-symbols-outlined">menu</span>
				</button>
				<div className="group relative w-full max-w-xs md:w-96">
					<span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
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
			<div className="flex items-center gap-3 md:gap-6">
				<button
					className="relative p-2 text-slate-500 transition-all hover:text-primary"
					type="button"
				>
					<span className="material-symbols-outlined">notifications</span>
					<span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error" />
				</button>
				<div className="hidden h-8 w-px bg-slate-200 sm:block" />
				<span className="hidden font-black font-headline text-slate-900 text-sm uppercase tracking-tighter sm:inline-block md:text-lg">
					{t("repair_dashboard")}
				</span>
			</div>
		</header>
	);
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartCategoryType } from "@shared/constants";
import MetricCard from "@/components/modules/dashboard/metric-card";

type SortField = "name" | "category" | "defaultPrice" | "supplier";

interface MockPart {
	category: PartCategoryType;
	defaultPrice: number;
	id: string;
	name: string;
	sku: string;
	stockLevel: number;
	stockMax: number;
	supplier: string;
}

const MOCK_PARTS: MockPart[] = [
	{
		category: "SCREEN",
		defaultPrice: 42500,
		id: "1",
		name: "Super Retina XDR Display",
		sku: "LCD-IP14-001",
		stockLevel: 42,
		stockMax: 50,
		supplier: "Global Tech Parts",
	},
	{
		category: "BATTERY",
		defaultPrice: 8200,
		id: "2",
		name: "Li-Ion Battery (4323mAh)",
		sku: "BATT-IP14PM-92",
		stockLevel: 3,
		stockMax: 50,
		supplier: "Energetic Logistics",
	},
	{
		category: "OTHER",
		defaultPrice: 1450,
		id: "3",
		name: "Mainboard Flex Cable",
		sku: "FLEX-MB-S22-04",
		stockLevel: 112,
		stockMax: 120,
		supplier: "Component Hub",
	},
	{
		category: "CHARGING_PORT",
		defaultPrice: 6800,
		id: "4",
		name: "USB-C Charging Assembly",
		sku: "CHRG-S23U-07",
		stockLevel: 18,
		stockMax: 40,
		supplier: "Global Tech Parts",
	},
	{
		category: "CAMERA",
		defaultPrice: 22400,
		id: "5",
		name: "Wide-Angle Camera Module",
		sku: "CAM-IP14P-WA",
		stockLevel: 7,
		stockMax: 30,
		supplier: "OptiSource DZA",
	},
	{
		category: "SPEAKER",
		defaultPrice: 3200,
		id: "6",
		name: "Earpiece Speaker Unit",
		sku: "SPK-EP-IP13-01",
		stockLevel: 56,
		stockMax: 60,
		supplier: "Component Hub",
	},
	{
		category: "MOTHERBOARD",
		defaultPrice: 85000,
		id: "7",
		name: "Logic Board (A15 Bionic)",
		sku: "MB-IP14-A15",
		stockLevel: 2,
		stockMax: 10,
		supplier: "ShenZhen Direct",
	},
	{
		category: "HOUSING",
		defaultPrice: 18000,
		id: "8",
		name: "Midframe Assembly",
		sku: "HSG-IP14-MID",
		stockLevel: 24,
		stockMax: 25,
		supplier: "Global Tech Parts",
	},
];

const CATEGORY_COLORS: Record<string, string> = {
	BATTERY: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
	BUTTON: "bg-secondary-container text-on-secondary-container",
	CAMERA: "bg-primary-fixed text-on-primary-fixed",
	CHARGING_PORT: "bg-secondary-fixed text-on-secondary-fixed-variant",
	HOUSING: "bg-surface-container-high text-on-surface-variant",
	MICROPHONE: "bg-secondary-container text-on-secondary-container",
	MOTHERBOARD: "bg-error-container text-on-error-container",
	OTHER: "bg-surface-container-high text-on-surface-variant",
	SCREEN: "bg-primary-fixed text-on-primary-fixed",
	SPEAKER: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

function StockBar({ level, max }: { level: number; max: number }) {
	const pct = Math.round((level / max) * 100);
	const color = pct < 10 ? "bg-error" : pct < 30 ? "bg-tertiary" : "bg-primary";

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between font-bold text-[10px]">
				<span className={pct < 10 ? "text-error" : "text-on-surface"}>
					{level} {pct < 10 && "⚡"}
				</span>
				<span className={pct < 10 ? "text-error" : "text-primary"}>{pct}%</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
				<div
					className={`h-full rounded-full ${color} transition-all duration-500`}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

function formatDzd(value: number): string {
	return value.toLocaleString("fr-DZ");
}

export default function PartsCatalogPage() {
	const { t } = useTranslation();
	const [search, setSearch] = useState("");
	const [sortBy, setSortBy] = useState<SortField>("name");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
	const [activeFilter, setActiveFilter] = useState<PartCategoryType | "ALL">(
		"ALL",
	);

	const lowStockCount = MOCK_PARTS.filter(
		(p) => p.stockLevel / p.stockMax < 0.1,
	).length;
	const totalValue = MOCK_PARTS.reduce(
		(acc, p) => acc + p.defaultPrice * p.stockLevel,
		0,
	);
	const uniqueSuppliers = [...new Set(MOCK_PARTS.map((p) => p.supplier))]
		.length;

	const filtered = MOCK_PARTS.filter((p) => {
		const matchesSearch =
			p.name.toLowerCase().includes(search.toLowerCase()) ||
			p.sku.toLowerCase().includes(search.toLowerCase()) ||
			p.supplier.toLowerCase().includes(search.toLowerCase());
		const matchesCategory =
			activeFilter === "ALL" || p.category === activeFilter;
		return matchesSearch && matchesCategory;
	});

	const sorted = [...filtered].sort((a, b) => {
		const mul = sortDir === "asc" ? 1 : -1;
		const av = a[sortBy];
		const bv = b[sortBy];
		if (typeof av === "string" && typeof bv === "string") {
			return mul * av.localeCompare(bv);
		}
		return mul * (Number(av) - Number(bv));
	});

	function toggleSort(field: SortField) {
		if (sortBy === field) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortBy(field);
			setSortDir("asc");
		}
	}

	const categories: (PartCategoryType | "ALL")[] = [
		"ALL",
		"SCREEN",
		"BATTERY",
		"CHARGING_PORT",
		"CAMERA",
		"SPEAKER",
		"MICROPHONE",
		"MOTHERBOARD",
		"HOUSING",
		"BUTTON",
		"OTHER",
	];

	return (
		<>
			<div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
						{t("parts_inventory")}
					</h2>
					<p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
						{t("parts_inventory_desc")}
					</p>
				</div>
				<div className="flex w-full flex-wrap gap-3 sm:w-auto">
					<button
						className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-4 py-2.5 font-bold font-headline text-on-secondary-fixed-variant text-sm transition-all hover:bg-surface-container sm:flex-none"
						type="button"
					>
						<span className="material-symbols-outlined text-[18px]">
							filter_list
						</span>
						<span className="whitespace-nowrap">{t("advanced_filters")}</span>
					</button>
					<button
						className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-4 py-2.5 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 sm:flex-none md:px-8"
						type="button"
					>
						<span className="material-symbols-outlined text-[18px]">add</span>
						<span className="whitespace-nowrap">{t("add_new_part")}</span>
					</button>
				</div>
			</div>

			<div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
				<MetricCard
					detail={t("across_categories")}
					icon="inventory_2"
					label={t("total_skus")}
					value={MOCK_PARTS.length.toLocaleString()}
				/>
				<MetricCard
					detail={t("reorder_recommended")}
					icon="warning"
					iconColor="text-error"
					label={t("low_stock_alerts")}
					value={String(lowStockCount)}
				/>
				<MetricCard
					detail=""
					icon="account_balance_wallet"
					iconColor="text-tertiary"
					label={t("inventory_value")}
					unit="DZD"
					value={formatDzd(totalValue)}
				/>
				<MetricCard
					detail={t("in_network")}
					icon="local_shipping"
					iconColor="text-on-secondary-container"
					label={t("active_suppliers")}
					value={String(uniqueSuppliers)}
				/>
			</div>

			<div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
				{categories.map((cat) => {
					const isActive = activeFilter === cat;
					return (
						<button
							className={`shrink-0 rounded-full px-4 py-2 font-bold font-headline text-xs uppercase tracking-wide transition-all ${
								isActive
									? "bg-primary text-white"
									: "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
							}`}
							key={cat}
							onClick={() => setActiveFilter(cat)}
							type="button"
						>
							{cat === "ALL" ? t("all_categories") : t(`part_category.${cat}`)}
						</button>
					);
				})}
			</div>

			<div className="overflow-hidden rounded-2xl bg-surface-container-low">
				<div className="hidden overflow-x-auto md:block">
					<table className="w-full border-collapse text-left">
						<thead>
							<tr className="bg-surface-container-high/50">
								<th
									className="cursor-pointer px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
									onClick={() => toggleSort("name")}
								>
									{t("part_details")}
									{sortBy === "name" && (
										<span className="ml-1 text-primary">
											{sortDir === "asc" ? "↑" : "↓"}
										</span>
									)}
								</th>
								<th
									className="cursor-pointer px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
									onClick={() => toggleSort("category")}
								>
									{t("category")}
									{sortBy === "category" && (
										<span className="ml-1 text-primary">
											{sortDir === "asc" ? "↑" : "↓"}
										</span>
									)}
								</th>
								<th
									className="cursor-pointer px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
									onClick={() => toggleSort("supplier")}
								>
									{t("supplier")}
									{sortBy === "supplier" && (
										<span className="ml-1 text-primary">
											{sortDir === "asc" ? "↑" : "↓"}
										</span>
									)}
								</th>
								<th
									className="cursor-pointer px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
									onClick={() => toggleSort("defaultPrice")}
								>
									{t("unit_cost")}
									{sortBy === "defaultPrice" && (
										<span className="ml-1 text-primary">
											{sortDir === "asc" ? "↑" : "↓"}
										</span>
									)}
								</th>
								<th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-on-surface-variant">
									{t("stock_level")}
								</th>
								<th className="px-6 py-4" />
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant/10">
							{sorted.map((part) => {
								const stockPct = Math.round(
									(part.stockLevel / part.stockMax) * 100,
								);
								const isLow = stockPct < 10;
								return (
									<tr
										className={`transition-colors hover:bg-surface-container-lowest ${isLow ? "bg-error-container/10" : ""}`}
										key={part.id}
									>
										<td className="px-6 py-5">
											<div className="flex flex-col">
												<span className="font-bold text-on-surface text-sm">
													{part.name}
												</span>
												<span className="font-mono text-[10px] uppercase tracking-tight text-outline">
													{part.sku}
												</span>
											</div>
										</td>
										<td className="px-6 py-5">
											<span
												className={`rounded-full px-3 py-1 font-bold text-[10px] uppercase ${CATEGORY_COLORS[part.category] ?? "bg-surface-container-high text-on-surface-variant"}`}
											>
												{t(`part_category.${part.category}`)}
											</span>
										</td>
										<td className="px-6 py-5">
											<span className="text-on-surface-variant text-sm">
												{part.supplier}
											</span>
										</td>
										<td className="px-6 py-5">
											<span className="font-semibold font-mono text-sm">
												{formatDzd(part.defaultPrice)} DZD
											</span>
										</td>
										<td className="min-w-[160px] px-6 py-5">
											<StockBar level={part.stockLevel} max={part.stockMax} />
										</td>
										<td className="px-6 py-5 text-right">
											<button
												className="material-symbols-outlined text-outline transition-colors hover:text-primary"
												type="button"
											>
												more_vert
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-outline-variant/10 md:hidden">
					{sorted.map((part) => {
						const stockPct = Math.round(
							(part.stockLevel / part.stockMax) * 100,
						);
						const isLow = stockPct < 10;
						return (
							<div
								className={`p-4 ${isLow ? "bg-error-container/10" : ""}`}
								key={part.id}
							>
								<div className="mb-2 flex items-start justify-between">
									<div>
										<h3 className="font-bold text-on-surface text-sm">
											{part.name}
										</h3>
										<span className="font-mono text-[10px] text-outline">
											{part.sku}
										</span>
									</div>
									<span
										className={`rounded-full px-2 py-0.5 font-bold text-[10px] uppercase ${CATEGORY_COLORS[part.category] ?? "bg-surface-container-high text-on-surface-variant"}`}
									>
										{t(`part_category.${part.category}`)}
									</span>
								</div>
								<div className="flex items-end justify-between">
									<div className="flex flex-col">
										<span
											className={`font-bold uppercase tracking-widest text-[10px] ${isLow ? "text-error" : "text-on-surface-variant"}`}
										>
											{isLow ? t("low_stock") : t("stock_level")}
										</span>
										<span
											className={`font-bold text-sm ${isLow ? "text-error" : "text-on-surface"}`}
										>
											{part.stockLevel} {t("units")} ({stockPct}%)
										</span>
									</div>
									<span className="font-bold font-mono text-primary text-sm">
										{formatDzd(part.defaultPrice)} DZD
									</span>
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex items-center justify-between border-t border-outline-variant/5 bg-surface-container-high/30 px-6 py-4">
					<span className="font-bold text-on-surface-variant text-[10px] uppercase tracking-widest">
						{t("showing_results", {
							count: sorted.length,
							total: MOCK_PARTS.length,
						})}
					</span>
					<div className="flex gap-2">
						<button
							className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface disabled:opacity-50"
							disabled
							type="button"
						>
							<span className="material-symbols-outlined text-sm">
								chevron_left
							</span>
						</button>
						<button
							className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"
							type="button"
						>
							<span className="font-bold text-xs">1</span>
						</button>
						<button
							className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface"
							type="button"
						>
							<span className="font-bold text-xs">2</span>
						</button>
						<button
							className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface"
							type="button"
						>
							<span className="material-symbols-outlined text-sm">
								chevron_right
							</span>
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

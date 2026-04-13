import { useTranslation } from "react-i18next";

interface DayData {
	cost: number;
	revenue: number;
}

interface FinancialTrendProps {
	data: DayData[];
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function FinancialTrend({ data }: FinancialTrendProps) {
	const { t } = useTranslation();

	const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.cost]), 1);

	return (
		<div className="relative overflow-hidden rounded-xl bg-surface-container-low p-6">
			<div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<h3 className="font-bold font-headline text-lg text-on-surface">
					{t("financial_trend")}
				</h3>
				<div className="flex gap-4">
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-primary" />
						<span className="font-bold text-[10px] text-on-surface-variant uppercase">
							{t("revenue")}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-slate-400" />
						<span className="font-bold text-[10px] text-on-surface-variant uppercase">
							{t("cost")}
						</span>
					</div>
				</div>
			</div>
			<div className="flex h-48 items-end gap-1 px-2 sm:gap-2">
				{data.map((day, i) => (
					<div
						className="flex flex-1 flex-col justify-end gap-1"
						key={DAY_KEYS[i]}
					>
						<div
							className="w-full rounded-t bg-slate-300 transition-all duration-500"
							style={{ height: `${(day.cost / maxVal) * 100}%` }}
						/>
						<div
							className="w-full rounded-t bg-primary transition-all duration-500"
							style={{ height: `${(day.revenue / maxVal) * 100}%` }}
						/>
						<span className="mt-2 text-center font-bold text-[8px] text-on-surface-variant uppercase sm:text-[9px]">
							{t(DAY_KEYS[i])}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

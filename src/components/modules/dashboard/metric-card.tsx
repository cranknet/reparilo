import type { ReactNode } from "react";

interface MetricCardProps {
	children?: ReactNode;
	detail: string;
	icon: string;
	iconColor?: string;
	label: string;
	unit?: string;
	value: string;
}

export default function MetricCard({
	label,
	value,
	unit,
	detail,
	icon,
	iconColor = "text-primary",
	children,
}: MetricCardProps) {
	return (
		<div className="relative overflow-hidden rounded-xl bg-surface-container-low p-6">
			<div className="mb-4 flex items-start justify-between">
				<p className="font-bold text-on-surface-variant text-xs uppercase tracking-widest">
					{label}
				</p>
				<span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
			</div>
			<div className="flex items-baseline gap-2">
				<span className="font-extrabold font-headline text-4xl text-on-surface">
					{value}
				</span>
				{unit && (
					<span className="font-bold text-on-surface-variant text-sm">
						{unit}
					</span>
				)}
			</div>
			<p className="mt-1 font-bold text-on-surface-variant text-xs">{detail}</p>
			{children && <div className="mt-4">{children}</div>}
		</div>
	);
}

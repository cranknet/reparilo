import { useTranslation } from "react-i18next";

interface OverdueJob {
	device: string;
	id: string;
	lateness: string;
	repair: string;
}

interface OverdueJobsProps {
	jobs: OverdueJob[];
	warrantyReturns: {
		id: string;
		description: string;
		priority?: string;
		timeAgo: string;
	}[];
}

export default function OverdueJobs({
	jobs,
	warrantyReturns,
}: OverdueJobsProps) {
	const { t } = useTranslation();

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
				<div className="mb-6 flex items-center gap-2">
					<span className="material-symbols-outlined text-error">alarm_on</span>
					<h3 className="font-extrabold font-headline text-on-surface text-sm uppercase tracking-tight">
						{t("overdue_jobs")}
					</h3>
					{jobs.length > 0 && (
						<span className="ml-auto rounded-full bg-error-container px-2 py-0.5 font-black text-[10px] text-on-error-container">
							{String(jobs.length).padStart(2, "0")}
						</span>
					)}
				</div>
				<div className="space-y-6">
					{jobs.map((job) => (
						<div className="flex flex-col" key={job.id}>
							<div className="mb-1 flex items-start justify-between">
								<span className="font-bold text-on-surface text-xs">
									{job.device}
								</span>
								<span className="font-bold text-[10px] text-error">
									{job.lateness}
								</span>
							</div>
							<span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
								{job.id} &bull; {job.repair}
							</span>
						</div>
					))}
				</div>
				<button
					className="mt-8 w-full text-center font-bold text-primary text-xs hover:underline"
					type="button"
				>
					{t("view_all_critical")}
				</button>
			</div>

			<div className="rounded-xl bg-surface-container-low p-6">
				<div className="mb-6 flex items-center gap-2">
					<span className="material-symbols-outlined text-on-secondary-container">
						assignment_return
					</span>
					<h3 className="font-extrabold font-headline text-on-surface text-sm uppercase tracking-tight">
						{t("warranty_returns")}
					</h3>
				</div>
				{warrantyReturns.map((wr, i) => (
					<div
						className={`mb-3 rounded-lg border border-slate-100 p-3 ${i > 0 ? "opacity-60" : ""}`}
						key={wr.id}
					>
						{wr.priority && (
							<div className="mb-2 flex items-center gap-3">
								<span className="material-symbols-outlined text-[18px] text-tertiary">
									warning
								</span>
								<p className="font-bold text-on-surface text-xs">{wr.id}</p>
							</div>
						)}
						{!wr.priority && (
							<div className="mb-2 flex items-center gap-3">
								<p className="font-bold text-on-surface text-xs">{wr.id}</p>
							</div>
						)}
						<p className="mb-3 text-[10px] text-on-surface-variant">
							{wr.description}
						</p>
						<div className="flex items-center justify-between">
							{wr.priority && (
								<span className="rounded-full bg-secondary-container px-2 py-0.5 font-bold text-[9px] text-on-secondary-container">
									{wr.priority}
								</span>
							)}
							<span className="text-[9px] text-slate-400">{wr.timeAgo}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

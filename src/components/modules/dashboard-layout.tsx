import type { ReactNode } from "react";
import { useState } from "react";
import Sidebar from "@/components/modules/sidebar";
import TopBar from "@/components/modules/top-bar";

interface DashboardLayoutProps {
	children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<div className="min-h-screen overflow-x-hidden bg-background text-on-background">
			<Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} />
			<TopBar onMenuToggle={() => setSidebarOpen((v) => !v)} />
			<main className="min-h-screen p-4 pt-20 md:p-8 md:pt-24 lg:ml-64">
				{children}
			</main>
		</div>
	);
}

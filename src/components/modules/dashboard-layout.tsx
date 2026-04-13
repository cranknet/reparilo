import type { ReactNode } from "react";
import BottomNav from "@/components/modules/bottom-nav";
import Sidebar from "@/components/modules/sidebar";
import TopBar from "@/components/modules/top-bar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-background">
      <Sidebar />
      <TopBar />
      <main className="min-h-screen p-4 pt-20 pb-20 md:p-8 md:pt-24 md:pb-24 lg:ml-64 lg:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

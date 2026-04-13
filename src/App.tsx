import { Route, Routes } from "react-router";
import DashboardLayout from "@/components/modules/dashboard-layout";
import DashboardPage from "@/pages/dashboard";

export default function App() {
	return (
		<Routes>
			<Route
				element={
					<DashboardLayout>
						<DashboardPage />
					</DashboardLayout>
				}
				path="/"
			/>
			<Route element={<div>Customer Tracking</div>} path="/tracking/:jobCode" />
		</Routes>
	);
}

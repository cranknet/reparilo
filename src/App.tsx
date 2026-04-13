import { Route, Routes } from "react-router";

function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-2xl">Reparilo Dashboard</h1>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Dashboard />} path="/" />
      <Route element={<div>Customer Tracking</div>} path="/tracking/:jobCode" />
    </Routes>
  );
}

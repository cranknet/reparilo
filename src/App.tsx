import { Routes, Route } from 'react-router';

function Dashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Reparilo Dashboard</h1></div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/tracking/:jobCode" element={<div>Customer Tracking</div>} />
    </Routes>
  );
}

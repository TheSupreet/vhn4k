import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import AccuracyPage from "./pages/AccuracyPage";
import DecisionDesk from "./pages/DecisionDesk";
import MethodologyPage from "./pages/Methodology";

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 9l8 4.5V22L16 27 8 22v-8.5L16 9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 9v18M8 13.5l8 4.5 8-4.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 7l3 2M26 7l-3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <div className="brand-block">
            <Mark />
            <div className="brand">DAY-AHEAD WIND DESK</div>
            <div className="product-line">GB national wind · January 2026 · EPEX 09:20 gate</div>
          </div>
          <nav>
            <NavLink to="/" end>Decision desk</NavLink>
            <NavLink to="/accuracy">Accuracy</NavLink>
            <NavLink to="/methodology">Methodology</NavLink>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<DecisionDesk />} />
            <Route path="/accuracy" element={<AccuracyPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

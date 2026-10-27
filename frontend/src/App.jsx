import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import AccuracyPage from "./pages/AccuracyPage";
import DecisionDesk from "./pages/DecisionDesk";
import MethodologyPage from "./pages/Methodology";

export default function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <div>
            <div className="brand">DAY-AHEAD WIND DESK</div>
            <div className="product-line">GB national wind · January 2026 · EPEX 09:20 gate</div>
          </div>
          <nav>
            <NavLink to="/" end>Decision</NavLink>
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

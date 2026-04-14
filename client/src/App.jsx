import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage.jsx';
import ResearchInterface from '@/pages/ResearchInterface.jsx';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/research/:sessionId" element={<ResearchInterface />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

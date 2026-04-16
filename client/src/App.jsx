import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme.js';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';

const LandingPage = lazy(() => import('@/pages/LandingPage.jsx'));
const ResearchInterface = lazy(() => import('@/pages/ResearchInterface.jsx'));
const AnalyticsDashboard = lazy(() => import('@/pages/AnalyticsDashboard.jsx'));
const PlatformPage = lazy(() => import('@/pages/PlatformPage.jsx'));
const StatusPage = lazy(() => import('@/pages/StatusPage.jsx'));

function RouteFallback() {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 text-slate-100">
      <div className="w-full max-w-xl">
        <LoadingOverlay message="Loading page..." steps={['Preparing route bundle', 'Applying UI theme', 'Rendering interface']} />
      </div>
    </div>
  );
}

export default function App() {
  useTheme();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<LandingPage />} />
        <Route path="/research/:sessionId" element={<ResearchInterface />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/status" element={<StatusPage />} />
      </Routes>
    </Suspense>
  );
}

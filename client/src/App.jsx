import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import LoadingOverlay from '@/components/ui/LoadingOverlay.jsx';
import ErrorBoundary from '@/components/ui/ErrorBoundary.jsx';
import ToastViewport from '@/components/ui/ToastViewport.jsx';
import SystemStatusBanner from '@/components/features/SystemStatusBanner.jsx';

const LandingPage = lazy(() => import('@/pages/LandingPage.jsx'));
const ResearchInterface = lazy(() => import('@/pages/ResearchInterface.jsx'));
const Analytics = lazy(() => import('@/pages/Analytics.jsx'));

function RouteFallback() {
  return (
    <div className="app-shell token-bg token-text flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <LoadingOverlay message="Loading page..." steps={['Preparing route bundle', 'Loading data context', 'Rendering interface']} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SystemStatusBanner />
      <ToastViewport />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<LandingPage />} />
          <Route path="/research" element={<LandingPage />} />
          <Route path="/research/:sessionId" element={<ResearchInterface />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/:sessionId" element={<Analytics />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

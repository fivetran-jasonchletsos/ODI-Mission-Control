import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

const OverviewPage   = lazy(() => import('./pages/OverviewPage'));
const PortfolioPage  = lazy(() => import('./pages/PortfolioPage'));
const QualityPage    = lazy(() => import('./pages/QualityPage'));
const LineagePage    = lazy(() => import('./pages/LineagePage'));
const PipelinesPage  = lazy(() => import('./pages/PipelinesPage'));
const GovernancePage = lazy(() => import('./pages/GovernancePage'));
const CostPage       = lazy(() => import('./pages/CostPage'));
const AlertsPage     = lazy(() => import('./pages/AlertsPage'));

function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-20 text-center font-mono text-xs"
         style={{ color: 'var(--ink-dim)' }}>
      LOADING SNAPSHOT…
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index               element={<Suspense fallback={<Loading />}><OverviewPage   /></Suspense>} />
        <Route path="portfolio"    element={<Suspense fallback={<Loading />}><PortfolioPage  /></Suspense>} />
        <Route path="quality"      element={<Suspense fallback={<Loading />}><QualityPage    /></Suspense>} />
        <Route path="lineage"      element={<Suspense fallback={<Loading />}><LineagePage    /></Suspense>} />
        <Route path="pipelines"    element={<Suspense fallback={<Loading />}><PipelinesPage  /></Suspense>} />
        <Route path="governance"   element={<Suspense fallback={<Loading />}><GovernancePage /></Suspense>} />
        <Route path="cost"         element={<Suspense fallback={<Loading />}><CostPage       /></Suspense>} />
        <Route path="alerts"       element={<Suspense fallback={<Loading />}><AlertsPage     /></Suspense>} />
      </Route>
    </Routes>
  );
}

# Routes

## Router File
Source: `client/src/App.jsx`

```jsx
import { Route, Routes } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage.jsx';
import ResearchInterface from '@/pages/ResearchInterface.jsx';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/research/:sessionId" element={<ResearchInterface />} />
      <Route path="/analytics" element={<AnalyticsDashboard />} />
    </Routes>
  );
}
```

## Route Map

- `/` -> `client/src/pages/LandingPage.jsx`
- `/research/:sessionId` -> `client/src/pages/ResearchInterface.jsx`
- `/analytics` -> `client/src/pages/AnalyticsDashboard.jsx`

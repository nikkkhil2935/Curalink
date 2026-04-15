# Pages Dependency Trees

## / (Landing)
Entry: `client/src/pages/LandingPage.jsx`
Dependencies:
- `client/src/components/ContextForm.jsx`

## /research/:sessionId (Research Interface)
Entry: `client/src/pages/ResearchInterface.jsx`
Dependencies:
- `client/src/components/chat/ChatPanel.jsx`
  - `client/src/components/chat/ChatInput.jsx`
  - `client/src/components/chat/MessageBubble.jsx`
    - `client/src/components/chat/StructuredAnswer.jsx`
- `client/src/components/evidence/EvidencePanel.jsx`
  - `client/src/components/evidence/PublicationsTab.jsx`
  - `client/src/components/evidence/TrialsTab.jsx`
  - `client/src/components/evidence/ResearchersTab.jsx`
  - `client/src/components/evidence/TimelineTab.jsx`
- `client/src/components/sidebar/Sidebar.jsx`
  - `client/src/components/sidebar/ExportButton.jsx`
- `client/src/store/useAppStore.js`

## /analytics (Analytics Dashboard)
Entry: `client/src/pages/AnalyticsDashboard.jsx`
Dependencies:
- no local component imports (self-contained page)

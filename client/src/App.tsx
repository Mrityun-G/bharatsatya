import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DevDemoAccessPage } from './pages/DevDemoAccessPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { DocumentIntakePage } from './pages/DocumentIntakePage';
import { DocumentIntelligencePage } from './pages/DocumentIntelligencePage';
import { ComplianceChecklistPage } from './pages/ComplianceChecklistPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { ReportsAuditPage } from './pages/ReportsAuditPage';
import { RuleManagementPage } from './pages/RuleManagementPage';
import { AnomalyIndicatorsPage } from './pages/AnomalyIndicatorsPage';
import { SourceVerificationPage } from './pages/SourceVerificationPage';
import { InfrastructureCompliancePage } from './pages/InfrastructureCompliancePage';
import { demoMode } from './services/demoData';
import { useState } from 'react';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gov-navy)' }}>
        Loading BharatSatya Regulatory Engine...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="app-container">
      <Header navigationOpen={navigationOpen} onMenuToggle={() => setNavigationOpen((open) => !open)} />
      <div className="main-layout">
        <Sidebar isOpen={navigationOpen} onNavigate={() => setNavigationOpen(false)} />
        {navigationOpen && <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} />}
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
};

// Presentation-only route guard in the synthetic demo. Backend authorization remains
// the authority whenever API mode is selected.
const DemoReviewerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (demoMode && user?.role !== 'REVIEWER' && user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dev/demo-access" element={<DevDemoAccessPage />} />
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <DashboardPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedLayout>
                <ApplicationsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ProtectedLayout>
                <ApplicationDetailPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/documents/intake"
            element={
              <ProtectedLayout>
                <DocumentIntakePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/documents/intelligence"
            element={
              <ProtectedLayout>
                <DocumentIntelligencePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/compliance"
            element={
              <ProtectedLayout>
                <ComplianceChecklistPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/reviews"
            element={
              <ProtectedLayout>
                <DemoReviewerRoute><ReviewQueuePage /></DemoReviewerRoute>
              </ProtectedLayout>
            }
          />
          <Route
            path="/anomalies"
            element={
              <ProtectedLayout>
                <AnomalyIndicatorsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/verifications"
            element={
              <ProtectedLayout>
                <DemoReviewerRoute><SourceVerificationPage /></DemoReviewerRoute>
              </ProtectedLayout>
            }
          />
          <Route
            path="/infrastructure"
            element={
              <ProtectedLayout>
                <InfrastructureCompliancePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedLayout>
                <ReportsAuditPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/rules"
            element={
              <ProtectedLayout>
                <RuleManagementPage />
              </ProtectedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

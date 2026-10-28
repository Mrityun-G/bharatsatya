import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export const AppFooter: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isReviewer = user?.role === 'REVIEWER' || user?.role === 'ADMIN';

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">
          <strong>BharatSatya</strong>
          <p>Application validation, document authentication and compliance checking to support AICTE approval processing.</p>
        </div>

        <nav aria-label="Workspace">
          <h2>Workspace</h2>
          <ul>
            <li><Link to="/applications">{t('sidebar.applications')}</Link></li>
            <li><Link to="/documents/intake">{t('sidebar.documentIntake')}</Link></li>
            <li><Link to="/documents/intelligence">{t('sidebar.documentIntelligence')}</Link></li>
            <li><Link to="/compliance">{t('sidebar.complianceChecklist')}</Link></li>
          </ul>
        </nav>

        <nav aria-label="Verification">
          <h2>Verification</h2>
          <ul>
            <li><Link to="/anomalies">{t('sidebar.anomalyIndicators')}</Link></li>
            {isReviewer && <li><Link to="/verifications">{t('sidebar.sourceVerification')}</Link></li>}
            <li><Link to="/infrastructure">{t('sidebar.infrastructureCompliance')}</Link></li>
            <li><Link to="/reports">{t('sidebar.reportsAudit')}</Link></li>
          </ul>
        </nav>

        <div>
          <h2>About this prototype</h2>
          <p>
            Built for Smart India Hackathon problem statement SIH26261 and demonstrated with synthetic records.
            Findings support decisions; statutory scrutiny, inspection and approval remain with the competent AICTE authority.
          </p>
        </div>
      </div>
      <div className="app-footer-base">
        <span>BharatSatya prototype · not an official AICTE system</span>
        <span>Decision support only</span>
      </div>
    </footer>
  );
};

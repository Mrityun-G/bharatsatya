import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import {
  FileText,
  AlertTriangle,
  RotateCcw,
  AlertCircle,
  Search,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await api.get('/dashboard/overview');
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setLoadError('Dashboard metrics are currently unavailable.');
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      setLoadError('Dashboard data could not be loaded. Please verify API server connectivity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="gov-loading-wrap">
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (!data && loadError) {
    return (
      <div className="notice-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} />
          <span>{loadError}</span>
        </div>
        <button type="button" className="gov-btn gov-btn-secondary gov-btn-xs" onClick={fetchDashboard}>
          <RotateCcw size={12} /> {t('common.retry')}
        </button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const def = summary.deficiencies || {};
  const recentApps = data?.recentApplications || [];
  const recentAudit = data?.recentAuditEvents || [];

  const filteredApps = recentApps.filter((app: any) => {
    const matchesSearch =
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.institution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.institution.aictePermanentId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalActionNeeded = (def.missingDocuments || 0) + (def.expiredDocuments || 0) + (def.mismatches || 0);

  return (
    <div className="gov-page-container">
      {/* Page Title & Quick Navigation */}
      <div className="gov-page-header">
        <div className="gov-page-titles">
          <h1 className="gov-page-h1">{t('dashboard.title')}</h1>
          <p className="gov-page-sub">{t('dashboard.subtitle')}</p>
        </div>
        <div className="gov-page-actions">
          <Link to="/applications" className="gov-btn gov-btn-secondary">
            <FileText size={13} />
            <span>{t('dashboard.fullRegistry')}</span>
          </Link>
          <Link to="/documents/intake" className="gov-btn gov-btn-primary">
            <span>{t('dashboard.newDocumentIntake')}</span>
          </Link>
        </div>
      </div>

      {/* Regulatory Scrutiny Alert (Institutional Restraint) */}
      {totalActionNeeded > 0 && (
        <div className="gov-alert-banner" role="alert">
          <div className="gov-alert-content">
            <AlertTriangle size={16} className="gov-alert-icon" />
            <div className="gov-alert-text">
              <strong>{t('dashboard.advisoryTitle')}</strong>{' '}
              {t('dashboard.advisoryText', {
                missing: def.missingDocuments || 0,
                expired: def.expiredDocuments || 0,
                mismatches: def.mismatches || 0,
              })}
            </div>
          </div>
          <Link to="/compliance" className="gov-alert-action">
            {t('dashboard.viewChecklist')}
          </Link>
        </div>
      )}

      {/* Integrated Regulatory Scrutiny Summary Register (Replaces SaaS 6-Cards) */}
      <div className="gov-scrutiny-summary-grid">
        <div className="gov-metric-cell">
          <div className="metric-header">
            <span className="metric-title">{t('dashboard.kpiTotal')}</span>
          </div>
          <div className="metric-number text-navy">{summary.totalApplications || 0}</div>
          <div className="metric-sub">{t('dashboard.kpiTotalSub')}</div>
        </div>

        <div className="gov-metric-cell">
          <div className="metric-header">
            <span className="metric-title text-amber">{t('dashboard.kpiPending')}</span>
          </div>
          <div className="metric-number text-amber">{summary.pendingReview || 0}</div>
          <div className="metric-sub">{t('dashboard.kpiPendingSub')}</div>
        </div>

        <div className="gov-metric-cell">
          <div className="metric-header">
            <span className="metric-title text-red">{t('dashboard.kpiMissing')}</span>
          </div>
          <div className="metric-number text-red">{def.missingDocuments || 0}</div>
          <div className="metric-sub">{t('dashboard.kpiMissingSub')}</div>
        </div>

        <div className="gov-metric-cell">
          <div className="metric-header">
            <span className="metric-title text-red">{t('dashboard.kpiExpired')}</span>
          </div>
          <div className="metric-number text-red">{def.expiredDocuments || 0}</div>
          <div className="metric-sub">{t('dashboard.kpiExpiredSub')}</div>
        </div>

        <div className="gov-metric-cell">
          <div className="metric-header">
            <span className="metric-title text-amber">{t('dashboard.kpiMismatch')}</span>
          </div>
          <div className="metric-number text-amber">{(def.mismatches || 0) + (def.manualReviewRequired || 0)}</div>
          <div className="metric-sub">{t('dashboard.kpiMismatchSub')}</div>
        </div>

        <div className="gov-metric-cell">
          <div className="metric-header">
            <span className="metric-title text-green">{t('dashboard.kpiVerified')}</span>
          </div>
          <div className="metric-number text-green">{summary.approved || 0}</div>
          <div className="metric-sub">{t('dashboard.kpiVerifiedSub')}</div>
        </div>
      </div>

      {/* Two Column Layout for Recent Submissions and Audit Events */}
      <div className="gov-dashboard-grid">
        {/* Left Column: Recent Applications Register */}
        <div className="gov-section-box">
          <div className="gov-box-header">
            <div className="gov-box-titles">
              <h2 className="gov-box-h2">{t('dashboard.recentApplications')}</h2>
              <span className="gov-box-badge">{filteredApps.length} active filings</span>
            </div>

            <div className="gov-box-search">
              <Search size={13} className="gov-box-search-icon" />
              <input
                type="text"
                className="gov-box-search-input"
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="gov-table-wrapper">
            <table className="gov-register-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>{t('applications.colId')}</th>
                  <th>{t('applications.colInstitution')}</th>
                  <th style={{ width: '120px' }}>{t('applications.colStatus')}</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="gov-td-center gov-td-empty">
                      <span>No filings match your criteria.</span>
                    </td>
                  </tr>
                ) : (
                  filteredApps.slice(0, 7).map((app: any) => (
                    <tr key={app.id}>
                      <td className="cell-id">
                        <Link to={`/applications/${app.id}`} className="gov-link-id">
                          {app.id}
                        </Link>
                      </td>
                      <td className="cell-inst">
                        <div className="inst-name">{app.institution.name}</div>
                        <div className="inst-details">
                          Permanent ID: {app.institution.aictePermanentId} · {app.institution.state}
                        </div>
                      </td>
                      <td className="cell-status">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="cell-actions" style={{ textAlign: 'right' }}>
                        <Link to={`/applications/${app.id}`} className="gov-btn-dossier-sm">
                          {t('common.view')}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Regulatory Audit Log */}
        <div className="gov-section-box">
          <div className="gov-box-header">
            <div className="gov-box-titles">
              <h2 className="gov-box-h2">{t('dashboard.recentAuditEvents')}</h2>
              <span className="gov-box-badge">Verified Trace</span>
            </div>
            <Link to="/reports" className="gov-box-more-link">
              {t('common.viewAll')}
            </Link>
          </div>

          <div className="gov-audit-list">
            {recentAudit.length === 0 ? (
              <div className="gov-empty-content" style={{ padding: '24px' }}>
                <span>No recent scrutiny events recorded.</span>
              </div>
            ) : (
              recentAudit.slice(0, 6).map((audit: any) => (
                <div key={audit.id} className="gov-audit-row">
                  <div className="gov-audit-meta">
                    <span className="gov-audit-action">{audit.action?.replace(/_/g, ' ')}</span>
                    <span className="gov-audit-time">
                      {new Date(audit.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="gov-audit-desc">
                    {audit.applicationId && (
                      <Link to={`/applications/${audit.applicationId}`} className="gov-audit-app-ref">
                        [{audit.applicationId}]
                      </Link>
                    )}{' '}
                    {audit.details || 'Scrutiny record entered.'}
                  </div>
                  <div className="gov-audit-actor">
                    <span>Officer: {audit.user?.name || 'Automated Scrutiny Engine'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

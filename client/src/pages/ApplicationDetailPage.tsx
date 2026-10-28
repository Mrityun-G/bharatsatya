import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  History,
  FileCode,
  Download,
} from 'lucide-react';

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [application, setApplication] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'findings' | 'verification' | 'reviews' | 'audit'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Status transition state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('VERIFIED_RECOMMENDED');
  const [statusReason, setStatusReason] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchApplication = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await api.get(`/applications/${id}`);
      if (res.data.success) {
        setApplication(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load application details', err);
      setLoadError('The application dossier could not be loaded. Check the API connection and retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [id]);

  const handleRunValidation = async () => {
    try {
      setIsEvaluating(true);
      const res = await api.post(`/applications/${id}/validate`);
      if (res.data.success) {
        await fetchApplication();
      }
    } catch (err: any) {
      alert(`Validation error: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusReason.trim()) {
      alert('A justification reason is mandatory for consequential status transitions.');
      return;
    }
    try {
      setIsUpdatingStatus(true);
      const res = await api.patch(`/applications/${id}/status`, {
        newStatus,
        reason: statusReason,
        notes: statusNotes,
      });
      if (res.data.success) {
        setShowStatusModal(false);
        setStatusReason('');
        setStatusNotes('');
        await fetchApplication();
      }
    } catch (err: any) {
      alert(`Error updating status: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const res = await api.get(`/applications/${id}/report`);
      if (res.data.success) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data.data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `${id}_Validation_Dossier.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err: any) {
      alert('Failed to generate validation report.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gov-grey-muted)' }}>Loading dossier #{id}...</div>;
  }

  if (!application) {
    return <div className="notice-error" role="alert">
      {loadError || `Application ${id} was not found.`} <button type="button" className="btn btn-secondary btn-sm" onClick={fetchApplication}>Retry</button>
    </div>;
  }

  const isReviewerOrAdmin = user?.role === 'REVIEWER' || user?.role === 'ADMIN';
  const findings = application.validationFindings || [];
  const criticalDeficiencies = findings.filter((f: any) => f.severity === 'CRITICAL' && f.status !== 'PASSED');

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('applicationDetail.breadcrumbApps'), to: '/applications' },
          { label: application.id },
        ]}
      />

      {/* Main Dossier Header Case File Box */}
      <div className="gov-register-box" style={{ marginBottom: '16px' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--gov-navy)' }}>{application.id}</h1>
              <StatusBadge status={application.status} />
              <span className="gov-discipline-tag" style={{ background: 'var(--gov-grey-bg)', padding: '2px 8px', borderRadius: '2px' }}>
                {application.category.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gov-grey-text)', marginTop: '4px' }}>
              {application.institution?.name} · AICTE Perm ID: {application.institution?.aictePermanentId}
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleRunValidation}
              className="gov-btn gov-btn-secondary"
              disabled={isEvaluating}
            >
              <RefreshCw size={13} className={isEvaluating ? 'spin' : ''} />
              <span>{isEvaluating ? t('common.evaluatingRules') : t('common.rerunScrutiny')}</span>
            </button>

            <button onClick={handleDownloadReport} className="gov-btn gov-btn-secondary">
              <Download size={13} />
              <span>{t('common.exportDossier')}</span>
            </button>

            {isReviewerOrAdmin && (
              <button onClick={() => setShowStatusModal(true)} className="gov-btn gov-btn-primary">
                {t('applicationDetail.transitionBtn')}
              </button>
            )}
          </div>
        </div>

        {/* Current Stage & Recommended Action Notice */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: criticalDeficiencies.length > 0 ? 'var(--gov-red-light)' : 'var(--gov-green-light)',
            borderTop: '1px solid var(--gov-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {criticalDeficiencies.length > 0 ? (
              <AlertTriangle size={15} color="var(--gov-red)" />
            ) : (
              <CheckCircle2 size={15} color="var(--gov-green)" />
            )}
            <div>
              <span style={{ fontWeight: 700 }}>{t('applicationDetail.nextAction')} </span>
              <span>{application.recommendedAction || application.currentStage}</span>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
            {t('applicationDetail.lastEvaluated')} {application.lastEvaluatedAt ? new Date(application.lastEvaluatedAt).toLocaleString('en-IN') : 'Just now'}
          </div>
        </div>
      </div>

      {/* Dossier Tabs */}
      <div className="tab-nav">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
        >
          {t('applicationDetail.tabOverview')}
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
        >
          {t('applicationDetail.tabDocuments')} ({application.documents?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('findings')}
          className={`tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
        >
          {t('applicationDetail.tabFindings')} ({findings.length})
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`tab-btn ${activeTab === 'verification' ? 'active' : ''}`}
        >
          {t('applicationDetail.tabVerification')} ({application.verificationRequests?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
        >
          {t('applicationDetail.tabReviews')} ({application.reviewActions?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
        >
          {t('applicationDetail.tabAudit')} ({application.auditEvents?.length || 0})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <div className="panel">
            <div className="panel-header">
              <h2>{t('applicationDetail.particularsTitle')}</h2>
            </div>
            <div className="panel-body">
              <div className="kv-grid">
                <div className="kv-item">
                  <div className="kv-label">{t('applicationDetail.legalName')}</div>
                  <div className="kv-value">{application.institution?.name}</div>
                </div>
                <div className="kv-item">
                  <div className="kv-label">{t('applicationDetail.permanentId')}</div>
                  <div className="kv-value">{application.institution?.aictePermanentId}</div>
                </div>
                <div className="kv-item">
                  <div className="kv-label">{t('applicationDetail.establishedYear')}</div>
                  <div className="kv-value">{application.institution?.establishedYear}</div>
                </div>
                <div className="kv-item">
                  <div className="kv-label">{t('applicationDetail.stateDistrict')}</div>
                  <div className="kv-value">{application.institution?.district}, {application.institution?.state}</div>
                </div>
                <div className="kv-item">
                  <div className="kv-label">{t('applicationDetail.officialAddress')}</div>
                  <div className="kv-value" style={{ fontSize: '13px' }}>
                    {application.institution?.address} - {application.institution?.pincode}
                  </div>
                </div>
                <div className="kv-item">
                  <div className="kv-label">{t('applicationDetail.contactEmail')}</div>
                  <div className="kv-value" style={{ fontSize: '13px' }}>{application.institution?.contactEmail}</div>
                </div>
              </div>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--gov-border)' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>{t('applicationDetail.remarksTitle')}</h3>
                <p style={{ fontSize: '13px', color: 'var(--gov-grey-text)' }}>
                  {application.remarks || 'No remarks provided during initial intake.'}
                </p>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>{t('applicationDetail.scrutinyAssignment')}</h2>
            </div>
            <div className="panel-body">
              <div className="form-group">
                <div className="kv-label">{t('applicationDetail.assignedOfficer')}</div>
                <div className="kv-value">
                  {application.assignedReviewer?.name || 'Central Scrutiny Bureau (Unassigned)'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
                  {application.assignedReviewer?.designation || 'Regional Scrutiny Committee'}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <div className="kv-label">{t('applicationDetail.currentStage')}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gov-navy)' }}>
                  {application.currentStage}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <div className="kv-label">{t('applicationDetail.deficiencySummary')}</div>
                <div style={{ fontSize: '13px', color: criticalDeficiencies.length > 0 ? 'var(--gov-red)' : 'var(--gov-green)', fontWeight: 700 }}>
                  {criticalDeficiencies.length} {t('applicationDetail.criticalFlagged')}
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <Link to="/documents/intake" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                  <Upload size={13} />
                  {t('applicationDetail.uploadAdditional')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Documents */}
      {activeTab === 'documents' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{t('applicationDetail.documentsTitle')} ({application.documents?.length || 0})</h2>
              <p style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
                {t('applicationDetail.documentsSubtitle')}
              </p>
            </div>
            <Link to="/documents/intake" className="gov-btn gov-btn-primary gov-btn-xs">
              <Upload size={13} />
              {t('dashboard.newDocumentIntake')}
            </Link>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            <div className="gov-table-wrapper">
              <table className="gov-register-table" style={{ minWidth: '880px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px', width: '200px' }}>{t('applicationDetail.docColType')}</th>
                    <th style={{ minWidth: '220px' }}>{t('applicationDetail.docColFile')}</th>
                    <th style={{ minWidth: '140px', width: '160px' }}>{t('applicationDetail.docColHash')}</th>
                    <th style={{ minWidth: '110px', width: '120px' }}>{t('applicationDetail.docColFields')}</th>
                    <th style={{ minWidth: '120px', width: '130px' }}>{t('applicationDetail.docColOcr')}</th>
                    <th style={{ minWidth: '130px', width: '140px' }}>{t('applicationDetail.docColStatus')}</th>
                    <th style={{ minWidth: '140px', width: '150px' }}>{t('applicationDetail.docColActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {application.documents?.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                        No statutory compliance documents uploaded for this application.
                      </td>
                    </tr>
                  ) : (
                    application.documents?.map((doc: any) => (
                      <tr key={doc.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>
                            {doc.documentType.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>{doc.title}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{doc.originalName}</div>
                          <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)' }}>
                            {(doc.fileSizeBytes / 1024).toFixed(1)} KB · {new Date(doc.uploadDate).toLocaleDateString('en-IN')}
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '10px', backgroundColor: 'var(--gov-surface-alt)', padding: '2px 4px', borderRadius: '2px' }}>
                            {doc.fileHashSha256.slice(0, 16)}...
                          </code>
                          {doc.isDuplicate && (
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--gov-red)', fontWeight: 700, marginTop: '2px' }}>
                              Duplicate Hash
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700 }}>{doc.extractedFields?.length || 0}</span> {t('applications.docsCount')}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>
                            {doc.ocrConfidence != null ? `${(doc.ocrConfidence * 100).toFixed(1)}%` : t('common.notAvailable')}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={doc.status} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="gov-btn-dossier-sm"
                              title="Download & View Original"
                            >
                              <ExternalLink size={11} />
                              {t('applicationDetail.viewOriginal')}
                            </a>
                            <Link
                              to="/documents/intelligence"
                              className="gov-btn-dossier-sm"
                              title="Inspect extracted fields"
                            >
                              <FileCode size={11} />
                              {t('applicationDetail.inspectFields')}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Regulatory Findings */}
      {activeTab === 'findings' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{t('applicationDetail.findingsTitle')} ({findings.length})</h2>
              <p style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
                {t('applicationDetail.findingsSubtitle')}
              </p>
            </div>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            <div className="gov-table-wrapper">
              <table className="gov-register-table" style={{ minWidth: '920px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px', width: '220px' }}>{t('applicationDetail.findingColRule')}</th>
                    <th style={{ minWidth: '220px' }}>{t('applicationDetail.findingColRef')}</th>
                    <th style={{ minWidth: '140px', width: '150px' }}>{t('applicationDetail.findingColStatus')}</th>
                    <th style={{ minWidth: '100px', width: '110px' }}>{t('applicationDetail.findingColSeverity')}</th>
                    <th style={{ minWidth: '280px' }}>{t('applicationDetail.findingColDesc')}</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{f.rule?.code}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{f.title}</div>
                      </td>
                      <td style={{ verticalAlign: 'top', maxWidth: '240px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', lineHeight: '1.4' }}>
                          {f.rule?.officialSourceReference}
                        </div>
                        {f.rule?.isOfficial ? (
                          <span style={{ fontSize: '10px', color: 'var(--gov-green)', fontWeight: 700 }}>
                            ● {t('compliance.officialTag')}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--gov-amber)', fontWeight: 700 }}>
                            ● {t('compliance.illustrativeTag')}
                          </span>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <StatusBadge status={f.status} />
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            backgroundColor:
                              f.severity === 'CRITICAL'
                                ? 'var(--gov-red-light)'
                                : f.severity === 'MAJOR'
                                ? 'var(--gov-amber-light)'
                                : 'var(--gov-surface-alt)',
                            color:
                              f.severity === 'CRITICAL'
                                ? 'var(--gov-red)'
                                : f.severity === 'MAJOR'
                                ? 'var(--gov-amber)'
                                : 'var(--gov-grey-muted)',
                          }}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <div style={{ fontSize: '13px', color: 'var(--gov-grey-text)' }}>{f.message}</div>

                        {f.evidenceLocation && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '6px 10px',
                              backgroundColor: 'var(--gov-surface-alt)',
                              border: '1px solid var(--gov-border)',
                              borderRadius: '3px',
                              fontSize: '11px',
                              color: 'var(--gov-grey-muted)',
                            }}
                          >
                            <strong>{t('applicationDetail.evidenceLocation')}</strong> {f.evidenceLocation}
                            {f.evidenceSnippet && (
                              <div style={{ marginTop: '2px', fontStyle: 'italic', color: 'var(--gov-grey-text)' }}>
                                "{f.evidenceSnippet}"
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: External Source Verification */}
      {activeTab === 'verification' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Verification Records</h2>
              <p style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
                Display of saved verification records. External registry integrations are not connected in this prototype.
              </p>
            </div>
          </div>

          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {application.verificationRequests?.map((vr: any) => (
                <div
                  key={vr.id}
                  style={{
                    border: '1px solid var(--gov-border)',
                    borderRadius: '4px',
                    padding: '16px',
                    backgroundColor: 'var(--gov-surface-alt)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gov-navy)' }}>
                      {vr.provider.replace(/_/g, ' ')}
                    </span>
                    <StatusBadge status={vr.status} />
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                    Registry Reference ID: <strong>{vr.referenceId}</strong>
                  </div>

                  <div
                    style={{
                      margin: '10px 0',
                      padding: '8px 12px',
                      backgroundColor: 'var(--gov-card)',
                      border: '1px solid var(--gov-border)',
                      borderRadius: '3px',
                      fontSize: '12px',
                      lineHeight: '1.4',
                    }}
                  >
                    {vr.responseSummary}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                    Evidence Ref: {vr.evidenceReference}
                  </div>

                  {vr.isDemoSimulation && (
                    <div
                      style={{
                        marginTop: '8px',
                        display: 'inline-block',
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: 'var(--gov-amber-light)',
                        color: 'var(--gov-amber)',
                        padding: '1px 6px',
                        borderRadius: '2px',
                        border: '1px solid var(--gov-saffron-border)',
                      }}
                    >
                      [DEMO SIMULATION]
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Review History */}
      {activeTab === 'reviews' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{t('applicationDetail.tabReviews')} ({application.reviewActions?.length || 0})</h2>
              <p style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
                Chronological record of scrutiny observations, deficiency notices, and status justifications
              </p>
            </div>
            {isReviewerOrAdmin && (
              <Link to="/reviews" className="btn btn-primary btn-sm">
                Open in Review Workspace
              </Link>
            )}
          </div>

          <div className="panel-body">
            {application.reviewActions?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                No review notes or clarification requests recorded yet for this application.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {application.reviewActions?.map((ra: any) => (
                  <div
                    key={ra.id}
                    style={{
                      borderLeft: '3px solid var(--gov-navy)',
                      backgroundColor: 'var(--gov-surface-alt)',
                      padding: '12px 16px',
                      borderRadius: '0 4px 4px 0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gov-navy)' }}>
                        {ra.actionType.replace(/_/g, ' ')} · By {ra.reviewer.name} ({ra.reviewer.role})
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                        {new Date(ra.createdAt).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {ra.previousStatus && ra.newStatus && (
                      <div style={{ fontSize: '12px', margin: '4px 0', color: 'var(--gov-grey-muted)' }}>
                        Transition: <strong>{ra.previousStatus}</strong> → <strong>{ra.newStatus}</strong>
                      </div>
                    )}

                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gov-grey-text)', marginTop: '4px' }}>
                      Reason: {ra.reason}
                    </div>

                    {ra.notes && (
                      <div style={{ fontSize: '12px', color: 'var(--gov-grey-muted)', marginTop: '4px' }}>
                        Notes: {ra.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{t('applicationDetail.tabAudit')} ({application.auditEvents?.length || 0})</h2>
              <p style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
                Recorded audit events for review and accountability
              </p>
            </div>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            <div className="gov-table-container" style={{ border: 'none' }}>
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>{t('dashboard.auditTimestamp')}</th>
                    <th>{t('dashboard.auditAction')}</th>
                    <th>{t('dashboard.auditActor')}</th>
                    <th>{t('dashboard.auditDetails')}</th>
                  </tr>
                </thead>
                <tbody>
                  {application.auditEvents?.map((ev: any) => (
                    <tr key={ev.id}>
                      <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {new Date(ev.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{ev.action}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{ev.actorName}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)' }}>{ev.actorRole}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                          {ev.afterStateJson ? ev.afterStateJson.slice(0, 120) : 'State recorded'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Consequential Status Transition Modal */}
      {showStatusModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '520px', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <div className="panel-header">
              <h2>{t('applicationDetail.transitionModal.title')}</h2>
            </div>
            <form onSubmit={handleStatusTransition} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">{t('applicationDetail.transitionModal.newStatusLabel')}</label>
                <select
                  className="form-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="VERIFIED_RECOMMENDED">Verified & Recommended (Clear Norms)</option>
                  <option value="DEFICIENCY_FLAGGED">Deficiency Flagged</option>
                  <option value="CLARIFICATION_REQUESTED">Clarification Requested</option>
                  <option value="APPROVED">Approved by Regional Committee</option>
                  <option value="REJECTED_NON_COMPLIANT">Rejected (Non-Compliant)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('applicationDetail.transitionModal.reasonLabel')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('applicationDetail.transitionModal.reasonPlaceholder')}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('applicationDetail.transitionModal.notesLabel')}</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder={t('applicationDetail.transitionModal.notesPlaceholder')}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowStatusModal(false)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? t('applicationDetail.transitionModal.updating') : t('applicationDetail.transitionModal.confirmBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

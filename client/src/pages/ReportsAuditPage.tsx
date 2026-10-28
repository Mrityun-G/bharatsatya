import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { demoMode } from '../services/demoData';
import { Breadcrumb } from '../components/Breadcrumb';
import {
  FileCheck,
  Download,
  Filter,
  Search,
  History,
  FileText,
  Printer,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const ReportsAuditPage: React.FC = () => {
  const { t } = useTranslation();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Audit filter state
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [appRes, auditRes] = await Promise.all([
          api.get('/applications'),
          api.get('/audit', { params: { limit: 50 } }),
        ]);

        if (appRes.data.success && appRes.data.data.length > 0) {
          setApplications(appRes.data.data);
          setSelectedAppId(appRes.data.data[0].id);
        }

        if (auditRes.data.success) {
          setAuditEvents(auditRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load audit data', err);
      } finally {
        setIsLoadingAudit(false);
      }
    }
    loadInitialData();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedAppId) return;
    try {
      setIsGeneratingReport(true);
      const res = await api.get(`/applications/${selectedAppId}/report`);
      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (err) {
      alert('Failed to generate validation report.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!reportData) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${selectedAppId}_Validation_Report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredAudit = auditEvents.filter((ev) => {
    const matchAction = !actionFilter || ev.action.includes(actionFilter);
    const matchEntity = !entityFilter || ev.entityType.includes(entityFilter) || (ev.entityId && ev.entityId.includes(entityFilter));
    return matchAction && matchEntity;
  });

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.reportsAudit') }]} />

      <div style={{ marginBottom: '20px' }}>
        <h1>{t('reports.title')}</h1>
        <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
          {t('reports.subtitle')}
        </p>
      </div>
      {demoMode && <div className="notice-warning" role="note">Synthetic demonstration dossier only. This is not an official certificate, submission, or regulatory decision.</div>}

      {/* Top Dossier Generator Panel */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <h2>{demoMode ? 'Generate Synthetic Demonstration Dossier' : 'Generate Validation Dossier'}</h2>
            <p style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
              {demoMode ? 'Browser-local sample report. It is not signed, official, or a regulatory decision.' : 'Summary of application data and configured validation findings. This is not an approval certificate.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '280px' }}
              value={selectedAppId}
              onChange={(e) => {
                setSelectedAppId(e.target.value);
                setReportData(null);
              }}
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.id} · {app.institution?.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleGenerateReport}
              className="btn btn-primary btn-sm"
              disabled={isGeneratingReport || !selectedAppId}
            >
              <FileCheck size={14} />
              {isGeneratingReport ? 'Compiling Dossier...' : t('reports.generateBtn')}
            </button>
          </div>
        </div>

        {reportData && (
          <div className="panel-body" style={{ backgroundColor: 'var(--gov-surface-alt)', borderTop: '1px solid var(--gov-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '16px' }}>
              <button onClick={handlePrint} className="btn btn-secondary btn-sm">
                <Printer size={13} />
                {t('reports.printBtn')}
              </button>
              <button onClick={handleDownloadJson} className="btn btn-primary btn-sm">
                <Download size={13} />
                {t('reports.downloadJson')}
              </button>
            </div>

            {/* Official Report Certificate Container */}
            <div
              style={{
                backgroundColor: 'var(--gov-card)',
                border: '2px solid var(--gov-navy)',
                padding: '32px',
                borderRadius: '4px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                maxWidth: '900px',
                margin: '0 auto',
              }}
            >
              {/* Header Strip */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--gov-navy)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gov-saffron)', letterSpacing: '0.08em' }}>BHARATSATYA · APPLICATION VALIDATION</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
                  {reportData.reportTitle}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gov-grey-muted)' }}>
                  {reportData.subTitle}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '6px' }}>
                  Report reference: <strong>{reportData.dossierReferenceNumber}</strong> · Generated:{' '}
                  {new Date(reportData.generatedAt).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Institution Particulars */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid var(--gov-border)', paddingBottom: '4px', marginBottom: '8px' }}>
                  1. Institutional Particulars
                </h3>
                <div className="kv-grid">
                  <div className="kv-item">
                    <div className="kv-label">{t('applicationDetail.legalName')}</div>
                    <div className="kv-value">{reportData.institutionDetails.name}</div>
                  </div>
                  <div className="kv-item">
                    <div className="kv-label">{t('applicationDetail.permanentId')}</div>
                    <div className="kv-value">{reportData.institutionDetails.aictePermanentId}</div>
                  </div>
                  <div className="kv-item">
                    <div className="kv-label">{t('applicationDetail.officialAddress')}</div>
                    <div className="kv-value" style={{ fontSize: '12px' }}>{reportData.institutionDetails.address}</div>
                  </div>
                  <div className="kv-item">
                    <div className="kv-label">Application Cycle</div>
                    <div className="kv-value">{reportData.applicationDetails.academicYear}</div>
                  </div>
                </div>
              </div>

              {/* Statutory Documents Checked */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid var(--gov-border)', paddingBottom: '4px', marginBottom: '8px' }}>
                  2. Statutory Documents Checked ({reportData.documentsIntakeSummary.length})
                </h3>
                <div className="gov-table-container report-table-scroll">
                <table className="gov-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>{t('applicationDetail.docColType')}</th>
                      <th>{t('applicationDetail.docColFile')}</th>
                      <th>{t('applicationDetail.docColHash')}</th>
                      <th>Duplicate Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.documentsIntakeSummary.map((doc: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{doc.documentType}</td>
                        <td>{doc.originalName}</td>
                        <td>
                          <code>{doc.sha256Hash.slice(0, 16)}...</code>
                        </td>
                        <td>
                          {doc.isDuplicate ? (
                            <span style={{ color: 'var(--gov-red)', fontWeight: 700 }}>DUPLICATE DETECTED</span>
                          ) : (
                            <span style={{ color: 'var(--gov-green)', fontWeight: 600 }}>Unique Certified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Regulatory Findings */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid var(--gov-border)', paddingBottom: '4px', marginBottom: '8px' }}>
                  3. Automated Regulatory Scrutiny Findings ({reportData.regulatoryFindings.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reportData.regulatoryFindings.map((f: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid var(--gov-border)',
                        borderRadius: '3px',
                        backgroundColor: f.status === 'PASSED' ? 'var(--gov-surface-alt)' : 'var(--gov-red-light)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>
                          {f.ruleCode}: {f.ruleTitle}
                        </span>
                        <span style={{ fontWeight: 700, color: f.status === 'PASSED' ? 'var(--gov-green)' : 'var(--gov-red)' }}>
                          {f.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
                        {f.officialReference}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gov-grey-text)', marginTop: '4px' }}>{f.message}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign-off Seal */}
              <div
                style={{
                  marginTop: '32px',
                  paddingTop: '20px',
                  borderTop: '2px solid var(--gov-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>Generated by:</div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--gov-navy)' }}>
                    {reportData.generatedBy}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)' }}>No digital signature or approval is issued with this report.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Append-Only Audit Trail */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>{demoMode ? 'Synthetic Demo Event History' : t('reports.auditTitle')} ({filteredAudit.length})</h2>
            <p style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
              {demoMode ? 'Browser-local demonstration history; resettable and not an immutable legal audit trail.' : 'Recorded user and system actions, shown with their available actor and timestamp details.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: '200px', height: '32px', fontSize: '12px' }}
              placeholder={t('reports.filterAction')}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
            <input
              type="text"
              className="form-input"
              style={{ width: '200px', height: '32px', fontSize: '12px' }}
              placeholder={t('reports.filterEntity')}
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          <div className="gov-table-container" style={{ border: 'none' }}>
            <table className="gov-table" style={{ minWidth: '920px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '150px', width: '160px' }}>{t('dashboard.auditTimestamp')}</th>
                  <th style={{ minWidth: '170px', width: '180px' }}>Action Identifier</th>
                  <th style={{ minWidth: '160px', width: '180px' }}>{t('dashboard.auditActor')}</th>
                  <th style={{ minWidth: '150px', width: '160px' }}>Entity Type & ID</th>
                  <th style={{ minWidth: '160px' }}>Before State</th>
                  <th style={{ minWidth: '200px' }}>After State / Particulars</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAudit ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                      Querying immutable audit repository...
                    </td>
                  </tr>
                ) : filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>
                      No audit events match the specified filter.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {new Date(ev.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--gov-navy)', fontSize: '12px' }}>
                          {ev.action}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{ev.actorName}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)' }}>{ev.actorRole}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{ev.entityType}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)' }}>{ev.entityId}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.beforeStateJson || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px', color: 'var(--gov-grey-text)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.afterStateJson || '—'}
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
    </div>
  );
};

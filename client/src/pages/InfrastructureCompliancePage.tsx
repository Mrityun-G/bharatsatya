import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';

const RECOMMENDATION: Record<string, { title: string; detail: string; color: string; background: string }> = {
  PHYSICAL_INSPECTION_SUGGESTED: { title: 'Physical inspection suggested', detail: 'At least one facility falls below its configured norm on the submitted evidence.', color: 'var(--gov-red)', background: 'var(--gov-red-light)' },
  ADDITIONAL_EVIDENCE_REQUESTED: { title: 'Additional evidence needed', detail: 'Some facilities could not be measured, or the evidence raised questions.', color: 'var(--gov-amber)', background: 'var(--gov-amber-light)' },
  EVIDENCE_CONSISTENT: { title: 'Evidence consistent with norms', detail: 'Submitted evidence meets every configured infrastructure norm.', color: 'var(--gov-green)', background: 'var(--gov-green-light)' },
  NO_INFRASTRUCTURE_RULES: { title: 'No infrastructure evidence yet', detail: 'Upload a floor plan or photographs, and make sure infrastructure norm rules are active.', color: 'var(--gov-navy)', background: '#EEF2F7' },
};

export const InfrastructureCompliancePage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState<any[]>([]);
  const selectedId = searchParams.get('applicationId') || '';
  const [assessment, setAssessment] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/applications').then((res) => {
      if (!res.data.success) return;
      setApplications(res.data.data);
      if (!selectedId && res.data.data[0]) setSearchParams({ applicationId: res.data.data[0].id }, { replace: true });
    }).catch(() => setError('Applications could not be loaded. Check that the API is running and try again.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setIsLoading(true);
    setError('');
    api.get(`/infrastructure/${encodeURIComponent(selectedId)}`)
      .then((res) => res.data.success && setAssessment(res.data.data))
      .catch(() => { setAssessment(null); setError('The infrastructure assessment could not be loaded for this application.'); })
      .finally(() => setIsLoading(false));
  }, [selectedId]);

  const rec = assessment ? RECOMMENDATION[assessment.recommendation] : null;

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.infrastructureCompliance') }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h1>Infrastructure compliance</h1>
          <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
            Floor plans, photographs and certificates compared with configurable infrastructure norms.
          </p>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: '280px' }}>
          <label className="form-label" htmlFor="infra-app">Application</label>
          <select id="infra-app" className="form-select" value={selectedId} onChange={(e) => setSearchParams({ applicationId: e.target.value })}>
            {applications.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.institution?.name}</option>)}
          </select>
        </div>
      </div>

      <div className="notice-warning" role="note" style={{ marginBottom: '16px' }}>
        {assessment?.advisory || 'Automated observations are advisory. Inspection and approval decisions remain with the competent AICTE authority.'}
      </div>

      {error && <div className="notice-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}

      {isLoading || !assessment ? (
        <div className="panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--gov-grey-muted)' }}>{isLoading ? t('common.loading') : 'Select an application.'}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: '999 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-header"><strong>Requirement vs measured</strong></div>
              <div className="panel-body" style={{ padding: 0 }}>
                <div className="gov-table-container" style={{ border: 'none' }}>
                  <table className="gov-table" style={{ minWidth: '720px' }}>
                    <thead><tr><th>Facility</th><th>Required</th><th>Measured</th><th>Evidence</th><th>Result</th></tr></thead>
                    <tbody>
                      {assessment.norms.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--gov-grey-muted)' }}>No infrastructure norm results. Run validation after uploading a floor plan.</td></tr>
                      ) : assessment.norms.map((n: any) => {
                        const pct = n.required && n.measured !== null ? Math.min(100, (n.measured / n.required) * 100) : 0;
                        return (
                          <tr key={n.id}>
                            <td><div style={{ fontWeight: 600, color: 'var(--gov-navy)' }}>{n.facility}</div><div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>{n.ruleCode}</div></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{n.required ?? '—'} {n.unit}</td>
                            <td style={{ minWidth: '160px' }}>
                              <div style={{ whiteSpace: 'nowrap' }}>{n.measured ?? '—'} {n.measured !== null ? n.unit : ''}</div>
                              {n.measured !== null && (
                                <div style={{ height: '6px', background: '#E5E9EE', borderRadius: '3px', marginTop: '6px' }} role="img" aria-label={`${Math.round(pct)} percent of required`}>
                                  <div style={{ height: '6px', width: `${pct}%`, borderRadius: '3px', background: n.status === 'MISMATCH' ? 'var(--gov-red)' : 'var(--gov-green)' }} />
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: '12px' }}>{n.evidenceLocation || '—'}<div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>{n.message}</div></td>
                            <td><StatusBadge status={n.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><strong>Photo, plan and certificate review</strong></div>
              <div className="panel-body" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {assessment.evidence.length === 0 ? (
                  <div style={{ color: 'var(--gov-grey-muted)', fontSize: '13px' }}>
                    No infrastructure evidence uploaded. <Link to="/documents/intake">Upload a floor plan or photograph</Link>.
                  </div>
                ) : assessment.evidence.map((e: any) => (
                  <figure key={e.id} style={{ margin: 0, border: '1px solid var(--gov-border)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gov-grey-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{e.documentType.replace(/_/g, ' ')}</span>
                      <StatusBadge status={e.result === 'NEEDS_EVIDENCE' ? 'MANUAL_REVIEW_REQUIRED' : e.result === 'NOTED' ? 'PENDING' : 'PASSED'} />
                    </div>
                    <figcaption style={{ fontWeight: 600, color: 'var(--gov-navy)', fontSize: '13px', overflowWrap: 'anywhere' }}>{e.title}</figcaption>
                    {e.measuredFields.map((f: any) => (
                      <div key={f.fieldName} style={{ fontSize: '12px' }}>{f.label}: <strong>{f.value}</strong>{f.isCorrected ? ' (corrected by reviewer)' : ''}</div>
                    ))}
                    {e.observations.length === 0
                      ? <div style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>No issues observed.</div>
                      : e.observations.map((o: any) => (
                        <div key={o.code} style={{ fontSize: '12px' }}><strong style={{ color: o.severity === 'LOW' ? 'var(--gov-grey-text)' : 'var(--gov-amber)' }}>{o.title}.</strong> {o.detail}</div>
                      ))}
                  </figure>
                ))}
              </div>
            </div>
          </div>

          <aside className="panel" style={{ flex: '1 1 300px', minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Suggested next step</h2>
            {rec && (
              <div style={{ padding: '12px 14px', borderRadius: '6px', background: rec.background, color: rec.color }}>
                <div style={{ fontWeight: 700 }}>{rec.title}</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>{rec.detail}</div>
              </div>
            )}
            {assessment.reasons.length > 0 && (
              <>
                <div className="form-label">Reasons</div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                  {assessment.reasons.map((r: string) => <li key={r}>{r}</li>)}
                </ul>
              </>
            )}
            <div style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
              The decision to inspect is taken by the competent authority. Record it from the <Link to={`/applications/${encodeURIComponent(assessment.application.id)}`}>application page</Link>.
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Search } from 'lucide-react';
import api from '../services/api';
import { Breadcrumb } from '../components/Breadcrumb';

interface AnomalyFlag {
  id: string;
  applicationId: string;
  institutionName: string;
  documentId?: string;
  documentName?: string;
  documentType?: string;
  code: string;
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string;
  reason: string;
  nextStep: string;
}

const SEVERITY_STYLE: Record<AnomalyFlag['severity'], { color: string; background: string; label: string }> = {
  HIGH: { color: 'var(--gov-red)', background: 'var(--gov-red-light)', label: 'High' },
  MEDIUM: { color: 'var(--gov-amber)', background: 'var(--gov-amber-light)', label: 'Medium' },
  LOW: { color: 'var(--gov-navy)', background: '#EEF2F7', label: 'Low' },
};

export const AnomalyIndicatorsPage: React.FC = () => {
  const { t } = useTranslation();
  const [flags, setFlags] = useState<AnomalyFlag[]>([]);
  const [summary, setSummary] = useState({ total: 0, high: 0, medium: 0, low: 0, applications: 0 });
  const [disclaimer, setDisclaimer] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const res = await api.get('/anomalies');
        if (res.data.success) {
          setFlags(res.data.data.flags);
          setSummary(res.data.data.summary);
          setDisclaimer(res.data.data.disclaimer);
        }
      } catch {
        setError('Anomaly indicators could not be loaded. Check that the API is running and try again.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const q = search.toLowerCase();
  const visible = flags.filter((f) =>
    (severity === 'ALL' || f.severity === severity) &&
    `${f.applicationId} ${f.institutionName} ${f.documentName || ''} ${f.title}`.toLowerCase().includes(q));

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.anomalyIndicators') }]} />

      <div style={{ marginBottom: '20px' }}>
        <h1>Anomaly &amp; forgery indicators</h1>
        <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
          Suspected alterations, duplicated documents, metadata conflicts, irregular dates and mismatched identifiers, each with its evidence and reason.
        </p>
      </div>

      <div className="notice-warning" role="note" style={{ marginBottom: '16px' }}>
        <strong>Preliminary indicators only.</strong> {disclaimer || 'They are not findings of forgery or misconduct.'} A reviewer must confirm each one, and the issuing authority should verify the document before any adverse action.
      </div>

      {error && <div className="notice-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className="gov-scrutiny-summary-grid" style={{ marginBottom: '20px' }}>
        <div className="gov-metric-cell">
          <div className="metric-header"><span className="metric-title">Indicators</span></div>
          <div className="metric-number text-navy">{summary.total}</div>
          <div className="metric-sub">across {summary.applications} application(s)</div>
        </div>
        <div className="gov-metric-cell">
          <div className="metric-header"><span className="metric-title text-red">High</span></div>
          <div className="metric-number text-red">{summary.high}</div>
          <div className="metric-sub">duplicates, mismatched identifiers, dates</div>
        </div>
        <div className="gov-metric-cell">
          <div className="metric-header"><span className="metric-title text-amber">Medium</span></div>
          <div className="metric-number text-amber">{summary.medium}</div>
          <div className="metric-sub">editing software, appended revisions</div>
        </div>
        <div className="gov-metric-cell">
          <div className="metric-header"><span className="metric-title">Low</span></div>
          <div className="metric-number text-navy">{summary.low}</div>
          <div className="metric-sub">metadata gaps, weak extraction</div>
        </div>
      </div>

      <div className="panel" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
            <Search size={14} color="var(--gov-grey-muted)" style={{ position: 'absolute', left: '10px', top: '12px' }} aria-hidden="true" />
            <label htmlFor="anomaly-search" className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>Search indicators</label>
            <input id="anomaly-search" type="text" className="form-input" style={{ paddingLeft: '32px', width: '100%' }} placeholder="Search application, institution or document" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label htmlFor="anomaly-severity" style={{ position: 'absolute', left: '-9999px' }}>Severity</label>
          <select id="anomaly-severity" className="form-select" style={{ width: '180px' }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="ALL">All severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--gov-grey-muted)' }}>{t('common.loading')}</div>
      ) : visible.length === 0 ? (
        <div className="panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--gov-grey-muted)' }}>
          <ShieldAlert size={22} aria-hidden="true" style={{ marginBottom: '6px' }} />
          <div>No anomaly indicators{flags.length ? ' match these filters' : ' yet. Indicators appear after documents are uploaded and analysed'}.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
          {visible.map((f) => {
            const s = SEVERITY_STYLE[f.severity];
            return (
              <article key={f.id} className="panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                  <h2 style={{ fontSize: '15px', margin: 0 }}>{f.title}</h2>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: s.color, background: s.background, whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>
                  <Link to={`/applications/${encodeURIComponent(f.applicationId)}`} style={{ fontWeight: 700 }}>{f.applicationId}</Link> · {f.institutionName}
                  {f.documentName && <> · {f.documentName}</>}
                </div>
                <dl style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: '6px 10px', margin: 0, fontSize: '13px' }}>
                  <dt style={{ color: 'var(--gov-grey-muted)' }}>Evidence</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px' }}>{f.evidence}</dd>
                  <dt style={{ color: 'var(--gov-grey-muted)' }}>Why flagged</dt><dd style={{ margin: 0 }}>{f.reason}</dd>
                  <dt style={{ color: 'var(--gov-grey-muted)' }}>Next step</dt><dd style={{ margin: 0, fontWeight: 600 }}>{f.nextStep}</dd>
                </dl>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link className="btn btn-secondary btn-sm" to={`/applications/${encodeURIComponent(f.applicationId)}`}>Open application</Link>
                  <Link className="btn btn-secondary btn-sm" to={`/verifications?applicationId=${encodeURIComponent(f.applicationId)}`}>Verify at source</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

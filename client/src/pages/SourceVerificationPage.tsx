import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_INFO: { key: string; label: string; meaning: string }[] = [
  { key: 'VERIFIED', label: 'Verified', meaning: 'The authorized source returned matching details.' },
  { key: 'MISMATCH_DETECTED', label: 'Mismatch detected', meaning: 'The source returned details that differ from the submission.' },
  { key: 'EXPIRED', label: 'Expired', meaning: 'The source confirms the document, but its validity has lapsed.' },
  { key: 'PENDING', label: 'Verification pending', meaning: 'Request sent; awaiting the source response.' },
  { key: 'SOURCE_UNAVAILABLE', label: 'Source unavailable', meaning: 'Portal or API unreachable, or no authorized channel exists.' },
  { key: 'MANUAL_REVIEW_REQUIRED', label: 'Manual review required', meaning: 'Result inconclusive; an official must confirm.' },
];
const CONFIRMABLE = ['PENDING', 'SOURCE_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED'];

const formatTime = (value?: string) => (value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export const SourceVerificationPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'ALL';
  const applicationId = searchParams.get('applicationId') || '';
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<any | null>(null);
  const [form, setForm] = useState({ status: 'VERIFIED', confirmationReference: '', note: '' });
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await api.get('/verifications', { params: { ...(status !== 'ALL' ? { status } : {}), ...(applicationId ? { applicationId } : {}) } });
      if (res.data.success) {
        setItems(res.data.data.items);
        setCounts(res.data.data.counts);
      }
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? 'Source verification is available to reviewers and administrators.'
        : 'Verification records could not be loaded. Check that the API is running and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [status, applicationId]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'ALL') next.delete(key); else next.set(key, value);
    setSearchParams(next);
  };

  const submitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.note.trim().length < 10) { setFormError('Describe how the result was confirmed (at least 10 characters).'); return; }
    if (form.confirmationReference.trim().length < 3) { setFormError('Enter the letter number, certified copy reference or call log ID.'); return; }
    try {
      await api.patch(`/verifications/${confirming.id}/manual`, form);
      setSaved(`Manual confirmation recorded for ${confirming.application?.id || confirming.applicationId}.`);
      setConfirming(null);
      setForm({ status: 'VERIFIED', confirmationReference: '', note: '' });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'The confirmation could not be saved. Try again.');
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.sourceVerification') }]} />

      <div style={{ marginBottom: '20px' }}>
        <h1>Source verification</h1>
        <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
          Documents checked with their original issuing authorities through authorized APIs, portals, QR codes, digital signatures or repositories. Each result records its source, method and time.
        </p>
      </div>

      {error && <div className="notice-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
      {saved && <div className="notice-success" role="status">{saved}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {STATUS_INFO.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter('status', status === s.key ? 'ALL' : s.key)}
            aria-pressed={status === s.key}
            className="panel"
            style={{ padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', outline: status === s.key ? '2px solid var(--gov-navy)' : undefined }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <StatusBadge status={s.key} />
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--gov-navy)' }}>{counts[s.key] ?? 0}</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--gov-grey-muted)' }}>{s.meaning}</span>
          </button>
        ))}
      </div>

      {confirming && (
        <form className="panel" onSubmit={submitConfirmation} style={{ padding: '18px 20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Record manual confirmation</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--gov-grey-muted)' }}>
            {confirming.document?.originalName || confirming.referenceId} · {confirming.application?.id || confirming.applicationId} · {confirming.provider.replace(/_/g, ' ')}
          </p>
          {formError && <div className="notice-error" role="alert">{formError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="manual-status">Confirmed result</label>
              <select id="manual-status" className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="VERIFIED">Verified</option>
                <option value="MISMATCH_DETECTED">Mismatch detected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="manual-ref">Confirmation reference</label>
              <input id="manual-ref" className="form-input" placeholder="e.g. Letter No. DFO/OTY/2026/118" value={form.confirmationReference} onChange={(e) => setForm({ ...form, confirmationReference: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="manual-note">How was it confirmed?</label>
            <textarea id="manual-note" className="form-textarea" rows={3} placeholder="Issuing office replied by letter confirming NOC number and validity." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary">Save confirmation</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setConfirming(null); setFormError(''); }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <strong>Verification requests{applicationId ? ` · ${applicationId}` : ''}</strong>
          {(status !== 'ALL' || applicationId) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearchParams(new URLSearchParams())}>Clear filters</button>
          )}
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="gov-table-container" style={{ border: 'none' }}>
            <table className="gov-table" style={{ minWidth: '960px' }}>
              <thead>
                <tr><th>Document / application</th><th>Source</th><th>Result from source</th><th>Status</th><th>Checked</th><th>Action</th></tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>{t('common.loading')}</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)' }}>No verification requests match. Request one from an application's detail page.</td></tr>
                ) : items.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--gov-navy)' }}>{v.document?.originalName || v.referenceId}</div>
                      <Link to={`/applications/${encodeURIComponent(v.application?.id || v.applicationId)}`} style={{ fontSize: '11px' }}>{v.application?.id || v.applicationId}</Link>
                      <span style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}> · {v.application?.institution?.name}</span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {v.provider.replace(/_/g, ' ')}
                      <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>Ref {v.referenceId}</div>
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '340px' }}>
                      {v.responseSummary}
                      <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>{v.evidenceReference}{v.isDemoSimulation ? ' · simulated source' : ''}</div>
                    </td>
                    <td><StatusBadge status={v.status} /></td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatTime(v.completedAt || v.requestedAt)}
                      {v.requestedBy?.name && <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>by {v.requestedBy.name}</div>}
                    </td>
                    <td>
                      {CONFIRMABLE.includes(v.status) ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setConfirming(v); setFormError(''); setSaved(''); }}>Confirm manually</button>
                      ) : <span style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>Resolved</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

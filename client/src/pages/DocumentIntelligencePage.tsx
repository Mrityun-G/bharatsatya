import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { demoMode } from '../services/demoData';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Edit2,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Info,
  RefreshCw,
  PlusCircle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  FileCheck2,
} from 'lucide-react';

const COMMON_FIELD_OPTIONS = [
  { key: 'REGISTRATION_REF_NO', label: 'Official Registration / Reference Order Number' },
  { key: 'ISSUE_DATE', label: 'Statutory Order Sanction / Issue Date (YYYY-MM-DD)' },
  { key: 'EXPIRY_DATE', label: 'Statutory Order Validity / Expiry Date (YYYY-MM-DD)' },
  { key: 'INSTITUTION_NAME', label: 'Institution / Sponsoring Legal Entity Name' },
  { key: 'AICTE_PERMANENT_ID', label: 'AICTE Permanent Institution ID' },
  { key: 'LAND_AREA_ACRES', label: 'Contiguous Land Area (Acres)' },
  { key: 'FDR_AMOUNT_INR', label: 'Joint FDR Corpus Amount (INR)' },
  { key: 'ISSUING_AUTHORITY', label: 'Statutory Issuing Authority / Competent Department' },
  { key: 'FACULTY_COUNT', label: 'Approved Teaching Faculty Count' },
  { key: 'PROGRAMME_NAME', label: 'Approved Academic Discipline / Programme' },
  { key: 'APPROVED_INTAKE', label: 'Approved Annual Student Intake' },
  { key: 'VALIDITY_STATUS', label: 'Statutory Approval / Certificate Validity Status' },
];

export const DocumentIntelligencePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [currentApp, setCurrentApp] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Field edit state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSavingField, setIsSavingField] = useState(false);

  // Manual field addition state
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState(COMMON_FIELD_OPTIONS[0].key);
  const [newFieldCustomLabel, setNewFieldCustomLabel] = useState(COMMON_FIELD_OPTIONS[0].label);
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newFieldPage, setNewFieldPage] = useState(1);
  const [newFieldReason, setNewFieldReason] = useState('');
  const [isSavingNewField, setIsSavingNewField] = useState(false);

  // Findings filter state
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [findingsScope, setFindingsScope] = useState<'SELECTED' | 'ALL'>('ALL');
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  useEffect(() => {
    async function loadApps() {
      try {
        const res = await api.get('/applications');
        if (res.data.success && res.data.data.length > 0) {
          setApplications(res.data.data);
          setSelectedAppId(res.data.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load apps', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadApps();
  }, []);

  const loadAppDetails = async (appId: string) => {
    try {
      const res = await api.get(`/applications/${appId}`);
      if (res.data.success) {
        setCurrentApp(res.data.data);
        if (res.data.data.documents && res.data.data.documents.length > 0) {
          // If previous selection still exists in the application, keep it, else pick the first
          setSelectedDocId((prev) => {
            const exists = res.data.data.documents.some((d: any) => d.id === prev);
            return exists ? prev : res.data.data.documents[0].id;
          });
        } else {
          setSelectedDocId('');
        }
      }
    } catch (err) {
      console.error('Failed to load details', err);
    }
  };

  useEffect(() => {
    if (selectedAppId) {
      loadAppDetails(selectedAppId);
    }
  }, [selectedAppId]);

  const selectedDocument = currentApp?.documents?.find((d: any) => d.id === selectedDocId);

  const downloadOriginal = async (documentId: string, fileName: string) => {
    try {
      const response = await api.get(`/documents/${documentId}/download`, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error: any) {
      alert(`Unable to download document: ${error.response?.data?.message || error.message}`);
    }
  };

  const startEdit = (field: any) => {
    setEditingFieldId(field.id);
    setEditValue(field.fieldValue);
    setEditReason('');
  };

  const cancelEdit = () => {
    setEditingFieldId(null);
    setEditValue('');
    setEditReason('');
  };

  const saveEdit = async (fieldId: string) => {
    if (!editValue.trim() || !editReason.trim()) {
      alert('Corrected value and reason for modification are required for audit provenance.');
      return;
    }

    try {
      setIsSavingField(true);
      const res = await api.patch(`/documents/fields/${fieldId}`, {
        fieldValue: editValue.trim(),
        reason: editReason.trim(),
      });

      if (res.data.success) {
        cancelEdit();
        setStatusMessage({ type: 'success', text: 'Field value successfully corrected and rules re-evaluated.' });
        await loadAppDetails(selectedAppId);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error updating field: ${err.response?.data?.message || err.message}` });
    } finally {
      setIsSavingField(false);
    }
  };

  const saveNewField = async () => {
    if (!selectedDocId) {
      alert('Please select a target document first.');
      return;
    }
    if (!newFieldValue.trim()) {
      alert('Field value cannot be blank.');
      return;
    }
    if (!newFieldReason.trim() || newFieldReason.trim().length < 3) {
      alert('A valid justification reason (at least 3 characters) is required for audit provenance.');
      return;
    }

    try {
      setIsSavingNewField(true);
      const res = await api.post(`/documents/${selectedDocId}/fields`, {
        fieldName: newFieldKey,
        fieldLabel: newFieldCustomLabel,
        fieldValue: newFieldValue.trim(),
        evidencePage: Number(newFieldPage) || 1,
        reason: newFieldReason.trim(),
      });

      if (res.data.success) {
        setIsAddingField(false);
        setNewFieldValue('');
        setNewFieldReason('');
        setStatusMessage({ type: 'success', text: `Field ${newFieldKey} successfully recorded manually and findings re-evaluated.` });
        await loadAppDetails(selectedAppId);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error adding field: ${err.response?.data?.message || err.message}` });
    } finally {
      setIsSavingNewField(false);
    }
  };

  const handleTriggerRevalidation = async () => {
    if (!selectedAppId) return;
    try {
      setIsRevalidating(true);
      const res = await api.post(`/applications/${selectedAppId}/validate`);
      if (res.data.success) {
        setStatusMessage({
          type: 'success',
          text: `Compliance rules successfully re-evaluated against ${res.data.findingsCount || 'all'} rules. Findings updated.`,
        });
        await loadAppDetails(selectedAppId);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Revalidation failed: ${err.response?.data?.message || err.message}`,
      });
    } finally {
      setIsRevalidating(false);
    }
  };

  // Filter application validation findings
  const allFindings = currentApp?.validationFindings || [];
  const filteredFindings = allFindings.filter((f: any) => {
    if (findingsScope === 'SELECTED' && selectedDocument && f.documentId !== selectedDocument.id && f.documentType !== selectedDocument.documentType) {
      return false;
    }
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) {
      return false;
    }
    if (statusFilter === 'DEFICIENCIES') {
      return f.status !== 'PASSED';
    }
    if (statusFilter !== 'ALL' && f.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.documentIntelligence') }]} />

      {statusMessage && (
        <div
          className={statusMessage.type === 'error' ? 'notice-error' : statusMessage.type === 'success' ? 'notice-success' : 'notice-warning'}
          role="alert"
          style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Institutional Header & Action Strip */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gov-navy)', margin: '0 0 4px' }}>
            {t('documentIntelligence.title', 'Document Intelligence & Evidence Verification Workspace')}
          </h1>
          <p style={{ color: 'var(--gov-grey-muted)', fontSize: '12.5px', margin: 0 }}>
            {t('documentIntelligence.subtitle', 'Inspect extracted statutory evidence, compare against regulatory handbook rules, and record audited corrections.')}
          </p>
        </div>

        {/* Application Selector & Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gov-navy)', textTransform: 'uppercase' }}>
              {t('documentIntelligence.selectApp', 'Application:')}
            </span>
            <select
              className="gov-select"
              style={{ width: '280px', height: '34px', fontSize: '12px' }}
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              disabled={isLoading || isRevalidating}
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.id} · {app.institution?.name}
                </option>
              ))}
            </select>
          </div>

          {(user?.role === 'REVIEWER' || user?.role === 'ADMIN') && (
            <button
              type="button"
              onClick={handleTriggerRevalidation}
              disabled={isRevalidating || !selectedAppId}
              className="btn btn-primary btn-sm"
              title="Re-run all validation rules against current extracted and corrected values"
              style={{ height: '34px' }}
            >
              <RefreshCw size={13} className={isRevalidating ? 'spin' : ''} />
              <span>{isRevalidating ? 'Evaluating...' : 'Re-evaluate Rules'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Document Selection Tabs Strip */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '4px' }}>
        {currentApp?.documents?.map((doc: any) => {
          const isSelected = selectedDocId === doc.id;
          const isFailed = doc.status === 'EXTRACTION_FAILED';
          const fieldsCount = doc.extractedFields?.length || 0;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDocId(doc.id)}
              style={{
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '3px',
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)',
                backgroundColor: isSelected ? 'var(--gov-card)' : 'var(--gov-surface-alt)',
                color: isSelected ? 'var(--gov-navy)' : 'var(--gov-grey-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <FileText size={13} />
              <span>{doc.documentType.replace(/_/g, ' ')}</span>
              <span
                style={{
                  fontSize: '9.5px',
                  padding: '1px 5px',
                  borderRadius: '2px',
                  backgroundColor: isFailed ? '#FEE2E2' : doc.isDuplicate ? '#FEF3C7' : '#E0E7FF',
                  color: isFailed ? '#991B1B' : doc.isDuplicate ? '#92400E' : '#3730A3',
                }}
              >
                {doc.isDuplicate ? 'DUPLICATE' : doc.status} ({fieldsCount})
              </span>
            </button>
          );
        })}
      </div>

      {/* Split Workspace: Left Source Preview & Right Structured Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {/* Left: Document Raw Content, Provenance & OCR Status */}
        <div className="panel" style={{ minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--gov-navy)' }}>
                {t('documentIntelligence.originalSource', 'Original Document Source & Digital Provenance')}
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', marginTop: '2px' }}>
                {selectedDocument ? selectedDocument.originalName : 'No document selected'}
              </div>
            </div>

            {selectedDocument && (
              <button
                type="button"
                onClick={() => downloadOriginal(selectedDocument.id, selectedDocument.originalName)}
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={12} />
                <span>{t('documentIntelligence.downloadOriginal', 'Download Original')}</span>
              </button>
            )}
          </div>

          <div className="panel-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px' }}>
            {selectedDocument ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Provenance Metadata Bar */}
                <div
                  style={{
                    marginBottom: '10px',
                    padding: '8px 10px',
                    backgroundColor: 'var(--gov-surface-alt)',
                    border: '1px solid var(--gov-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <strong>SHA-256 Digest:</strong>{' '}
                    <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{selectedDocument.fileHashSha256}</code>
                  </div>
                  <div>
                    <strong>OCR Confidence:</strong>{' '}
                    <span>
                      {selectedDocument.ocrConfidence != null
                        ? `${(selectedDocument.ocrConfidence * 100).toFixed(1)}%`
                        : 'N/A (PyMuPDF Digital Text)'}
                    </span>
                  </div>
                </div>

                {/* Scanned / OCR Limitation Notice */}
                {(!selectedDocument.ocrRawText || selectedDocument.status === 'EXTRACTION_FAILED') && (
                  <div
                    className="notice-warning"
                    role="note"
                    style={{ marginBottom: '10px', fontSize: '11.5px', lineHeight: 1.45 }}
                  >
                    <AlertTriangle size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    <strong>OCR Limitation:</strong> Embedded digital text was not detected in this uploaded file. If Tesseract OCR is unavailable or the document is a scanned image, automated field extraction is safely paused. A reviewer manual-entry path is provided on the right to record certified values directly from the source scan.
                  </div>
                )}

                {/* Raw Extracted Text View */}
                <div
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#E2E8F0',
                    fontFamily: 'Consolas, "Courier New", monospace',
                    fontSize: '11.5px',
                    padding: '12px 14px',
                    borderRadius: '3px',
                    flex: 1,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '380px',
                    lineHeight: '1.55',
                    border: '1px solid var(--gov-border)',
                  }}
                >
                  {selectedDocument.ocrRawText || t('documentIntelligence.noText', 'No readable text was extracted from this document. Use the manual entry form to record field values.')}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gov-grey-muted)', fontSize: '12px' }}>
                Select a document from the tab list above to inspect source text.
              </div>
            )}
          </div>
        </div>

        {/* Right: Extracted Structured Fields & Audit Correction */}
        <div className="panel" style={{ minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--gov-navy)' }}>
                {t('documentIntelligence.structuredFields', 'Extracted Structured Fields & Provenance')}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', margin: '2px 0 0' }}>
                Deterministic field values with evidence snippets and reviewer audit trail
              </p>
            </div>

            {selectedDocument && (user?.role === 'REVIEWER' || user?.role === 'ADMIN') && (
              <button
                type="button"
                onClick={() => setIsAddingField((v) => !v)}
                className="btn btn-secondary btn-sm"
                title="Manually record a statutory field missed by OCR or extraction"
              >
                <PlusCircle size={12} />
                <span>{isAddingField ? 'Cancel Entry' : 'Record Field'}</span>
              </button>
            )}
          </div>

          <div className="panel-body" style={{ flex: 1, overflowY: 'auto', maxHeight: '430px', padding: '12px 14px' }}>
            {/* Manual Field Entry Drawer / Form */}
            {isAddingField && selectedDocument && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px',
                  backgroundColor: 'var(--gov-surface-alt)',
                  border: '1px solid var(--gov-navy)',
                  borderRadius: '3px',
                }}
              >
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--gov-navy)', marginBottom: '8px' }}>
                  Manual Statutory Field Entry (Audited)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '10.5px' }}>Field Definition</label>
                    <select
                      className="gov-select"
                      style={{ height: '30px', fontSize: '11px' }}
                      value={newFieldKey}
                      onChange={(e) => {
                        const opt = COMMON_FIELD_OPTIONS.find((o) => o.key === e.target.value);
                        setNewFieldKey(e.target.value);
                        if (opt) setNewFieldCustomLabel(opt.label);
                      }}
                    >
                      {COMMON_FIELD_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.key} ({opt.label.slice(0, 32)}…)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '10.5px' }}>Source Page Reference</label>
                    <input
                      type="number"
                      min={1}
                      className="gov-input"
                      style={{ height: '30px', fontSize: '11px' }}
                      value={newFieldPage}
                      onChange={(e) => setNewFieldPage(parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '10.5px' }}>Field Value (as certified in document scan)</label>
                  <input
                    type="text"
                    className="gov-input"
                    style={{ height: '30px', fontSize: '11.5px' }}
                    placeholder="e.g. 5.25 or 2026-06-30 or 1-10923481"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '10.5px' }}>Mandatory Justification Reason (Audit Trail)</label>
                  <input
                    type="text"
                    className="gov-input"
                    style={{ height: '30px', fontSize: '11px' }}
                    placeholder="Justification for recording manual field entry..."
                    value={newFieldReason}
                    onChange={(e) => setNewFieldReason(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={saveNewField}
                    disabled={isSavingNewField}
                    className="btn btn-primary btn-sm"
                  >
                    <Check size={11} />
                    <span>{isSavingNewField ? 'Saving...' : 'Save & Re-evaluate'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingField(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    <X size={11} />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Extracted Fields */}
            {!selectedDocument || selectedDocument.extractedFields?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)', fontSize: '12px' }}>
                No structured fields extracted from this document. Use the "Record Field" button above to enter certified statutory values manually.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDocument.extractedFields?.map((field: any) => (
                  <div
                    key={field.id}
                    style={{
                      border: '1px solid var(--gov-border)',
                      borderRadius: '3px',
                      padding: '10px 12px',
                      backgroundColor: field.isCorrected ? 'var(--gov-surface-alt)' : 'var(--gov-card)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gov-grey-text)', textTransform: 'uppercase' }}>
                          {field.fieldLabel}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)' }}>
                          Key: <code>{field.fieldName}</code> · Page {field.evidencePage || 1}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '2px',
                            backgroundColor: field.isCorrected ? '#FEF3C7' : '#EFF6FF',
                            color: field.isCorrected ? '#92400E' : '#1E40AF',
                          }}
                        >
                          {field.isCorrected ? 'REVIEWER CORRECTED' : 'EXTRACTED'}
                        </span>

                        {editingFieldId !== field.id && (user?.role === 'REVIEWER' || user?.role === 'ADMIN') && (
                          <button
                            onClick={() => startEdit(field)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', height: '24px' }}
                            title="Correct extraction value with mandatory reason"
                          >
                            <Edit2 size={11} />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {editingFieldId === field.id ? (
                      /* Field Edit Form */
                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--gov-card)', border: '1px solid var(--gov-border)', borderRadius: '2px' }}>
                        <div style={{ marginBottom: '6px' }}>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>Corrected Field Value</label>
                          <input
                            type="text"
                            className="gov-input"
                            style={{ height: '30px', fontSize: '12px' }}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>Mandatory Justification Reason (Audit Trail)</label>
                          <input
                            type="text"
                            className="gov-input"
                            style={{ height: '30px', fontSize: '11px' }}
                            placeholder="Mandatory reason for manual correction..."
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => saveEdit(field.id)}
                            className="btn btn-primary btn-sm"
                            disabled={isSavingField}
                          >
                            <Check size={11} />
                            <span>{isSavingField ? 'Saving...' : 'Save & Re-evaluate'}</span>
                          </button>
                          <button onClick={cancelEdit} className="btn btn-secondary btn-sm">
                            <X size={11} />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Field View */
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gov-navy)' }}>
                          {field.fieldValue}
                        </div>

                        {field.isCorrected && (
                          <div
                            style={{
                              marginTop: '4px',
                              padding: '4px 6px',
                              backgroundColor: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              borderRadius: '2px',
                              fontSize: '10.5px',
                              color: '#92400E',
                            }}
                          >
                            <strong>Reviewer Override:</strong> Original OCR extracted value was{' '}
                            <em>"{field.originalExtractedValue}"</em>
                            {field.correctedAt && (
                              <span> · Corrected on {new Date(field.correctedAt).toLocaleDateString('en-IN')}</span>
                            )}
                          </div>
                        )}

                        {field.evidenceSnippet && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '5px 8px',
                              backgroundColor: 'var(--gov-surface-alt)',
                              border: '1px solid var(--gov-border)',
                              borderRadius: '2px',
                              fontSize: '10.5px',
                              color: 'var(--gov-grey-muted)',
                            }}
                          >
                            <strong>Evidence Quote (Page {field.evidencePage || 1}):</strong>{' '}
                            <em>"{field.evidenceSnippet}"</em>
                            {field.evidenceCoordinates && (
                              <span style={{ marginLeft: '8px' }}>
                                Bounding Box: <code>{field.evidenceCoordinates}</code>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Evidence-Linked Regulatory Validation Findings Section */}
      <div className="panel" style={{ marginBottom: '20px' }}>
        <div className="panel-header" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--gov-navy)' }}>
              Evidence-Based Regulatory Compliance Findings ({filteredFindings.length})
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--gov-grey-muted)', margin: '2px 0 0' }}>
              Automated deterministic rule evaluation results with expected vs observed evidence and recommended officer actions
            </p>
          </div>

          {/* Finding Filter Controls */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="gov-select"
              style={{ height: '30px', fontSize: '11px', width: '130px' }}
              value={findingsScope}
              onChange={(e) => setFindingsScope(e.target.value as any)}
            >
              <option value="ALL">All Application Findings</option>
              <option value="SELECTED">Selected Document Only</option>
            </select>

            <select
              className="gov-select"
              style={{ height: '30px', fontSize: '11px', width: '110px' }}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="MAJOR">MAJOR</option>
              <option value="MINOR">MINOR</option>
              <option value="INFO">INFO</option>
            </select>

            <select
              className="gov-select"
              style={{ height: '30px', fontSize: '11px', width: '130px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DEFICIENCIES">All Deficiencies</option>
              <option value="PASSED">PASSED</option>
              <option value="MISSING">MISSING</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="MISMATCH">MISMATCH</option>
              <option value="MANUAL_REVIEW_REQUIRED">MANUAL REVIEW</option>
            </select>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {filteredFindings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gov-grey-muted)', fontSize: '12px' }}>
              No validation findings match the selected filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="gov-table" style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gov-surface-alt)', borderBottom: '1px solid var(--gov-border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: '100px' }}>Rule Code</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '80px' }}>Severity</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Status</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Regulatory Assessment & Finding</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: '220px' }}>Evidence Comparison</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: '200px' }}>Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((finding: any) => {
                    const isDeficient = finding.status !== 'PASSED';
                    let comparisonData: any = null;
                    try {
                      comparisonData = finding.evidenceComparisonJson ? JSON.parse(finding.evidenceComparisonJson) : null;
                    } catch {
                      comparisonData = null;
                    }

                    return (
                      <tr
                        key={finding.id}
                        style={{
                          borderBottom: '1px solid var(--gov-border)',
                          backgroundColor: isDeficient ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          <span style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>
                            {finding.rule?.code || finding.ruleCode || 'RULE'}
                          </span>
                          <div style={{ fontSize: '9.5px', color: 'var(--gov-grey-muted)' }}>
                            v{finding.ruleVersion?.version || finding.rule?.version || 1}
                          </div>
                        </td>

                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                          <span className={`status-badge status-${finding.severity?.toLowerCase()}`}>
                            {finding.severity}
                          </span>
                        </td>

                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                          <span className={`status-badge status-${finding.status?.toLowerCase().replace(/_/g, '-')}`}>
                            {finding.status}
                          </span>
                        </td>

                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: 'var(--gov-navy)', marginBottom: '2px' }}>
                            {finding.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--gov-grey-text)', lineHeight: 1.4 }}>
                            {finding.message}
                          </div>
                          {finding.evidenceLocation && (
                            <div style={{ fontSize: '10px', color: 'var(--gov-grey-muted)', marginTop: '3px' }}>
                              Ref: <code>{finding.evidenceLocation}</code>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '8px 10px', verticalAlign: 'top', fontSize: '10.5px' }}>
                          {comparisonData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {comparisonData.expectedPermanentId && (
                                <div><strong>Expected ID:</strong> {comparisonData.expectedPermanentId}</div>
                              )}
                              {comparisonData.observedPermanentId && (
                                <div><strong>Observed ID:</strong> {comparisonData.observedPermanentId}</div>
                              )}
                              {comparisonData.expectedFields && (
                                <div><strong>Expected Fields:</strong> {comparisonData.expectedFields.join(', ')}</div>
                              )}
                              {comparisonData.missingFields && (
                                <div style={{ color: 'var(--gov-red)' }}><strong>Missing:</strong> {comparisonData.missingFields.join(', ')}</div>
                              )}
                              {comparisonData.referenceDate && (
                                <div><strong>Norm Ref Date:</strong> {comparisonData.referenceDate}</div>
                              )}
                              {comparisonData.extractedExpiryDate && (
                                <div><strong>Extracted Date:</strong> {comparisonData.extractedExpiryDate}</div>
                              )}
                              {comparisonData.minimum && (
                                <div><strong>Min Norm:</strong> {comparisonData.minimum}</div>
                              )}
                              {comparisonData.actual && (
                                <div><strong>Actual:</strong> {comparisonData.actual}</div>
                              )}
                              {comparisonData.duplicate && (
                                <div style={{ color: 'var(--gov-red)' }}><strong>Duplicate of:</strong> {comparisonData.original}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--gov-grey-muted)' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '8px 10px', verticalAlign: 'top', fontSize: '11px' }}>
                          <span style={{ color: isDeficient ? 'var(--gov-navy)' : 'var(--gov-grey-muted)' }}>
                            {comparisonData?.recommendedAction || (isDeficient ? 'Inspect source scan or issue statutory query' : 'Compliant with statutory norm')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Traceable Audit Trail Section */}
      <div className="panel">
        <div
          className="panel-header"
          onClick={() => setShowAuditTrail((v) => !v)}
          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={14} color="var(--gov-navy)" />
            <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--gov-navy)' }}>
              Traceable Regulatory Audit Trail & Evidence Provenance ({currentApp?.auditEvents?.length || 0})
            </h2>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--gov-navy)', fontWeight: 600 }}>
            {showAuditTrail ? 'Collapse Audit History ▲' : 'View Audit History ▼'}
          </span>
        </div>

        {showAuditTrail && (
          <div className="panel-body" style={{ padding: 0 }}>
            {!currentApp?.auditEvents || currentApp.auditEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--gov-grey-muted)', fontSize: '12px' }}>
                No audit events recorded for this application dossier.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="gov-table" style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--gov-surface-alt)', borderBottom: '1px solid var(--gov-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', width: '150px' }}>Timestamp (IST)</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', width: '160px' }}>Officer / Actor</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', width: '180px' }}>Action</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Audit Provenance Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentApp.auditEvents.map((event: any) => {
                      let afterState: any = null;
                      try {
                        afterState = event.afterStateJson ? JSON.parse(event.afterStateJson) : null;
                      } catch {
                        afterState = null;
                      }
                      return (
                        <tr key={event.id} style={{ borderBottom: '1px solid var(--gov-border)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--gov-grey-muted)' }}>
                            {new Date(event.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{event.actorName}</span>
                            <div style={{ fontSize: '9.5px', color: 'var(--gov-grey-muted)' }}>{event.actorRole}</div>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <code>{event.action}</code>
                          </td>
                          <td style={{ padding: '6px 10px', fontSize: '10.5px' }}>
                            {afterState?.reason && (
                              <div><strong>Justification:</strong> {afterState.reason}</div>
                            )}
                            {afterState?.fieldValue && (
                              <div><strong>Recorded Value:</strong> {afterState.fieldValue}</div>
                            )}
                            {afterState?.status && (
                              <div><strong>Status Transition:</strong> {afterState.status}</div>
                            )}
                            {afterState?.sha256 && (
                              <div><strong>SHA-256 Digest:</strong> <code>{afterState.sha256}</code></div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

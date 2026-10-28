import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { demoMode } from '../services/demoData';
import { Breadcrumb } from '../components/Breadcrumb';
import {
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileX,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const DocumentIntakePage: React.FC = () => {
  const { t } = useTranslation();
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationLoadError, setApplicationLoadError] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [documentType, setDocumentType] = useState('LAND_TITLE_DEED');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    async function loadApps() {
      try {
        const res = await api.get('/applications');
        if (res.data.success && res.data.data.length > 0) {
          setApplications(res.data.data);
          setSelectedAppId(res.data.data[0].id);
        } else if (res.data.success) {
          setApplications([]);
        }
      } catch (err) {
        console.error('Failed to load applications', err);
        setApplicationLoadError('Applications could not be loaded. Upload is unavailable until the API connection is restored.');
      } finally {
        setIsLoadingApplications(false);
      }
    }
    loadApps();
  }, []);

  const selectedApp = applications.find((a) => a.id === selectedAppId);

  // Illustrative document categories only; authoritative requirements depend on verified rules.
  const requiredChecklist = [
    { type: 'LAND_TITLE_DEED', name: 'Land title or lease document' },
    { type: 'BUILDING_PLAN_APPROVAL', name: 'Building plan approval document' },
    { type: 'FIRE_SAFETY_NOC', name: 'Fire safety certificate or NOC' },
    { type: 'OCCUPANCY_CERTIFICATE', name: 'Occupancy or building safety document' },
    { type: 'SOCIETY_TRUST_REGISTRATION', name: 'Society or trust registration document' },
    { type: 'FDR_FINANCIAL_ENDOWMENT', name: 'Financial endowment document' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selected: File) => {
    setUploadError(null);
    setUploadResult(null);

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(selected.type)) {
      setUploadError(`Unsupported file format: ${selected.type}. Only PDF, PNG, and JPEG documents are accepted.`);
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds the 10 MB upload limit. Choose a smaller file and try again.');
      return;
    }

    setFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedAppId || !documentType) {
      setUploadError('Please select an application, document type, and valid file.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', selectedAppId);
      formData.append('documentType', documentType);
      formData.append('title', title || file.name);

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setUploadResult(res.data.data);
        setFile(null);
        setTitle('');
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Upload processing failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: t('sidebar.documentIntake') }]} />
      {applicationLoadError && <div className="notice-error" role="alert">{applicationLoadError}</div>}
      {demoMode && <div className="notice-warning" role="note">Demo intake stores only synthetic file metadata in this browser. The selected binary is not uploaded, retained, hashed, or processed; any displayed field is a synthetic preview, not OCR output.</div>}

      <div style={{ marginBottom: '20px' }}>
        <h1>{t('documentIntake.title')}</h1>
        <p style={{ color: 'var(--gov-grey-muted)', fontSize: '13px', marginTop: '2px' }}>
          {t('documentIntake.subtitle')}
        </p>
      </div>

      <div className="responsive-two-column" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Upload Form Panel */}
        <div className="panel">
          <div className="panel-header">
            <h2>{t('documentIntake.title')}</h2>
          </div>

          <form onSubmit={handleUpload} style={{ padding: '20px' }}>
            {uploadError && <div className="notice-error" role="alert">{uploadError}</div>}

            {uploadResult && (
              <div
                style={{
                  backgroundColor: 'var(--gov-green-light)',
                  color: 'var(--gov-green)',
                  border: '1px solid var(--gov-green-border)',
                  padding: '12px 14px',
                  borderRadius: '3px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  {demoMode ? 'Synthetic Document Metadata Added' : t('documentIntake.successTitle')}
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--gov-green)' }}>
                  {demoMode ? 'No file was uploaded or processed. No checksum was calculated.' : <>{t('documentIntake.checksum')} <code>{uploadResult.document.fileHashSha256}</code></>}
                </div>
                {uploadResult.isDuplicate && (
                  <div style={{ color: 'var(--gov-red)', fontWeight: 700, marginTop: '4px', fontSize: '11px' }}>
                    WARNING: Duplicate byte-level hash match identified across application repository.
                  </div>
                )}
                <div style={{ marginTop: '8px' }}>
                  <a href={`/applications/${selectedAppId}`} className="btn btn-secondary btn-sm">
                    {t('common.inspectDossier')}
                    <ArrowRight size={12} />
                  </a>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="intake-application">{t('documentIntake.selectApp')}</label>
              <select
                id="intake-application"
                className="form-select"
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                required
              >
                {isLoadingApplications && <option value="">Loading applications…</option>}
                {!isLoadingApplications && applications.length === 0 && <option value="">No applications available</option>}
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.id} — {app.institution?.name} ({app.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="intake-document-type">{t('documentIntake.selectType')}</label>
              <select
                id="intake-document-type"
                className="form-select"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                required
              >
                <option value="LAND_TITLE_DEED">Registered Land Title / Lease Deed</option>
                <option value="FIRE_SAFETY_NOC">Fire Safety Clearance NOC</option>
                <option value="BUILDING_PLAN_APPROVAL">Municipal Building Sanction Order & Plans</option>
                <option value="OCCUPANCY_CERTIFICATE">Structural Stability & Occupancy Certificate</option>
                <option value="SOCIETY_TRUST_REGISTRATION">Society / Public Trust Registration Deed</option>
                <option value="FDR_FINANCIAL_ENDOWMENT">Joint AICTE Fixed Deposit Receipt (FDR)</option>
                <option value="AICTE_PREVIOUS_EOA">Previous Academic Year Extension of Approval (EOA)</option>
                <option value="FLOOR_PLAN">Infrastructure Floor Plan (with room areas)</option>
                <option value="INFRASTRUCTURE_PHOTO">Infrastructure Photograph (classroom, lab, library)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="intake-description">Document Description</label>
              <input
                id="intake-description"
                type="text"
                className="form-input"
                placeholder="e.g. Registered Sale Deed Vol 12 - 5.25 Acres"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`upload-drop-zone${isDragging ? ' is-dragging' : ''}`}
            >
              <UploadCloud size={25} color="var(--gov-navy)" />
              <div className="upload-prompt">
                {file ? file.name : t('documentIntake.dropPrompt')}
              </div>
              <div className="upload-help">
                {t('documentIntake.supportedFormats')}
              </div>

              <div className="upload-picker-wrap">
                <label className="btn btn-secondary btn-sm upload-picker">
                  Choose a file
                  <input
                    type="file"
                    className="visually-hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {file && (
                <div className="upload-selected-file">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px' }}
              disabled={isUploading || !file || !selectedAppId || isLoadingApplications || !!applicationLoadError}
            >
              {isUploading ? (demoMode ? 'Recording synthetic metadata...' : t('documentIntake.uploading')) : (demoMode ? 'Add Synthetic Metadata to Demo' : t('documentIntake.uploadBtn'))}
            </button>
          </form>
        </div>

        {/* Regulatory Intake Checklist for Selected Application */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{t('documentIntake.guidanceTitle')}</h2>
              <p style={{ fontSize: '11px', color: 'var(--gov-grey-muted)' }}>
                Illustrative document categories for {selectedApp?.category || 'the selected category'}; not an official completeness determination.
              </p>
            </div>
          </div>

          <div className="panel-body" style={{ padding: '16px' }}>
            <ul className="document-guidance-list">
              {requiredChecklist.map((item, idx) => (
                <li key={idx}>
                  <FileText size={15} color="var(--gov-sage)" />
                  <div>
                    <div className="document-guidance-title">
                      {item.name}
                    </div>
                    <div className="document-guidance-code">{item.type.replace(/_/g, ' ').toLowerCase()}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'var(--gov-saffron-light)',
                border: '1px solid var(--gov-saffron-border)',
                borderRadius: '5px',
                fontSize: '11px',
                color: 'var(--gov-text)',
                lineHeight: '1.4',
              }}
            >
              <strong>{demoMode ? 'Prototype guidance:' : 'Storage note:'}</strong> {demoMode
                ? 'The selected file is not uploaded or saved in demo mode; only synthetic metadata is persisted in this browser.'
                : t('documentIntake.prototypeNotice')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

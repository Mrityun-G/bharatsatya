import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ExtractedFieldItem, DocumentType } from '../types/index.js';

const execFileAsync = promisify(execFile);

export interface ParseResult {
  rawText: string;
  confidence: number | null;
  fields: ExtractedFieldItem[];
  error?: string;
  isRecoverable: boolean;
}

export function normalizeDate(dateStr: string): string | null {
  const m = dateStr?.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return dateStr || null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// Regex extraction identifies candidate values; it does not provide a calibrated
// confidence score, so confidence is deliberately null.
export function fallbackExtractFields(text: string, documentType: DocumentType): ExtractedFieldItem[] {
  const fields: ExtractedFieldItem[] = [];
  const add = (fieldName: string, fieldLabel: string, value: string, snippet: string) => fields.push({
    fieldName, fieldLabel, fieldValue: value, originalExtractedValue: value,
    confidence: null, evidencePage: 1, evidenceSnippet: snippet,
  });
  const match = (regex: RegExp) => regex.exec(text);
  // Prefer an explicit label; otherwise the whole proper-noun phrase around the keyword
  // ("Vidya Jyothi Institute of Technology"), not just the word that follows it.
  const name = match(/(?:Name\s+of\s+(?:the\s+)?(?:Institution|Institute|College|Society|Trust)|(?:Institution|Institute|College|Society|Trust|Establishment)\s+Name)\s*[:\-]\s*([^\n]{3,100})/i)
    || /((?:[A-Z][A-Za-z.&'\-]*\s+){0,6}(?:Institute|College|University|Polytechnic|Academy|School|Society|Trust)(?:\s+(?:of|for)(?:\s+(?:[A-Z][A-Za-z.&'\-]*|and|&)){1,6})?)/.exec(text);
  if (name) add('INSTITUTION_NAME', 'Institution / Sponsoring Legal Entity Name', name[1].trim().split('\n')[0].replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, ''), name[0]);
  const ref = match(/(?:Reg(?:istration)?\s*(?:No|Number)|Certificate\s*No|Order\s*No|NOC\s*No|Ref\s*No)[:\-]?\s*([A-Z0-9/\-_]{4,35})/i);
  if (ref) add('REGISTRATION_REF_NO', 'Official Registration / Reference Order Number', ref[1].trim(), ref[0]);
  const expiry = match(/(?:Valid\s*(?:Up\s*To|Until|Upto|through)|Expiry\s*Date|Certificate\s*Valid\s*Till)[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (expiry) {
    const value = normalizeDate(expiry[1]) || expiry[1];
    add('EXPIRY_DATE', 'Statutory Order Validity / Expiry Date', value, expiry[0]);
    if (documentType === 'FIRE_SAFETY_NOC') add('FIRE_NOC_EXPIRY_DATE', 'Fire Safety NOC Validity / Expiry Date', value, expiry[0]);
  }
  if (documentType === 'LAND_TITLE_DEED') {
    const area = match(/(\d+(?:\.\d+)?)\s*(?:Acres?|Ac\b)/i);
    if (area) add('LAND_AREA_ACRES', 'Contiguous Land Area (Acres)', area[1], area[0]);
  }
  if (documentType === 'FLOOR_PLAN') {
    const area = (label: string) => match(new RegExp(`${label}[^\\n\\d]{0,40}?(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*m|sqm|m2|m²|square\\s*met)`, 'i'));
    const library = area('Library|Reading\\s*Room');
    if (library) add('LIBRARY_AREA_SQM', 'Library and Reading Room Area (m²)', library[1].replace(/,/g, ''), library[0]);
    const classroom = area('Class\\s*rooms?');
    if (classroom) add('CLASSROOM_AREA_SQM', 'Total Classroom Area (m²)', classroom[1].replace(/,/g, ''), classroom[0]);
  }
  if (documentType === 'FDR_FINANCIAL_ENDOWMENT') {
    const amount = match(/(?:Amount|Principal|Sum\s*of)\s*(?:INR|Rs\.?)?\s*([0-9,]+(?:\.\d{2})?)/i);
    if (amount) add('FDR_AMOUNT_INR', 'Joint FDR Corpus Amount (INR)', amount[1].replace(/,/g, ''), amount[0]);
  }
  const auth = match(/(?:Issuing\s*Authority|Issued\s*By|Competent\s*Authority|Sanctioning\s*Authority|Directorate\s*of|Department\s*of)[:\-]?\s*([A-Za-z0-9\s.,&'\-]{5,80})/i);
  if (auth) add('ISSUING_AUTHORITY', 'Statutory Issuing Authority / Competent Department', auth[1].trim().split('\n')[0], auth[0]);
  const fac = match(/(?:Faculty\s*Count|Total\s*Faculty|Teaching\s*Faculty|Approved\s*Faculty|Faculty\s*Members?)[:\-]?\s*(\d{1,4})/i);
  if (fac) add('FACULTY_COUNT', 'Approved Teaching Faculty Count', fac[1], fac[0]);
  const prog = match(/(?:Programme|Program|Course|Discipline)\s*(?:Name)?[:\-]?\s*([A-Za-z0-9\s.,&'\-]{3,60})/i);
  if (prog) add('PROGRAMME_NAME', 'Approved Academic Discipline / Programme', prog[1].trim().split('\n')[0], prog[0]);
  const pid = match(/(?:AICTE\s*(?:Permanent\s*ID|PID|Perm\s*ID)|Permanent\s*(?:Institute\s*ID|Institution\s*ID|ID))[:\-]?\s*([1-9][0-9\-_]{3,20}|AICTE-[A-Z0-9\-_]+)/i);
  if (pid) add('AICTE_PERMANENT_ID', 'AICTE Permanent Institution ID', pid[1].trim(), pid[0]);
  const appRef = match(/(?:Application\s*(?:Ref(?:erence)?\s*(?:No|Number|ID)?|Number|No|ID)|Dossier\s*(?:Ref|No))[:\-]?\s*([A-Z0-9\-_/]{4,35})/i);
  if (appRef) add('APPLICATION_REF_NO', 'Application Reference / Dossier Number', appRef[1].trim(), appRef[0]);
  const intake = match(/(?:Approved\s*(?:Intake|Capacity|Seats)|Annual\s*Intake|Sanctioned\s*Intake|Intake)[:\-]?\s*(\d{1,5})/i);
  if (intake) add('APPROVED_INTAKE', 'Approved Annual Student Intake', intake[1].trim(), intake[0]);
  const validity = match(/(?:Validity\s*Status|Approval\s*Status|Order\s*Status|Clearance\s*Status)[:\-]?\s*(APPROVED|VALID|GRANTED|SUBSISTING|PROVISIONAL|EXTENDED|COMPLIANT)/i);
  if (validity) add('VALIDITY_STATUS', 'Statutory Approval / Certificate Validity Status', validity[1].trim().toUpperCase(), validity[0]);
  return fields;
}

export async function parseDocumentFile(filePath: string, mimeType: string, documentType: DocumentType): Promise<ParseResult> {
  if (!fs.existsSync(filePath)) return { rawText: '', confidence: null, fields: [], error: 'Document file not found.', isRecoverable: true };
  if (fs.statSync(filePath).size === 0) return { rawText: '', confidence: null, fields: [], error: 'Uploaded file is empty.', isRecoverable: true };

  const pythonScript = path.join(path.dirname(__filename), 'ocr_service.py');
  if (!fs.existsSync(pythonScript)) return { rawText: '', confidence: null, fields: [], error: 'Document extraction service is not installed.', isRecoverable: true };
  try {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout } = await execFileAsync(python, [pythonScript, filePath, documentType], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
    const result = JSON.parse(stdout.trim());
    return {
      rawText: typeof result.rawText === 'string' ? result.rawText : '',
      confidence: typeof result.confidence === 'number' ? result.confidence : null,
      fields: Array.isArray(result.fields) ? result.fields : [],
      error: result.error || undefined,
      isRecoverable: result.isRecoverable !== false,
    };
  } catch (error: any) {
    return { rawText: '', confidence: null, fields: [], error: `Document extraction failed: ${error.message || 'OCR service error'}. Manual field entry is permitted.`, isRecoverable: true };
  }
}

function parseRemoteResult(payload: any): ParseResult {
  if (!payload || typeof payload.rawText !== 'string' || !Array.isArray(payload.fields)) {
    throw new Error('OCR service returned an invalid response.');
  }
  return {
    rawText: payload.rawText,
    confidence: typeof payload.confidence === 'number' && Number.isFinite(payload.confidence) ? payload.confidence : null,
    fields: payload.fields,
    error: typeof payload.error === 'string' ? payload.error : undefined,
    isRecoverable: payload.isRecoverable !== false,
  };
}

async function parseWithRemoteService(content: Buffer, mimeType: string, documentType: DocumentType): Promise<ParseResult> {
  const endpoint = process.env.OCR_SERVICE_URL?.replace(/\/$/, '');
  const token = process.env.OCR_SERVICE_TOKEN;
  if (!endpoint || !token || token.length < 32) return { rawText: '', confidence: null, fields: [], error: 'Separate OCR service is not fully configured.', isRecoverable: true };
  try {
    const parsedEndpoint = new URL(endpoint);
    if (parsedEndpoint.username || parsedEndpoint.password || parsedEndpoint.search || parsedEndpoint.hash ||
      ((process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') && parsedEndpoint.protocol !== 'https:')) {
      return { rawText: '', confidence: null, fields: [], error: 'OCR service endpoint configuration is invalid.', isRecoverable: true };
    }
  } catch {
    return { rawText: '', confidence: null, fields: [], error: 'OCR service endpoint configuration is invalid.', isRecoverable: true };
  }
  const configuredTimeout = Number(process.env.OCR_SERVICE_TIMEOUT_MS || 30000);
  const timeout = Number.isFinite(configuredTimeout) ? Math.max(1000, Math.min(configuredTimeout, 120000)) : 30000;
  try {
    const form = new FormData();
    const serviceMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
    form.append('file', new Blob([content], { type: serviceMimeType }), 'document');
    form.append('documentType', documentType);
    const response = await fetch(`${endpoint}/v1/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(timeout),
    });
    const body = await response.text();
    if (body.length > 1024 * 1024) throw new Error('OCR service response exceeded the size limit.');
    if (!response.ok) throw new Error(`OCR service returned HTTP ${response.status}.`);
    return parseRemoteResult(JSON.parse(body));
  } catch (error: any) {
    return { rawText: '', confidence: null, fields: [], error: error.name === 'TimeoutError' ? 'OCR service request timed out.' : 'OCR service request failed or returned an invalid response.', isRecoverable: true };
  }
}

export async function parseDocumentBuffer(content: Buffer, mimeType: string, documentType: DocumentType): Promise<ParseResult> {
  if (!content.length) return { rawText: '', confidence: null, fields: [], error: 'Uploaded file is empty.', isRecoverable: true };
  if (content.length > 10 * 1024 * 1024) return { rawText: '', confidence: null, fields: [], error: 'Document exceeds the 10 MB extraction limit.', isRecoverable: true };
  const remoteConfigured = Boolean(process.env.OCR_SERVICE_URL || process.env.OCR_SERVICE_TOKEN);
  if (remoteConfigured || process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return parseWithRemoteService(content, mimeType, documentType);
  }

  const ext = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : '.jpg';
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bharatsatya-extract-'));
  const filePath = path.join(workDir, `upload${ext}`);
  try {
    await fs.promises.writeFile(filePath, content, { mode: 0o600, flag: 'wx' });
    return await parseDocumentFile(filePath, mimeType, documentType);
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

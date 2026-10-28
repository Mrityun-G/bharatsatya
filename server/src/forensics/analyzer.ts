// Preliminary document forensics. Every indicator here is a reason for a human to look
// closer, never a finding of forgery. Checks are deterministic and explainable.

export type IndicatorSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ForensicIndicator {
  code: string;
  title: string;
  severity: IndicatorSeverity;
  evidence: string;
  reason: string;
  nextStep: string;
}

export interface ForensicReport {
  analyzedAt: string;
  metadata: {
    producer?: string;
    creator?: string;
    createdAt?: string;
    modifiedAt?: string;
    revisions?: number;
    fontCount?: number;
    hasDigitalSignature?: boolean;
    hasExif?: boolean;
    editingSoftware?: string;
  };
  indicators: ForensicIndicator[];
}

const EDITING_TOOLS = /photoshop|gimp|illustrator|inkscape|canva|ilovepdf|smallpdf|sejda|pdfescape|phantompdf|nitro|pdf-xchange|pdfelement|paint\.net|pixlr|snapseed/i;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a PDF date string such as D:20240317120000+05'30'. */
export function parsePdfDate(value?: string): Date | undefined {
  const m = value?.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return undefined;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00'] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function pdfInfoValue(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(`/${key}\\s*\\(([^)]{0,200})\\)`));
  return m?.[1]?.trim() || undefined;
}

function analyzePdf(buffer: Buffer): ForensicReport {
  const text = buffer.toString('latin1');
  const producer = pdfInfoValue(text, 'Producer');
  const creator = pdfInfoValue(text, 'Creator');
  const created = parsePdfDate(pdfInfoValue(text, 'CreationDate'));
  const modified = parsePdfDate(pdfInfoValue(text, 'ModDate'));
  const revisions = (text.match(/%%EOF/g) || []).length;
  const fonts = new Set(Array.from(text.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+_,-]+)/g), (m) => m[1].replace(/^[A-Z]{6}\+/, '')));
  const hasDigitalSignature = /\/ByteRange\s*\[/.test(text) && /\/Sig\b/.test(text);
  const editingSoftware = [producer, creator].find((v) => v && EDITING_TOOLS.test(v));
  const indicators: ForensicIndicator[] = [];

  if (editingSoftware) {
    indicators.push({
      code: 'EDITING_SOFTWARE',
      title: 'Produced with editing software',
      severity: 'MEDIUM',
      evidence: `PDF producer/creator: "${editingSoftware}"`,
      reason: 'Issuing offices normally scan or export certificates; an editing tool in the metadata means the file was opened and saved in an editor.',
      nextStep: 'Request the original scanned copy or verify with the issuing authority.',
    });
  }
  if (revisions > 1 && !hasDigitalSignature) {
    indicators.push({
      code: 'INCREMENTAL_REVISIONS',
      title: 'File saved with later revisions',
      severity: 'MEDIUM',
      evidence: `${revisions} revision markers (%%EOF) in an unsigned PDF`,
      reason: 'Content was appended after the first save, which is how in-place edits to a PDF are stored.',
      nextStep: 'Compare the earliest revision with the submitted version.',
    });
  }
  if (created && modified && modified.getTime() - created.getTime() > DAY_MS) {
    const days = Math.round((modified.getTime() - created.getTime()) / DAY_MS);
    indicators.push({
      code: 'MODIFIED_AFTER_CREATION',
      title: 'Modified long after creation',
      severity: 'LOW',
      evidence: `Created ${created.toISOString().slice(0, 10)}, modified ${modified.toISOString().slice(0, 10)}`,
      reason: `The file was changed ${days} day(s) after it was created.`,
      nextStep: 'Check whether the changes affect dates, numbers or names.',
    });
  }
  if (fonts.size > 4) {
    indicators.push({
      code: 'MIXED_FONTS',
      title: 'Unusually many embedded fonts',
      severity: 'LOW',
      evidence: `${fonts.size} font families: ${Array.from(fonts).slice(0, 6).join(', ')}`,
      reason: 'Text pasted into an existing document often brings a different font with it.',
      nextStep: 'Look for fields set in a different typeface from the body text.',
    });
  }

  return {
    analyzedAt: new Date().toISOString(),
    metadata: {
      producer, creator,
      createdAt: created?.toISOString(),
      modifiedAt: modified?.toISOString(),
      revisions, fontCount: fonts.size, hasDigitalSignature, editingSoftware,
    },
    indicators,
  };
}

function analyzeImage(buffer: Buffer, mimeType: string): ForensicReport {
  const head = buffer.subarray(0, Math.min(buffer.length, 256 * 1024)).toString('latin1');
  const hasExif = mimeType === 'image/jpeg' ? head.includes('Exif\u0000\u0000') : /eXIf|tEXt.{0,40}(Software|Create)/.test(head);
  const editingSoftware = head.match(EDITING_TOOLS)?.[0];
  const indicators: ForensicIndicator[] = [];

  if (editingSoftware) {
    indicators.push({
      code: 'EDITING_SOFTWARE',
      title: 'Image saved by editing software',
      severity: 'MEDIUM',
      evidence: `Software tag mentions "${editingSoftware}"`,
      reason: 'The image was processed in an editor after capture.',
      nextStep: 'Request the unedited original or a dated video walkthrough.',
    });
  }
  if (!hasExif) {
    indicators.push({
      code: 'NO_CAPTURE_METADATA',
      title: 'No camera metadata',
      severity: 'LOW',
      evidence: 'No EXIF block found',
      reason: 'Capture date, device and location cannot be confirmed; metadata is often removed when an image is edited or forwarded.',
      nextStep: 'Ask for originals straight from the camera, or a geotagged photo.',
    });
  }

  return { analyzedAt: new Date().toISOString(), metadata: { hasExif, editingSoftware }, indicators };
}

export function analyzeDocumentBuffer(buffer: Buffer, mimeType: string): ForensicReport {
  try {
    if (mimeType === 'application/pdf') return analyzePdf(buffer);
    if (mimeType.startsWith('image/')) return analyzeImage(buffer, mimeType);
  } catch {
    // Forensics is advisory; a parser failure must never block an upload.
  }
  return { analyzedAt: new Date().toISOString(), metadata: {}, indicators: [] };
}

export function readForensicReport(json?: string | null): ForensicReport | null {
  if (!json) return null;
  try { return JSON.parse(json) as ForensicReport; } catch { return null; }
}

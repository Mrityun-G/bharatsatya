import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ applicationFindUnique: vi.fn(), rulesFindMany: vi.fn() }));
vi.mock('../prisma.js', () => ({ prisma: { application: { findUnique: mocks.applicationFindUnique }, validationRule: { findMany: mocks.rulesFindMany } } }));
import { analyzeDocumentBuffer, parsePdfDate } from '../forensics/analyzer.js';
import { evaluateApplicationCompliance } from '../rules/engine.js';
import { alertsFromFindings } from '../services/alerts.js';
import { fallbackExtractFields } from '../ocr/extractor.js';

const pdf = (body: string) => Buffer.from(`%PDF-1.4\n${body}\n%%EOF\n`, 'latin1');

describe('preliminary document forensics', () => {
  it('parses PDF dates', () => {
    expect(parsePdfDate("D:20240317120000+05'30'")?.toISOString()).toBe('2024-03-17T12:00:00.000Z');
    expect(parsePdfDate('not a date')).toBeUndefined();
  });

  it('reports no indicators for a plain single-revision PDF', () => {
    const report = analyzeDocumentBuffer(pdf('/Producer (Canon iR-ADV C5535 scanner) /CreationDate (D:20250101100000)'), 'application/pdf');
    expect(report.indicators).toEqual([]);
    expect(report.metadata.revisions).toBe(1);
  });

  it('flags editing software, appended revisions and late modification with evidence', () => {
    const body = '/Producer (iLovePDF) /CreationDate (D:20240317100000) /ModDate (D:20261019230500)\n%%EOF\nappended update';
    const report = analyzeDocumentBuffer(pdf(body), 'application/pdf');
    const codes = report.indicators.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['EDITING_SOFTWARE', 'INCREMENTAL_REVISIONS', 'MODIFIED_AFTER_CREATION']));
    for (const indicator of report.indicators) {
      expect(indicator.evidence.length).toBeGreaterThan(0);
      expect(indicator.reason.length).toBeGreaterThan(0);
    }
  });

  it('does not treat signed PDFs with incremental updates as edited', () => {
    const body = '/Producer (eSign) /Type /Sig /ByteRange [0 100 200 300]\n%%EOF\nsignature update';
    const report = analyzeDocumentBuffer(pdf(body), 'application/pdf');
    expect(report.metadata.hasDigitalSignature).toBe(true);
    expect(report.indicators.map((i) => i.code)).not.toContain('INCREMENTAL_REVISIONS');
  });

  it('flags images without camera metadata', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('IHDR....IDAT')]);
    expect(analyzeDocumentBuffer(png, 'image/png').indicators.map((i) => i.code)).toContain('NO_CAPTURE_METADATA');
  });
});

describe('infrastructure norm rule', () => {
  const rule = {
    id: 'rule-inf', code: 'RULE-INF-TEST', title: 'Library area', description: 'Synthetic', category: 'ALL',
    ruleType: 'INFRASTRUCTURE_NORM', severity: 'MAJOR', isActive: true, version: 1,
    logicConfigJson: '{}',
    versions: [{ id: 'v1', version: 1, logicConfigJson: JSON.stringify({ facility: 'Library', fieldName: 'LIBRARY_AREA_SQM', unit: 'm²', minimumByCategory: { ENGINEERING_TECH: 400 } }) }],
  };
  const app = (value?: string) => ({
    id: 'synthetic', category: 'ENGINEERING_TECH', institution: { name: 'Example' },
    documents: value === undefined ? [] : [{ documentType: 'FLOOR_PLAN', originalName: 'plan.pdf', fileHashSha256: 'h', extractedFields: [{ fieldName: 'LIBRARY_AREA_SQM', fieldValue: value }] }],
  });

  beforeEach(() => { mocks.rulesFindMany.mockResolvedValue([rule]); });

  it('flags a facility below the configured norm with the measured and required values', async () => {
    mocks.applicationFindUnique.mockResolvedValue(app('248'));
    const [finding] = await evaluateApplicationCompliance('synthetic');
    expect(finding).toMatchObject({ status: 'MISMATCH', evidenceComparison: { facility: 'Library', measured: 248, required: 400, unit: 'm²' } });
  });

  it('passes when the norm is met and asks for evidence when none is uploaded', async () => {
    mocks.applicationFindUnique.mockResolvedValueOnce(app('410')).mockResolvedValueOnce(app());
    await expect(evaluateApplicationCompliance('synthetic')).resolves.toMatchObject([{ status: 'PASSED' }]);
    await expect(evaluateApplicationCompliance('synthetic')).resolves.toMatchObject([{ status: 'MISSING' }]);
  });
});

describe('alerts from findings', () => {
  it('groups unresolved findings into one alert per status and skips passed items', () => {
    const alerts = alertsFromFindings([
      { status: 'EXPIRED', title: 'Fire NOC' }, { status: 'MISSING', title: 'Balance sheet' },
      { status: 'MISSING', title: 'Land page 2' }, { status: 'PASSED', title: 'Affidavit' },
    ]);
    expect(alerts.map((a) => a.type)).toEqual(['MISSING', 'EXPIRED']);
    expect(alerts[0].message).toContain('2 item(s)');
  });
});

describe('institution name extraction (Node fallback)', () => {
  const nameOf = (text: string) => fallbackExtractFields(text, 'FIRE_SAFETY_NOC').find((f) => f.fieldName === 'INSTITUTION_NAME')?.fieldValue;
  it('keeps the full name on an unlabelled letterhead instead of the word after "Institute of"', () => {
    expect(nameOf('Vidya Jyothi Institute of Technology\nFLOOR PLAN')).toBe('Vidya Jyothi Institute of Technology');
    expect(nameOf('This is to certify that Kalinga Institute of Management Studies, Bhubaneswar')).toBe('Kalinga Institute of Management Studies');
  });
  it('prefers an explicit label and finds nothing when no name is present', () => {
    expect(nameOf('Name of the Institution: Saraswati College of Pharmacy')).toBe('Saraswati College of Pharmacy');
    expect(nameOf('Society Name: Vidya Jyothi Educational Society\nRegistered')).toBe('Vidya Jyothi Educational Society');
    expect(nameOf('Certificate No: NOC/2026/01')).toBeUndefined();
  });
});

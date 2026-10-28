import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ applicationFindUnique: vi.fn(), rulesFindMany: vi.fn() }));
vi.mock('../prisma.js', () => ({ prisma: { application: { findUnique: mocks.applicationFindUnique }, validationRule: { findMany: mocks.rulesFindMany } } }));
import { evaluateApplicationCompliance } from '../rules/engine.js';

const application = {
  id: 'synthetic-test', category: 'ENGINEERING_TECH', institution: { name: 'Example Institute' },
  documents: [{ documentType: 'LAND_TITLE_DEED', originalName: 'land.pdf', fileHashSha256: 'hash1', extractedFields: [{ fieldName: 'LAND_AREA_ACRES', fieldValue: '2', evidenceSnippet: 'Area: 2 acres' }] }],
};

const rule = (version: number, minimum: number, isActive = true, category = 'ALL') => ({
  id: 'rule-1', code: 'RULE-TEST-01', title: 'Illustrative configured threshold', description: 'Synthetic test rule', category,
  ruleType: 'MINIMUM_THRESHOLD', severity: 'MAJOR', isActive, version,
  logicConfigJson: JSON.stringify({ documentType: 'LAND_TITLE_DEED', fieldName: 'LAND_AREA_ACRES', minimum }),
  versions: [{ id: `version-${version}`, version, logicConfigJson: JSON.stringify({ documentType: 'LAND_TITLE_DEED', fieldName: 'LAND_AREA_ACRES', minimum }) }],
});

describe('database-configured rule evaluation', () => {
  beforeEach(() => {
    mocks.applicationFindUnique.mockResolvedValue(application);
    mocks.rulesFindMany.mockReset();
  });

  it('uses the current stored version and threshold on each validation', async () => {
    mocks.rulesFindMany.mockResolvedValueOnce([rule(1, 1)]).mockResolvedValueOnce([rule(2, 3)]);
    const first = await evaluateApplicationCompliance(application.id);
    const second = await evaluateApplicationCompliance(application.id);
    expect(first[0]).toMatchObject({ status: 'PASSED', ruleVersionId: 'version-1' });
    expect(second[0]).toMatchObject({ status: 'MISMATCH', ruleVersionId: 'version-2' });
  });

  it('does not run inactive or non-applicable category rules', async () => {
    mocks.rulesFindMany.mockResolvedValue([rule(1, 1, true, 'PHARMACY')]);
    await expect(evaluateApplicationCompliance(application.id)).resolves.toEqual([]);
    expect(mocks.rulesFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });

  it('returns manual review for unknown rule types instead of silently passing', async () => {
    mocks.rulesFindMany.mockResolvedValue([{ ...rule(1, 1), ruleType: 'UNSUPPORTED' }]);
    await expect(evaluateApplicationCompliance(application.id)).resolves.toMatchObject([{ status: 'MANUAL_REVIEW_REQUIRED' }]);
  });
});

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { writeAuditEvent } from '../services/audit.js';

const CreateRuleSchema = z.object({
  code: z.string().min(3).regex(/^[A-Z0-9_\-]+$/, 'Rule code must be alphanumeric e.g. RULE-APH-11'),
  title: z.string().min(5),
  description: z.string().min(10),
  category: z.enum(['ALL', 'ENGINEERING_TECH', 'MANAGEMENT', 'PHARMACY', 'ARCHITECTURE', 'POLYTECHNIC']).default('ALL'),
  officialSourceReference: z.string().min(5),
  isOfficial: z.boolean().default(false),
  ruleType: z.enum([
    'MANDATORY_DOCUMENT',
    'EXPIRY_CHECK',
    'CROSS_DOCUMENT_CONSISTENCY',
    'MINIMUM_THRESHOLD',
    'DUPLICATE_CHECK',
    'FORMAT_VALIDITY',
    'INFRASTRUCTURE_NORM',
  ]),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'INFO']),
  logicConfigJson: z.string().min(2),
});

const UpdateRuleSchema = z.object({
  title: z.string().min(5).optional(),
  description: z.string().min(10).optional(),
  category: z.enum(['ALL', 'ENGINEERING_TECH', 'MANAGEMENT', 'PHARMACY', 'ARCHITECTURE', 'POLYTECHNIC']).optional(),
  isOfficial: z.boolean().optional(),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'INFO']).optional(),
  logicConfigJson: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  changeReason: z.string().min(5, 'Mandatory change reason required for rule modification auditability'),
});

export async function listRules(req: Request, res: Response): Promise<void> {
  try {
    const { category, isActive } = req.query;
    const where: any = {};

    if (category && category !== 'ALL') {
      where.OR = [{ category: 'ALL' }, { category: category as string }];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const rules = await prisma.validationRule.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
      orderBy: { code: 'asc' },
    });

    res.json({ success: true, count: rules.length, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function createRule(req: Request, res: Response): Promise<void> {
  try {
    const parsed = CreateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;

    // Check duplicate code
    const existing = await prisma.validationRule.findUnique({ where: { code: data.code } });
    if (existing) {
      res.status(409).json({ success: false, error: 'DuplicateRuleCode', message: `Rule ${data.code} already exists.` });
      return;
    }

    // Validate logic config JSON
    try {
      JSON.parse(data.logicConfigJson);
    } catch {
      res.status(400).json({ success: false, error: 'InvalidJSON', message: 'logicConfigJson must be valid JSON syntax.' });
      return;
    }

    const newRule = await prisma.$transaction(async (tx) => {
      const rule = await tx.validationRule.create({
        data: {
          code: data.code,
          title: data.title,
          description: data.description,
          category: data.category,
          officialSourceReference: data.officialSourceReference,
          isOfficial: data.isOfficial,
          ruleType: data.ruleType,
          severity: data.severity,
          logicConfigJson: data.logicConfigJson,
          version: 1,
          isActive: true,
          effectiveDate: new Date(),
        },
      });

      await tx.validationRuleVersion.create({
        data: {
          ruleId: rule.id,
          version: 1,
          title: rule.title,
          description: rule.description,
          category: rule.category,
          officialSourceReference: rule.officialSourceReference,
          isOfficial: rule.isOfficial,
          ruleType: rule.ruleType,
          severity: rule.severity,
          isActive: rule.isActive,
          logicConfigJson: rule.logicConfigJson,
          changedByUserId: req.user?.id || null,
          changeReason: 'Initial rule baseline registration',
        },
      });

      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Administrator', actorRole: req.user?.role || 'ADMIN',
        action: 'RULE_CREATED', entityType: 'ValidationRule', entityId: rule.id, afterState: rule,
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });

      return rule;
    });

    res.status(201).json({ success: true, data: newRule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function updateRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = UpdateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { changeReason, ...updates } = parsed.data;

    if (updates.logicConfigJson) {
      try { JSON.parse(updates.logicConfigJson); }
      catch {
        res.status(400).json({ success: false, error: 'InvalidJSON', message: 'logicConfigJson must be valid JSON syntax.' });
        return;
      }
    }

    const existing = await prisma.validationRule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'RuleNotFound' });
      return;
    }

    const nextVersion = existing.version + 1;

    const updated = await prisma.$transaction(async (tx) => {
      const rule = await tx.validationRule.update({
        where: { id },
        data: {
          ...updates,
          version: nextVersion,
        },
      });

      await tx.validationRuleVersion.create({
        data: {
          ruleId: rule.id,
          version: nextVersion,
          title: rule.title,
          description: rule.description,
          category: rule.category,
          officialSourceReference: rule.officialSourceReference,
          isOfficial: rule.isOfficial,
          ruleType: rule.ruleType,
          severity: rule.severity,
          isActive: rule.isActive,
          logicConfigJson: rule.logicConfigJson,
          changedByUserId: req.user?.id || null,
          changeReason,
        },
      });

      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Administrator', actorRole: req.user?.role || 'ADMIN',
        action: 'RULE_VERSION_UPDATED', entityType: 'ValidationRule', entityId: id,
        beforeState: existing, afterState: { rule, version: nextVersion, changeReason },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });

      return rule;
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function toggleRuleStatus(req: Request, res: Response): Promise<void> {
  try {
    const parsed = z.object({ changeReason: z.string().min(5) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }
    const { id } = req.params;
    const existing = await prisma.validationRule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'RuleNotFound' });
      return;
    }

    const newActiveState = !existing.isActive;
    const nextVersion = existing.version + 1;
    const updated = await prisma.$transaction(async (tx) => {
      const rule = await tx.validationRule.update({ where: { id }, data: { isActive: newActiveState, version: nextVersion } });
      await tx.validationRuleVersion.create({ data: {
        ruleId: id, version: nextVersion, title: rule.title, description: rule.description,
        category: rule.category, officialSourceReference: rule.officialSourceReference, isOfficial: rule.isOfficial,
        ruleType: rule.ruleType, severity: rule.severity, isActive: rule.isActive,
        logicConfigJson: rule.logicConfigJson, changedByUserId: req.user?.id || null,
        changeReason: parsed.data.changeReason,
      } });
      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Administrator', actorRole: req.user?.role || 'ADMIN',
        action: 'RULE_STATUS_TOGGLED', entityType: 'ValidationRule', entityId: id,
        beforeState: { isActive: existing.isActive, version: existing.version },
        afterState: { isActive: newActiveState, version: nextVersion, changeReason: parsed.data.changeReason }, ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return rule;
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

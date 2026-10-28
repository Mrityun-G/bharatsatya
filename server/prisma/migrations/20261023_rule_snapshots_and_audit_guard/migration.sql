-- Preserve the precise rule version used to produce every finding.
INSERT INTO "ValidationRuleVersion" ("id", "ruleId", "version", "title", "description", "logicConfigJson", "createdAt")
SELECT gen_random_uuid()::text, r."id", r."version", r."title", r."description", r."logicConfigJson", CURRENT_TIMESTAMP
FROM "ValidationRule" r
WHERE NOT EXISTS (
  SELECT 1 FROM "ValidationRuleVersion" v WHERE v."ruleId" = r."id" AND v."version" = r."version"
);

ALTER TABLE "ValidationRuleVersion"
  ADD CONSTRAINT "ValidationRuleVersion_ruleId_version_key" UNIQUE ("ruleId", "version");

ALTER TABLE "ValidationRuleVersion"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "officialSourceReference" TEXT,
  ADD COLUMN "isOfficial" BOOLEAN,
  ADD COLUMN "ruleType" TEXT,
  ADD COLUMN "severity" "FindingSeverity",
  ADD COLUMN "isActive" BOOLEAN;
UPDATE "ValidationRuleVersion" v
SET "category" = r."category", "officialSourceReference" = r."officialSourceReference",
    "isOfficial" = r."isOfficial", "ruleType" = r."ruleType", "severity" = r."severity", "isActive" = r."isActive"
FROM "ValidationRule" r
WHERE v."ruleId" = r."id" AND v."version" = r."version";

ALTER TABLE "ValidationFinding" ADD COLUMN "ruleVersionId" TEXT;
UPDATE "ValidationFinding" f
SET "ruleVersionId" = v."id"
FROM "ValidationRule" r
JOIN "ValidationRuleVersion" v ON v."ruleId" = r."id" AND v."version" = r."version"
WHERE f."ruleId" = r."id";
ALTER TABLE "ValidationFinding" ALTER COLUMN "ruleVersionId" SET NOT NULL;
ALTER TABLE "ValidationFinding"
  ADD CONSTRAINT "ValidationFinding_ruleVersionId_fkey"
  FOREIGN KEY ("ruleVersionId") REFERENCES "ValidationRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ValidationFinding_ruleVersionId_idx" ON "ValidationFinding"("ruleVersionId");

ALTER TABLE "ExtractedField" ALTER COLUMN "confidence" DROP NOT NULL;
ALTER TABLE "ExtractedField" ALTER COLUMN "confidence" DROP DEFAULT;
ALTER TABLE "ValidationRule" ALTER COLUMN "isOfficial" SET DEFAULT false;

-- Audit records are append-only for the application role.
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

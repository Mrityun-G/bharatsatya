ALTER TABLE "VerificationRequest" ADD COLUMN "requestedByUserId" TEXT;

-- Existing requests are seed/demo history without a known acting user. Keep
-- them attributable only through their original creation metadata; new actions
-- must always persist an authenticated actor.
CREATE INDEX "VerificationRequest_requestedByUserId_idx" ON "VerificationRequest"("requestedByUserId");

ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

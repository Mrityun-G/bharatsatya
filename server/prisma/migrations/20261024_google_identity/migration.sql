-- Bind a Google identity to an existing, pre-provisioned user after verifying
-- Google's signed ID token and verified email. New users are not auto-created.
ALTER TABLE "User" ADD COLUMN "googleSubject" TEXT;
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

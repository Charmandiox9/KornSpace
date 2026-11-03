-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "StoredFile_ownerId_deletedAt_idx" ON "StoredFile"("ownerId", "deletedAt");

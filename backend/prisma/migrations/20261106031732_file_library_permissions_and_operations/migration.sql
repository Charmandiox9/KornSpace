BEGIN;
-- CreateEnum
CREATE TYPE "FileRole" AS ENUM ('READER', 'EDITOR');

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "deletionPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "FilePermission" (
    "fileId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "FileRole" NOT NULL,

    CONSTRAINT "FilePermission_pkey" PRIMARY KEY ("fileId","userId")
);

-- CreateTable
CREATE TABLE "FileVisit" (
    "fileId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileVisit_pkey" PRIMARY KEY ("fileId","userId")
);

-- CreateIndex
CREATE INDEX "FilePermission_userId_fileId_idx" ON "FilePermission"("userId", "fileId");

-- CreateIndex
CREATE INDEX "FileVisit_userId_openedAt_idx" ON "FileVisit"("userId", "openedAt");

-- AddForeignKey
ALTER TABLE "FilePermission" ADD CONSTRAINT "FilePermission_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilePermission" ADD CONSTRAINT "FilePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVisit" ADD CONSTRAINT "FileVisit_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVisit" ADD CONSTRAINT "FileVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing files keep their names and contents. Abort atomically if legacy
-- duplicates need a product/user decision before enforcing active names.
UPDATE "StoredFile" SET "updatedAt" = "createdAt";
CREATE UNIQUE INDEX "StoredFile_active_folder_name_key" ON "StoredFile" ("ownerId", "folderId", "name") WHERE "deletedAt" IS NULL AND "folderId" IS NOT NULL;
CREATE UNIQUE INDEX "StoredFile_active_root_name_key" ON "StoredFile" ("ownerId", "name") WHERE "deletedAt" IS NULL AND "folderId" IS NULL;
CREATE INDEX "StoredFile_deletionPending_deletedAt_idx" ON "StoredFile" ("deletionPending", "deletedAt");
COMMIT;

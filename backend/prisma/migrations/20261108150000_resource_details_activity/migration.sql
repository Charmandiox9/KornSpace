ALTER TABLE "StoredFile" ADD COLUMN "description" VARCHAR(1000);
ALTER TABLE "Folder" ADD COLUMN "description" VARCHAR(1000);

CREATE TYPE "ResourceType" AS ENUM ('FILE', 'FOLDER');

CREATE TABLE "ResourceActivity" (
    "id" UUID NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" UUID NOT NULL,
    "fileId" UUID,
    "folderId" UUID,
    "actorId" UUID NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResourceActivity_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResourceActivity_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResourceActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ResourceActivity_resourceType_resourceId_createdAt_idx" ON "ResourceActivity"("resourceType", "resourceId", "createdAt");
CREATE INDEX "ResourceActivity_createdAt_idx" ON "ResourceActivity"("createdAt");

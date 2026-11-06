-- Root is represented by a NULL parent/folder relation. Existing files stay
-- at logical root because folderId is added nullable with no default.
CREATE TABLE "Folder" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" UUID NOT NULL,
    "parentId" UUID,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StoredFile" ADD COLUMN "folderId" UUID;

CREATE UNIQUE INDEX "Folder_id_ownerId_key" ON "Folder"("id", "ownerId");
CREATE UNIQUE INDEX "Folder_ownerId_parentId_name_key" ON "Folder"("ownerId", "parentId", "name");
CREATE UNIQUE INDEX "Folder_ownerId_name_root_key" ON "Folder"("ownerId", "name") WHERE "parentId" IS NULL;
CREATE INDEX "Folder_ownerId_parentId_idx" ON "Folder"("ownerId", "parentId");
CREATE INDEX "Folder_ownerId_createdAt_idx" ON "Folder"("ownerId", "createdAt");
CREATE INDEX "StoredFile_folderId_ownerId_idx" ON "StoredFile"("folderId", "ownerId");

ALTER TABLE "Folder"
    ADD CONSTRAINT "Folder_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folder"
    ADD CONSTRAINT "Folder_parentId_ownerId_fkey"
    FOREIGN KEY ("parentId", "ownerId") REFERENCES "Folder"("id", "ownerId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoredFile"
    ADD CONSTRAINT "StoredFile_folderId_ownerId_fkey"
    FOREIGN KEY ("folderId", "ownerId") REFERENCES "Folder"("id", "ownerId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

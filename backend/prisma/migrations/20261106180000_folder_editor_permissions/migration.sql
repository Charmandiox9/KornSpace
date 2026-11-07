-- CreateTable
CREATE TABLE "FolderPermission" (
    "folderId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "FolderPermission_pkey" PRIMARY KEY ("folderId","userId")
);

-- CreateIndex
CREATE INDEX "FolderPermission_userId_folderId_idx" ON "FolderPermission"("userId", "folderId");

-- AddForeignKey
ALTER TABLE "FolderPermission" ADD CONSTRAINT "FolderPermission_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPermission" ADD CONSTRAINT "FolderPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

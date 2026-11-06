-- CreateEnum
CREATE TYPE "ItemColor" AS ENUM ('DEFAULT', 'VIOLET', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'PINK', 'GRAY');

-- CreateTable
CREATE TABLE "FilePreference" (
    "userId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "shortcut" BOOLEAN NOT NULL DEFAULT false,
    "color" "ItemColor" NOT NULL DEFAULT 'DEFAULT',

    CONSTRAINT "FilePreference_pkey" PRIMARY KEY ("userId","fileId")
);

-- CreateTable
CREATE TABLE "FolderPreference" (
    "userId" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "shortcut" BOOLEAN NOT NULL DEFAULT false,
    "color" "ItemColor" NOT NULL DEFAULT 'DEFAULT',

    CONSTRAINT "FolderPreference_pkey" PRIMARY KEY ("userId","folderId")
);

-- AddForeignKey
ALTER TABLE "FilePreference" ADD CONSTRAINT "FilePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilePreference" ADD CONSTRAINT "FilePreference_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPreference" ADD CONSTRAINT "FolderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPreference" ADD CONSTRAINT "FolderPreference_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

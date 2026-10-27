CREATE TYPE "FileStatus" AS ENUM ('PROCESSING', 'AVAILABLE', 'FAILED');

CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "checksum" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoredFile_s3Key_key" ON "StoredFile"("s3Key");

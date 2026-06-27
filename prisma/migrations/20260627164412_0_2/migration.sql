-- AlterTable
ALTER TABLE "files" ADD COLUMN     "encryptionKey" TEXT,
ADD COLUMN     "ivBase" TEXT;

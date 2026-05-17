-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "documentType" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "extractedText" TEXT NOT NULL,
    "actionTitle" TEXT NOT NULL,
    "actionDescription" TEXT NOT NULL,
    "observationTitle" TEXT,
    "observationDescription" TEXT,
    "medicationName" TEXT,
    "medicationDosage" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SharedBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "actionTitle" TEXT NOT NULL,
    "actionDescription" TEXT NOT NULL,
    "observationTitle" TEXT,
    "observationDescription" TEXT,
    "medicationName" TEXT,
    "medicationDosage" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "documentId" TEXT,
    CONSTRAINT "SharedBrief_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SharedBrief" ("actionDescription", "actionTitle", "code", "createdAt", "documentType", "expiresAt", "id", "medicationDosage", "medicationName", "observationDescription", "observationTitle", "revokedAt", "source") SELECT "actionDescription", "actionTitle", "code", "createdAt", "documentType", "expiresAt", "id", "medicationDosage", "medicationName", "observationDescription", "observationTitle", "revokedAt", "source" FROM "SharedBrief";
DROP TABLE "SharedBrief";
ALTER TABLE "new_SharedBrief" RENAME TO "SharedBrief";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

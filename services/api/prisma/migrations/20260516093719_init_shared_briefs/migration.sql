-- CreateTable
CREATE TABLE "SharedBrief" (
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
    "expiresAt" DATETIME NOT NULL
);

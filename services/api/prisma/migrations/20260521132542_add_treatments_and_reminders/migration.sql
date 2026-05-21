-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "instructions" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "durationDays" INTEGER,
    "isLongTerm" BOOLEAN NOT NULL DEFAULT false,
    "renewalDate" DATETIME,
    "nextDoseDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Treatment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

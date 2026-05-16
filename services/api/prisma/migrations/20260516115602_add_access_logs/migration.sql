-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AccessLog_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "SharedBrief" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

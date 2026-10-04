-- CreateTable
CREATE TABLE "SmsLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "providerStatus" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SmsLog_phone_createdAt_idx" ON "SmsLog"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_kind_status_createdAt_idx" ON "SmsLog"("kind", "status", "createdAt");

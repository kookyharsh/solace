CREATE TABLE "PlannedActivity" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "sourceMessageId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "followUpAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "explicitReminder" BOOLEAN NOT NULL DEFAULT false,
  "reminderSentAt" TIMESTAMP(3),
  "followUpSentAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlannedActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlannedActivity_sourceMessageId_key" ON "PlannedActivity"("sourceMessageId");
CREATE INDEX "PlannedActivity_status_scheduledAt_idx" ON "PlannedActivity"("status", "scheduledAt");
CREATE INDEX "PlannedActivity_userId_status_idx" ON "PlannedActivity"("userId", "status");
ALTER TABLE "PlannedActivity" ADD CONSTRAINT "PlannedActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

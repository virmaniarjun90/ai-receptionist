/*
  Warnings:

  - Added the required column `updatedAt` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ai', 'awaiting_host', 'host', 'pending');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "activeHostName" TEXT,
ADD COLUMN     "handoffTriggeredAt" TIMESTAMP(3),
ADD COLUMN     "processingAiMessage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ConversationStatus" NOT NULL DEFAULT 'ai',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PropertyHost" ADD COLUMN     "pinHash" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GuestToken" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "reservationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestToken_token_key" ON "GuestToken"("token");

-- CreateIndex
CREATE INDEX "GuestToken_token_idx" ON "GuestToken"("token");

-- CreateIndex
CREATE INDEX "GuestToken_reservationId_idx" ON "GuestToken"("reservationId");

-- CreateIndex
CREATE INDEX "Conversation_propertyId_status_idx" ON "Conversation"("propertyId", "status");

-- AddForeignKey
ALTER TABLE "GuestToken" ADD CONSTRAINT "GuestToken_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestToken" ADD CONSTRAINT "GuestToken_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

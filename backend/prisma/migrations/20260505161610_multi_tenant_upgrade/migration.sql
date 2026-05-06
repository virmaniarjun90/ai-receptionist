-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('whatsapp', 'sms', 'voice');

-- DropIndex
DROP INDEX "Conversation_userPhone_key";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'whatsapp';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "config" JSONB,
ADD COLUMN     "tenantId" UUID,
ADD COLUMN     "type" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Knowledge_propertyId_idx" ON "Knowledge"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Knowledge_propertyId_key_key" ON "Knowledge"("propertyId", "key");

-- CreateIndex
CREATE INDEX "Conversation_propertyId_userPhone_channel_idx" ON "Conversation"("propertyId", "userPhone", "channel");

-- CreateIndex
CREATE INDEX "Conversation_userPhone_idx" ON "Conversation"("userPhone");

-- CreateIndex
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

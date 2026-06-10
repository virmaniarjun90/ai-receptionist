-- CreateTable: PropertyHost — one row per host per property
CREATE TABLE "PropertyHost" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "propertyId" UUID         NOT NULL,
    "name"       TEXT         NOT NULL,
    "phone"      TEXT         NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyHost_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single hostPhone values into PropertyHost rows
INSERT INTO "PropertyHost" ("propertyId", "name", "phone")
SELECT "id", 'Host', "hostPhone"
FROM "Property"
WHERE "hostPhone" IS NOT NULL;

-- AddColumn: activeHostPhone on Conversation (nullable — set when a host JOINs)
ALTER TABLE "Conversation" ADD COLUMN "activeHostPhone" TEXT;

-- DropColumn: hostPhone from Property (replaced by PropertyHost table)
ALTER TABLE "Property" DROP COLUMN "hostPhone";

-- AddForeignKey
ALTER TABLE "PropertyHost" ADD CONSTRAINT "PropertyHost_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyHost_propertyId_phone_key" ON "PropertyHost"("propertyId", "phone");
CREATE INDEX "PropertyHost_propertyId_idx" ON "PropertyHost"("propertyId");
CREATE INDEX "PropertyHost_phone_idx" ON "PropertyHost"("phone");

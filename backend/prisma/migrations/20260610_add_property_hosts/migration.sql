-- CreateTable: PropertyHost — one row per host per property
CREATE TABLE IF NOT EXISTS "PropertyHost" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "propertyId" UUID         NOT NULL,
    "name"       TEXT         NOT NULL,
    "phone"      TEXT         NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyHost_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single hostPhone values into PropertyHost rows (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Property' AND column_name='hostPhone') THEN
    INSERT INTO "PropertyHost" ("propertyId", "name", "phone")
    SELECT "id", 'Host', "hostPhone"
    FROM "Property"
    WHERE "hostPhone" IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- AddColumn: activeHostPhone on Conversation (nullable — set when a host JOINs)
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "activeHostPhone" TEXT;

-- DropColumn: hostPhone from Property (replaced by PropertyHost table) — only if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Property' AND column_name='hostPhone') THEN
    ALTER TABLE "Property" DROP COLUMN "hostPhone";
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "PropertyHost" ADD CONSTRAINT "PropertyHost_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyHost_propertyId_phone_key" ON "PropertyHost"("propertyId", "phone");
CREATE INDEX "PropertyHost_propertyId_idx" ON "PropertyHost"("propertyId");
CREATE INDEX "PropertyHost_phone_idx" ON "PropertyHost"("phone");

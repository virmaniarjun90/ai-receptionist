-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "externalId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'confirmed',
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_propertyId_checkIn_idx" ON "Reservation"("propertyId", "checkIn");

-- CreateIndex
CREATE INDEX "Reservation_guestPhone_idx" ON "Reservation"("guestPhone");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_status_idx" ON "Reservation"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_propertyId_externalId_key" ON "Reservation"("propertyId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_phoneNumber_key" ON "Property"("phoneNumber");

-- CreateIndex
CREATE INDEX "Property_phoneNumber_idx" ON "Property"("phoneNumber");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "student_registration_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "parentRelation" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "destinationId" TEXT,
    "major" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "offDays" JSONB NOT NULL DEFAULT '[]',
    "transportMode" "TransportMode" NOT NULL DEFAULT 'LINE',
    "pickupLocation" TEXT,
    "homeAddress" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_registration_requests_status_idx" ON "student_registration_requests"("status");

-- AddForeignKey
ALTER TABLE "student_registration_requests" ADD CONSTRAINT "student_registration_requests_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_registration_requests" ADD CONSTRAINT "student_registration_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

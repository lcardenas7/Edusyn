-- CreateTable: ManagementAreaMember - Docentes asignados a áreas de gestión
CREATE TABLE "ManagementAreaMember" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "ManagementArea" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementAreaMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagementAreaMember_institutionId_idx" ON "ManagementAreaMember"("institutionId");

-- CreateIndex
CREATE INDEX "ManagementAreaMember_userId_idx" ON "ManagementAreaMember"("userId");

-- CreateIndex
CREATE INDEX "ManagementAreaMember_area_idx" ON "ManagementAreaMember"("area");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementAreaMember_institutionId_userId_area_key" ON "ManagementAreaMember"("institutionId", "userId", "area");

-- AddForeignKey
ALTER TABLE "ManagementAreaMember" ADD CONSTRAINT "ManagementAreaMember_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAreaMember" ADD CONSTRAINT "ManagementAreaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAreaMember" ADD CONSTRAINT "ManagementAreaMember_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

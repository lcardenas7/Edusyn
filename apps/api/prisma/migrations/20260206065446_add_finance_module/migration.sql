-- CreateEnum
CREATE TYPE "ThirdPartyType" AS ENUM ('STUDENT', 'TEACHER', 'GUARDIAN', 'GROUP', 'GRADE', 'EXTERNAL', 'PROVIDER');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'CHECK', 'PSE', 'NEQUI', 'DAVIPLATA', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialMovementType" AS ENUM ('INCOME', 'EXPENSE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "SystemModule" ADD VALUE 'FINANCE';

-- CreateTable
CREATE TABLE "FinancialThirdParty" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "type" "ThirdPartyType" NOT NULL,
    "referenceId" TEXT,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "documentType" "DocumentType",
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "businessName" TEXT,
    "nit" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialThirdParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "type" "FinancialMovementType" NOT NULL DEFAULT 'INCOME',
    "budgetAmount" DECIMAL(15,2),
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeConcept" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "defaultAmount" DECIMAL(15,2) NOT NULL,
    "isMassive" BOOLEAN NOT NULL DEFAULT false,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "allowPartial" BOOLEAN NOT NULL DEFAULT true,
    "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "lateFeeType" TEXT,
    "lateFeeValue" DECIMAL(15,2),
    "gracePeriodDays" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargeConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialObligation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "thirdPartyId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "originalAmount" DECIMAL(15,2) NOT NULL,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lateFeeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(15,2) NOT NULL,
    "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "discountReason" TEXT,
    "discountApprovedBy" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPayment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "obligationId" TEXT,
    "thirdPartyId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "receiptNumber" TEXT,
    "transactionRef" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "receivedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialExpense" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "providerId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "transactionRef" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInvoice" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "thirdPartyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "FinancialMovementType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discountTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "obligationId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSettings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'FAC',
    "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "receiptPrefix" TEXT NOT NULL DEFAULT 'REC',
    "receiptNextNumber" INTEGER NOT NULL DEFAULT 1,
    "defaultLateFeeType" TEXT,
    "defaultLateFeeValue" DECIMAL(15,2),
    "defaultGracePeriodDays" INTEGER NOT NULL DEFAULT 5,
    "taxId" TEXT,
    "taxRegime" TEXT,
    "bankAccounts" JSONB,
    "sendPaymentReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegisterClose" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "closeDate" DATE NOT NULL,
    "cashTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cardTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "physicalCash" DECIMAL(15,2),
    "difference" DECIMAL(15,2),
    "notes" TEXT,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegisterClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialThirdParty_institutionId_idx" ON "FinancialThirdParty"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_type_idx" ON "FinancialThirdParty"("type");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_referenceId_idx" ON "FinancialThirdParty"("referenceId");

-- CreateIndex
CREATE INDEX "FinancialThirdParty_document_idx" ON "FinancialThirdParty"("document");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialThirdParty_institutionId_type_referenceId_key" ON "FinancialThirdParty"("institutionId", "type", "referenceId");

-- CreateIndex
CREATE INDEX "FinancialCategory_institutionId_idx" ON "FinancialCategory"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialCategory_type_idx" ON "FinancialCategory"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_institutionId_name_key" ON "FinancialCategory"("institutionId", "name");

-- CreateIndex
CREATE INDEX "ChargeConcept_institutionId_idx" ON "ChargeConcept"("institutionId");

-- CreateIndex
CREATE INDEX "ChargeConcept_categoryId_idx" ON "ChargeConcept"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeConcept_institutionId_name_key" ON "ChargeConcept"("institutionId", "name");

-- CreateIndex
CREATE INDEX "FinancialObligation_institutionId_idx" ON "FinancialObligation"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialObligation_thirdPartyId_idx" ON "FinancialObligation"("thirdPartyId");

-- CreateIndex
CREATE INDEX "FinancialObligation_conceptId_idx" ON "FinancialObligation"("conceptId");

-- CreateIndex
CREATE INDEX "FinancialObligation_status_idx" ON "FinancialObligation"("status");

-- CreateIndex
CREATE INDEX "FinancialObligation_dueDate_idx" ON "FinancialObligation"("dueDate");

-- CreateIndex
CREATE INDEX "FinancialObligation_reference_idx" ON "FinancialObligation"("reference");

-- CreateIndex
CREATE INDEX "FinancialPayment_institutionId_idx" ON "FinancialPayment"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialPayment_obligationId_idx" ON "FinancialPayment"("obligationId");

-- CreateIndex
CREATE INDEX "FinancialPayment_thirdPartyId_idx" ON "FinancialPayment"("thirdPartyId");

-- CreateIndex
CREATE INDEX "FinancialPayment_paymentDate_idx" ON "FinancialPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "FinancialPayment_receiptNumber_idx" ON "FinancialPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "FinancialExpense_institutionId_idx" ON "FinancialExpense"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialExpense_categoryId_idx" ON "FinancialExpense"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialExpense_providerId_idx" ON "FinancialExpense"("providerId");

-- CreateIndex
CREATE INDEX "FinancialExpense_expenseDate_idx" ON "FinancialExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "FinancialInvoice_institutionId_idx" ON "FinancialInvoice"("institutionId");

-- CreateIndex
CREATE INDEX "FinancialInvoice_thirdPartyId_idx" ON "FinancialInvoice"("thirdPartyId");

-- CreateIndex
CREATE INDEX "FinancialInvoice_status_idx" ON "FinancialInvoice"("status");

-- CreateIndex
CREATE INDEX "FinancialInvoice_issueDate_idx" ON "FinancialInvoice"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_institutionId_invoiceNumber_key" ON "FinancialInvoice"("institutionId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "FinancialInvoiceItem_invoiceId_idx" ON "FinancialInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "FinancialInvoiceItem_obligationId_idx" ON "FinancialInvoiceItem"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSettings_institutionId_key" ON "FinancialSettings"("institutionId");

-- CreateIndex
CREATE INDEX "CashRegisterClose_institutionId_idx" ON "CashRegisterClose"("institutionId");

-- CreateIndex
CREATE INDEX "CashRegisterClose_closeDate_idx" ON "CashRegisterClose"("closeDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegisterClose_institutionId_closeDate_key" ON "CashRegisterClose"("institutionId", "closeDate");

-- AddForeignKey
ALTER TABLE "FinancialThirdParty" ADD CONSTRAINT "FinancialThirdParty_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeConcept" ADD CONSTRAINT "ChargeConcept_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeConcept" ADD CONSTRAINT "ChargeConcept_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialObligation" ADD CONSTRAINT "FinancialObligation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialObligation" ADD CONSTRAINT "FinancialObligation_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "FinancialThirdParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialObligation" ADD CONSTRAINT "FinancialObligation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ChargeConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FinancialObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "FinancialThirdParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "FinancialThirdParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "FinancialThirdParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoiceItem" ADD CONSTRAINT "FinancialInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinancialInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoiceItem" ADD CONSTRAINT "FinancialInvoiceItem_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FinancialObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSettings" ADD CONSTRAINT "FinancialSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterClose" ADD CONSTRAINT "CashRegisterClose_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterClose" ADD CONSTRAINT "CashRegisterClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

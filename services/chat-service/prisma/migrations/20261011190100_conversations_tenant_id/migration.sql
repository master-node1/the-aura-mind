-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "conversations_tenant_id_idx" ON "conversations"("tenant_id");

-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "memories_tenant_id_idx" ON "memories"("tenant_id");

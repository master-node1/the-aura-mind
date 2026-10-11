-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

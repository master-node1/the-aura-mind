-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verification_expires_at" TIMESTAMP(3),
ADD COLUMN     "email_verification_token_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_verification_token_hash_key" ON "users"("email_verification_token_hash");

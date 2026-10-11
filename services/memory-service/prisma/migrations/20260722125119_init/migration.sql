/*
  Warnings:

  - The `embedding_id` column on the `memories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `conversation_id` column on the `memories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `user_id` on the `memories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "memories" DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "embedding_id",
ADD COLUMN     "embedding_id" UUID,
DROP COLUMN "conversation_id",
ADD COLUMN     "conversation_id" UUID;

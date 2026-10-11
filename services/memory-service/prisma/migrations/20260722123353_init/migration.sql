-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL DEFAULT 'long',
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "emotion_tag" TEXT NOT NULL DEFAULT 'neutral',
    "importance_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "embedding_id" TEXT,
    "conversation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessed_at" TIMESTAMP(3),

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

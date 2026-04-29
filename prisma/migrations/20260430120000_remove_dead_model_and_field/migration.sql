-- DropTable
DROP TABLE IF EXISTS "ai_chat_history";

-- DropIndex (no-op if already gone)
-- Drop displayUsername column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "displayUsername";

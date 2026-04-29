-- DropTable: ai_chat_history is dead code (replaced by AiConversation/AiMessage).
-- Data is not archived because the table was never used in production code.
DROP TABLE IF EXISTS "ai_chat_history";

-- DropColumn: displayUsername was added but never used in server or client code.
ALTER TABLE "users" DROP COLUMN IF EXISTS "displayUsername";

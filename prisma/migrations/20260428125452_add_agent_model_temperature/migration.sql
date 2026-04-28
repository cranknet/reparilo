-- AlterTable: add model and temperature columns to ai_agent_definitions
ALTER TABLE "ai_agent_definitions" ADD COLUMN "model" TEXT;
ALTER TABLE "ai_agent_definitions" ADD COLUMN "temperature" DOUBLE PRECISION;
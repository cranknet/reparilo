-- DropIndex
DROP INDEX IF EXISTS "repair_catalog_name_idx";

-- CreateIndex
CREATE UNIQUE INDEX "repair_catalog_name_key" ON "repair_catalog"("name");
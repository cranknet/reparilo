-- Step 1: Create brands table
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "brands_name_key" UNIQUE ("name")
);

-- Step 2: Populate brands from distinct device brands
INSERT INTO "brands" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "brand", now(), now()
FROM (SELECT DISTINCT "brand" FROM "devices") AS sub
WHERE "brand" IS NOT NULL AND "brand" != ''
ON CONFLICT ("name") DO NOTHING;

-- Step 3: Add nullable brandId column to devices
ALTER TABLE "devices" ADD COLUMN "brandId" TEXT;

-- Step 4: Backfill brandId from brands table
UPDATE "devices" d
SET "brandId" = b.id
FROM "brands" b
WHERE d.brand = b.name;

-- Step 5: Set brandId NOT NULL (only if all devices have a brand match)
-- If there are devices without a matching brand, they'll need manual fix
ALTER TABLE "devices" ALTER COLUMN "brandId" SET NOT NULL;

-- Step 6: Add FK constraint
ALTER TABLE "devices" ADD CONSTRAINT "devices_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Drop old unique constraint and index
ALTER TABLE "devices" DROP CONSTRAINT "devices_brand_model_key";
DROP INDEX IF EXISTS "devices_brand_idx";

-- Step 8: Add new unique constraint and index
ALTER TABLE "devices" ADD CONSTRAINT "devices_brandId_model_key" UNIQUE ("brandId", "model");
CREATE INDEX "devices_brandId_idx" ON "devices"("brandId");

-- Step 9: Drop old brand column
ALTER TABLE "devices" DROP COLUMN "brand";
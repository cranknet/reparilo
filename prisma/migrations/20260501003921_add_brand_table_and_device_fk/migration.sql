-- Step 1: Create brands table
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

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

-- Step 4: Backfill brandId from brands table (case-insensitive match)
UPDATE "devices" d
SET "brandId" = b.id
FROM "brands" b
WHERE LOWER(d.brand) = LOWER(b.name);

-- Step 4b: Handle orphaned devices with NULL/empty or unmatched brand
-- Create an 'Unknown' brand placeholder and assign orphans to it
INSERT INTO "brands" ("id", "name", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Unknown', now(), now())
ON CONFLICT ("name") DO NOTHING;

UPDATE "devices" d
SET "brandId" = (SELECT id FROM "brands" WHERE name = 'Unknown' LIMIT 1)
WHERE d."brandId" IS NULL;

-- Step 5: Pre-check — fail if any devices still have NULL brandId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "devices" WHERE "brandId" IS NULL) THEN
    RAISE EXCEPTION 'Migration blocked: % devices have NULL brandId. Fix data before proceeding.',
      (SELECT COUNT(*) FROM "devices" WHERE "brandId" IS NULL);
  END IF;
END $$;

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
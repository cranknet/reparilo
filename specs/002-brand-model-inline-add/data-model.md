# Data Model: Brand & Model Inline Add

## New Entity: Brand

| Field     | Type       | Constraints                | Notes                          |
|-----------|------------|----------------------------|--------------------------------|
| id        | String     | @id @default(cuid())       | Primary key                    |
| name      | String     | @unique, case-insensitive  | Brand display name (e.g. "Samsung") |
| createdAt | DateTime   | @default(now()), @db.Timestamptz |                        |
| updatedAt | DateTime   | @updatedAt, @db.Timestamptz     |                        |

**Relationships**:
- `devices`: One-to-Many → Device (a brand has many device models)

**Validation rules**:
- `name` must be non-empty, trimmed, max 100 chars
- `name` unique constraint is case-insensitive (enforced via DB CITEXT or application-level normalization)
- No two brands with the same name regardless of casing

**State transitions**: None (static entity — brands are created and never change state)

---

## Modified Entity: Device

| Field     | Type       | Constraints                        | Notes                              |
|-----------|------------|-------------------------------------|------------------------------------|
| id        | String     | @id @default(cuid())                | Primary key                        |
| brandId   | String     | FK → Brand.id, onDelete: Restrict  | Replaces old `brand: String` field |
| model     | String     | non-empty                           | Model name (e.g. "Galaxy S24")    |
| createdAt | DateTime   | @default(now()), @db.Timestamptz   |                                    |
| updatedAt | DateTime   | @updatedAt, @db.Timestamptz        |                                    |

**Relationships**:
- `brand`: Many-to-One → Brand (a device model belongs to one brand)
- `jobs`: One-to-Many → Job (carried over from existing)

**Constraints**:
- `@@unique([brandId, model])` — replaces old `@@unique([brand, model])`
- `@@index([brandId])` — replaces old `@@index([brand])`

**Validation rules**:
- `model` must be non-empty, trimmed, max 200 chars
- `brandId` must reference an existing Brand

---

## Seed Data

Brands and models seeded as Brand + Device records. All operations use `upsert` for idempotency.

| Brand     | Models                                                    |
|-----------|-----------------------------------------------------------|
| Apple     | iPhone 14, iPhone 15, iPhone 16, iPhone 16 Pro Max, iPhone SE |
| Samsung   | Galaxy S24, Galaxy A54, Galaxy A34, Galaxy Z Flip5, Galaxy M14 |
| Huawei    | P40, Nova 11, Y9 Prime, Mate 40                          |
| Xiaomi    | Redmi 13, Redmi Note 13 Pro, Poco X6, 14                 |
| Oppo      | Reno 10, A78, Find X5, A58                               |
| Vivo      | V29, X100, Y36, V30                                      |
| OnePlus   | Nord CE 3, 12, 11, Nord 3                                |
| Google    | Pixel 8, Pixel 7a, Pixel 8 Pro                           |

---

## Migration Plan

1. Create `brands` table with `name` unique (CITEXT or lowercase + unique index for case-insensitivity)
2. Populate `brands` from `SELECT DISTINCT brand FROM devices`
3. Add `brandId` column to `devices` (nullable initially)
4. Backfill `devices.brandId` from `brands.id` matching on `devices.brand = brands.name`
5. Set `brandId` as NOT NULL
6. Drop old `devices.brand` column
7. Add FK constraint `devices.brandId → brands.id`
8. Update `@@unique([brand, model])` to `@@unique([brandId, model])`
9. Update `@@index([brand])` to `@@index([brandId])`
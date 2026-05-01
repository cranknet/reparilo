# API Contract: Brands

**Base path**: `/api/brands`

## GET /api/brands/search

Search brands by name prefix. Used by the intake modal brand dropdown.

**Auth**: Required (any authenticated user)

**Query Parameters**:

| Param | Type   | Required | Default | Notes                          |
|-------|--------|----------|---------|--------------------------------|
| q     | string | No       | ""      | Search query (case-insensitive prefix match) |
| limit | number | No       | 20      | Max results (1-50)            |

**Response 200**:

```json
{
  "brands": [
    { "id": "clx...", "name": "Samsung" },
    { "id": "clx...", "name": "Samsung Galaxy" }
  ]
}
```

**Errors**:
- 400: Invalid query params (validation error with field details)
- 401: Not authenticated

---

## POST /api/brands

Create a new brand. Used by inline-add in the brand dropdown.

**Auth**: Required (any role with `jobs: ["create"]` permission)

**Request Body**:

```json
{
  "name": "Vivo"
}
```

**Response 201**:

```json
{
  "id": "clx...",
  "name": "Vivo"
}
```

**Errors**:
- 400: Validation error (empty name, name too long)
- 409: Brand already exists (case-insensitive duplicate)
- 401: Not authenticated
- 403: Insufficient permissions
# API Contract: Models

**Base path**: `/api/brands/:brandId/models`

## GET /api/brands/:brandId/models/search

Search models for a specific brand. Used by the intake modal model dropdown.

**Auth**: Required (any authenticated user)

**Path Parameters**:

| Param   | Type   | Required | Notes          |
|---------|--------|----------|----------------|
| brandId | string | Yes      | Brand ID       |

**Query Parameters**:

| Param | Type   | Required | Default | Notes                          |
|-------|--------|----------|---------|--------------------------------|
| q     | string | No       | ""      | Search query (case-insensitive prefix match on model name) |
| limit | number | No       | 20      | Max results (1-50)            |

**Response 200**:

```json
{
  "models": [
    { "id": "clx...", "model": "Galaxy S24" },
    { "id": "clx...", "model": "Galaxy A54" }
  ]
}
```

**Errors**:
- 400: Invalid query params or brandId format
- 404: Brand not found
- 401: Not authenticated

---

## POST /api/brands/:brandId/models

Create a new model (Device record) for a brand. Used by inline-add in the model dropdown.

**Auth**: Required (any role with `jobs: ["create"]` permission)

**Path Parameters**:

| Param   | Type   | Required | Notes          |
|---------|--------|----------|----------------|
| brandId | string | Yes      | Brand ID       |

**Request Body**:

```json
{
  "model": "X100"
}
```

**Response 201**:

```json
{
  "id": "clx...",
  "brandId": "clx...",
  "model": "X100"
}
```

**Errors**:
- 400: Validation error (empty model name, model too long) or invalid brandId format
- 404: Brand not found
- 409: Model already exists for this brand
- 401: Not authenticated
- 403: Insufficient permissions
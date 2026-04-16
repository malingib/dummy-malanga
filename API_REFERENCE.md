# API Reference

Complete documentation for all M-Pesa Payment System API endpoints.

## Base URL

```
Development: http://localhost:3000
Production: https://yourdomain.com
```

## Authentication

All API endpoints require valid environment variables to be set. Some endpoints require M-Pesa signature validation.

## M-Pesa Endpoints

### 1. C2B Validation

Validates incoming C2B payment requests.

**Endpoint:** `POST /api/mpesa/validation`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "TransactionType": "C2B",
  "TransID": "MGG123456789",
  "TransTime": "20240117123456",
  "TransAmount": 1000,
  "BusinessShortCode": 123456,
  "BillRefNumber": "ACC123456",
  "InvoiceNumber": "",
  "OrgAccountBalance": 50000,
  "ThirdPartyTransID": "",
  "MSISDN": "254708374149",
  "FirstName": "John",
  "MiddleName": "",
  "LastName": "Doe"
}
```

**Success Response (200):**
```json
{
  "ResultCode": 0,
  "ResultDesc": "The service request has been accepted for processing"
}
```

**Error Response (400):**
```json
{
  "ResultCode": 1,
  "ResultDesc": "Invalid request"
}
```

---

### 2. C2B Confirmation

Confirms and records a C2B payment.

**Endpoint:** `POST /api/mpesa/confirmation`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "TransactionType": "C2B",
  "TransID": "MGG123456789",
  "TransTime": "20240117123456",
  "TransAmount": 1000,
  "BusinessShortCode": 123456,
  "BillRefNumber": "ACC123456",
  "InvoiceNumber": "",
  "OrgAccountBalance": 49000,
  "ThirdPartyTransID": "",
  "MSISDN": "254708374149",
  "FirstName": "John",
  "MiddleName": "",
  "LastName": "Doe"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment confirmed and recorded",
  "transaction_id": "uuid-here"
}
```

---

### 3. Generate Access Token

Gets OAuth access token for M-Pesa API.

**Endpoint:** `POST /api/mpesa/token`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "access_token": "token_string",
  "expires_in": 3599
}
```

**Error Response (401):**
```json
{
  "error": "Authentication failed",
  "error_description": "Invalid credentials"
}
```

---

### 4. Simulate C2B Payment

Simulates a C2B payment for testing purposes.

**Endpoint:** `POST /api/mpesa/simulate`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "phone": "254708374149",
  "amount": 1000,
  "bill_reference": "ACC123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Simulation successful",
  "transaction": {
    "id": "uuid-here",
    "phone": "254708374149",
    "amount": 1000,
    "bill_reference": "ACC123456",
    "result_code": 0,
    "created_at": "2024-01-17T12:34:56Z"
  }
}
```

**Error Response (400):**
```json
{
  "error": "Validation failed",
  "details": "Invalid phone number"
}
```

---

## Dashboard Data Endpoints

### 1. Get Dashboard Statistics

Returns overview statistics for the dashboard.

**Endpoint:** `GET /api/dashboard/stats`

**Success Response (200):**
```json
{
  "totalTransactions": 1523,
  "totalAmount": 5234150,
  "successfulPayments": 1485,
  "failedPayments": 38,
  "activeMembers": 287,
  "openCases": 12
}
```

---

### 2. Get All Transactions

Retrieves all recorded transactions.

**Endpoint:** `GET /api/transactions`

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (0 = success, non-zero = failed)

**Example:** `GET /api/transactions?limit=50&offset=0&status=0`

**Success Response (200):**
```json
[
  {
    "id": "uuid-here",
    "phone": "254708374149",
    "amount": 1000,
    "bill_reference": "ACC123456",
    "merchant_request_id": "req-123456",
    "result_code": 0,
    "result_desc": "Success",
    "created_at": "2024-01-17T12:34:56Z"
  },
  ...
]
```

---

### 3. Get All Members

Retrieves all registered members.

**Endpoint:** `GET /api/members`

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Success Response (200):**
```json
[
  {
    "id": "uuid-here",
    "name": "John Doe",
    "phone": "254708374149",
    "email": "john@example.com",
    "id_number": "12345678",
    "created_at": "2024-01-10T10:00:00Z"
  },
  ...
]
```

---

### 4. Get All Cases

Retrieves all payment dispute cases.

**Endpoint:** `GET /api/cases`

**Query Parameters:**
- `status` (optional): Filter by status (open, closed, all)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Success Response (200):**
```json
[
  {
    "id": "uuid-here",
    "case_number": "CASE-2024-001",
    "phone": "254708374149",
    "description": "Payment not received",
    "resolved_at": null,
    "created_at": "2024-01-15T14:30:00Z"
  },
  ...
]
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Invalid input parameters",
  "details": "Phone number is required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing credentials"
}
```

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

Currently, there is no built-in rate limiting. For production, implement rate limiting:

```typescript
// Example using Vercel KV
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
});

const { success } = await ratelimit.limit('api');
```

---

## Request/Response Examples

### Example 1: Complete Payment Flow

**Step 1: Validate Payment**
```bash
curl -X POST http://localhost:3000/api/mpesa/validation \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionType": "C2B",
    "TransID": "MGG123456789",
    "TransTime": "20240117123456",
    "TransAmount": 1000,
    "BusinessShortCode": 123456,
    "BillRefNumber": "ACC123456",
    "MSISDN": "254708374149",
    "FirstName": "John",
    "LastName": "Doe"
  }'
```

**Step 2: Confirm Payment**
```bash
curl -X POST http://localhost:3000/api/mpesa/confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionType": "C2B",
    "TransID": "MGG123456789",
    "TransTime": "20240117123456",
    "TransAmount": 1000,
    "BusinessShortCode": 123456,
    "BillRefNumber": "ACC123456",
    "MSISDN": "254708374149",
    "FirstName": "John",
    "LastName": "Doe"
  }'
```

**Step 3: View in Dashboard**
```bash
curl -X GET http://localhost:3000/api/transactions
```

---

### Example 2: Simulate Test Payment

```bash
curl -X POST http://localhost:3000/api/mpesa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254708374149",
    "amount": 1000,
    "bill_reference": "TEST-ACC-001"
  }'
```

---

## API Best Practices

### Validation

All endpoints validate input:
- Phone numbers: Format `254xxxxx` or `+254xxxxx`
- Amounts: Positive integers
- Bill references: Non-empty strings
- Timestamps: ISO 8601 format

### Error Handling

Always check response status codes:
- `2xx`: Success
- `4xx`: Client error (bad request, invalid data)
- `5xx`: Server error (database, API connection)

### Pagination

For large datasets, use pagination:
```bash
GET /api/transactions?limit=50&offset=0
GET /api/transactions?limit=50&offset=50
GET /api/transactions?limit=50&offset=100
```

### Caching

Dashboard stats are fetched fresh each time. For optimization:
```typescript
// Implement caching in production
const cached = await redis.get('dashboard-stats');
if (cached) return JSON.parse(cached);
```

---

## Webhook Integration

M-Pesa callbacks to your application:

**Setup in Safaricom Daraja Dashboard:**
1. Validation URL: `https://yourdomain.com/api/mpesa/validation`
2. Confirmation URL: `https://yourdomain.com/api/mpesa/confirmation`

**Callback Format:**
The validation and confirmation endpoints receive JSON payloads from Safaricom's servers.

**Important Notes:**
- Responses must be in JSON format
- Response must include `ResultCode` and `ResultDesc`
- Callback must respond within 30 seconds
- Implement idempotency (same request = same response)

---

## Testing API Endpoints

### Using cURL

```bash
# Test validation
curl -X POST http://localhost:3000/api/mpesa/validation \
  -H "Content-Type: application/json" \
  -d '{...}'

# Test dashboard stats
curl -X GET http://localhost:3000/api/dashboard/stats
```

### Using Postman

1. Create new collection
2. Add requests for each endpoint
3. Set environment variables
4. Test each endpoint

### Using REST Client (VS Code)

Create `.rest` file:
```
### Get Dashboard Stats
GET http://localhost:3000/api/dashboard/stats

### Get Transactions
GET http://localhost:3000/api/transactions

### Simulate Payment
POST http://localhost:3000/api/mpesa/simulate
Content-Type: application/json

{
  "phone": "254708374149",
  "amount": 1000,
  "bill_reference": "TEST001"
}
```

---

## API Response Times

Target response times:
- Dashboard stats: < 200ms
- Transactions list: < 500ms
- Members list: < 500ms
- M-Pesa token: < 1000ms
- M-Pesa callbacks: < 30 seconds (Safaricom limit)

---

## Monitoring & Logs

Monitor API usage:
1. Vercel dashboard → Logs
2. Supabase dashboard → Database logs
3. Browser console (DevTools) for client-side errors

---

**Last Updated:** January 2024
**API Version:** 1.0
**Changelog:** Initial release

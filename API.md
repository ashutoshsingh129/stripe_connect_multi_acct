# API Documentation

This document provides comprehensive information about all API endpoints available in the Stripe Connect Multi-Account Reporting Application.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Backend API Endpoints](#backend-api-endpoints)
- [Frontend API Service](#frontend-api-service)
- [Request/Response Formats](#requestresponse-formats)
- [Error Handling](#error-handling)

## Base URL

- **Development**: `http://localhost:5000`
- **Production**: Set via `REACT_APP_API_URL` environment variable

All API endpoints are prefixed with `/api`.

## Authentication

The application uses JWT (JSON Web Tokens) for authentication. Most endpoints require a valid JWT token in the Authorization header.

### Authentication Header Format

```
Authorization: Bearer <jwt_token>
```

### Token Storage

- Tokens are stored in `localStorage` on the client side
- Token expiration: 24 hours
- Tokens are automatically included in requests via axios interceptors

## Backend API Endpoints

### Authentication Endpoints

#### POST `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "number",
    "stripeId": "string",
    "username": "string",
    "email": "string",
    "name": "string",
    "isMaster": "boolean"
  },
  "token": "jwt_token_string"
}
```

**Error Responses:**
- `400 Bad Request`: Missing username or password
- `401 Unauthorized`: Invalid credentials

---

#### POST `/api/auth/logout`

Logout the current user (client-side token removal).

**Response (200 OK):**
```json
{
  "message": "Logout successful",
  "success": true
}
```

---

#### GET `/api/auth/me`

Get current authenticated user information.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "authenticated": true,
  "user": {
    "stripeId": "string",
    "username": "string",
    "isMaster": "boolean"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired token

---

### Validation Endpoints

#### POST `/api/validate-keys`

Validate Stripe API keys and import accounts.

**Request Body:**
```json
{
  "publicKey": "encrypted_public_key",
  "secretKey": "encrypted_secret_key"
}
```

**Note:** Keys should be encrypted using the frontend encryption utility before sending.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Stripe keys validated successfully and accounts imported",
  "publicKey": "decrypted_public_key",
  "secretKey": "decrypted_secret_key"
}
```

**Error Responses:**
- `400 Bad Request`: Missing keys or invalid key format
- `400 Bad Request`: Invalid Stripe keys

---

### Reports Endpoints

#### GET `/api/reports/timezones`

Get list of available timezones (USA timezones only).

**Response (200 OK):**
```json
{
  "success": true,
  "timezones": ["America/New_York", "America/Chicago", ...],
  "total": 25,
  "note": "Showing USA timezones only"
}
```

---

#### GET `/api/reports/accounts`

Get all Stripe Connect accounts for the authenticated user.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response (200 OK):**
```json
{
  "success": true,
  "accounts": [
    {
      "id": "acct_xxx",
      "type": "express",
      "country": "US",
      "email": "account@example.com",
      "default_currency": "usd",
      "created": 1234567890
    }
  ],
  "total": 1
}
```

**Note:** Non-master users will only see their own connected account.

---

#### GET `/api/reports/multi/:accountIds`

Generate multi-account transaction report.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated list of account IDs (e.g., `acct_xxx,acct_yyy`)

**Query Parameters:**
- `start_date` (string, required for custom): Date in YYYY-MM-DD format
- `end_date` (string, required for custom): Date in YYYY-MM-DD format
- `timezone` (string, optional): Timezone (default: UTC)
- `period` (string, optional): `daily`, `weekly`, `monthly`, or `custom` (default: custom)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "account_id": "acct_xxx",
      "charges_count": 10,
      "charges_amount": 10000,
      "refunds_count": 1,
      "refunds_amount": 500,
      "totals_count": 11,
      "totals_amount": 9500
    }
  ],
  "accounts": [...],
  "pagination": {
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 100,
    "totalPages": 10,
    "hasPrevPage": false,
    "hasNextPage": true
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid date format or missing required parameters
- `401 Unauthorized`: Invalid or expired token

---

#### GET `/api/reports/detailed/:accountIds`

Get detailed transaction data with compliance fields.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated list of account IDs

**Query Parameters:**
- `start_date` (string, required for custom): Date in YYYY-MM-DD format
- `end_date` (string, required for custom): Date in YYYY-MM-DD format
- `timezone` (string, optional): Timezone (default: UTC)
- `period` (string, optional): `daily`, `weekly`, `monthly`, or `custom` (default: custom)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "account_id": "acct_xxx",
      "transaction_type": "charge",
      "id": "ch_xxx",
      "amount": 100.00,
      "currency": "usd",
      "status": "succeeded",
      "created": "2024-01-15 10:30:00",
      "paid": true,
      "captured": true,
      "disputed": false,
      "failure_code": "",
      "failure_message": "",
      "network_status": "approved_by_network",
      "outcome_type": "authorized",
      "risk_level": "normal",
      "customer_id": "cus_xxx",
      "customer_name": "John Doe",
      "customer_email": "john@example.com",
      "customer_phone": "+1234567890",
      "customer_ip": "192.168.1.1",
      "chargeback_status": "none",
      "metadata": {}
    }
  ],
  "pagination": {
    "currentPage": 1,
    "itemsPerPage": 50,
    "totalItems": 500,
    "totalPages": 10,
    "hasPrevPage": false,
    "hasNextPage": true
  },
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "timezone": "America/New_York"
}
```

---

### Export Endpoints

All export endpoints require authentication and accept the same request body format.

#### POST `/api/export/csv/:accountIds`

Export standard report to CSV format.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "timezone": "America/New_York",
  "period": "custom"
}
```

**Response:** CSV file (binary, password-protected ZIP)

---

#### POST `/api/export/xls/:accountIds`

Export standard report to Excel format.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same as CSV export

**Response:** Excel file (binary, password-protected ZIP)

---

#### POST `/api/export/pdf/:accountIds`

Export standard report to PDF format.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same as CSV export

**Response:** PDF file (binary, password-protected)

**Note:** PDF is password-protected using `STRIPE_IMPORT_PASSWORD` environment variable.

---

#### POST `/api/export/email/:accountIds`

Send standard report via email.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "timezone": "America/New_York",
  "period": "custom",
  "email": "recipient@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Report sent successfully to recipient@example.com"
}
```

---

#### POST `/api/export/sheets/:accountIds`

Export standard report to Google Sheets format.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same as CSV export

**Response:** Excel file (binary, password-protected ZIP) compatible with Google Sheets

---

### Detailed Transaction Export Endpoints

These endpoints export the detailed transaction view with compliance fields.

#### POST `/api/export/detailed/csv/:accountIds`

Export detailed transactions to CSV.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same format as standard export

**Response:** CSV file (binary, password-protected ZIP)

---

#### POST `/api/export/detailed/xls/:accountIds`

Export detailed transactions to Excel.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same format as standard export

**Response:** Excel file (binary, password-protected ZIP)

---

#### POST `/api/export/detailed/pdf/:accountIds`

Export detailed transactions to PDF.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same format as standard export

**Response:** PDF file (binary, password-protected)

---

#### POST `/api/export/detailed/email/:accountIds`

Send detailed transactions report via email.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "timezone": "America/New_York",
  "period": "custom",
  "email": "recipient@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Detailed report sent successfully to recipient@example.com"
}
```

---

#### POST `/api/export/detailed/sheets/:accountIds`

Export detailed transactions to Google Sheets format.

**Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `accountIds`: Comma-separated account IDs

**Request Body:** Same format as standard export

**Response:** Excel file (binary, password-protected ZIP)

---

## Frontend API Service

The frontend uses a centralized API service located at `client/src/services/api.js`.

### API Configuration

```javascript
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});
```

### Authentication Interceptors

The API service automatically:
- Adds JWT token to all requests via `Authorization: Bearer <token>` header
- Handles token expiration (401 responses) by clearing token and redirecting to login

### Available Functions

#### Authentication

```javascript
import { login, logout, checkAuthStatus, isAuthenticated } from './services/api';

// Login
const response = await login(username, password);
// Returns: { data: { token, user, message } }

// Logout
await logout();

// Check authentication status
const status = await checkAuthStatus();
// Returns: { data: { authenticated, user } }

// Check if user is authenticated (local check)
const authenticated = isAuthenticated();
// Returns: boolean
```

#### Reports

```javascript
import { apiService } from './services/api';

// Get timezones
const timezones = await apiService.getTimezones();

// Get accounts
const accounts = await apiService.getAccounts(headers);

// Get multi-account report
const report = await apiService.getMultiAccountReport(
  accountIds,  // comma-separated string
  { start_date, end_date, timezone, period, page, limit },
  headers
);

// Get detailed transactions
const transactions = await apiService.getDetailedTransactions(
  accountIds,
  startDate,
  endDate,
  timezone,
  page,
  limit,
  headers
);
```

#### Export

```javascript
import { apiService } from './services/api';

// Standard exports
await apiService.exportToCSV(accountId, data, headers);
await apiService.exportToXLS(accountId, data, headers);
await apiService.exportToPDF(accountId, data, headers);
await apiService.exportToEmail(accountId, data, headers);
await apiService.exportToGoogleSheets(accountId, data, headers);

// Detailed transaction exports
await apiService.exportDetailedToCSV(accountId, data, headers);
await apiService.exportDetailedToXLS(accountId, data, headers);
await apiService.exportDetailedToPDF(accountId, data, headers);
await apiService.exportDetailedToEmail(accountId, data, headers);
await apiService.exportDetailedToGoogleSheets(accountId, data, headers);
```

**Export Data Format:**
```javascript
const data = {
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  timezone: 'America/New_York',
  period: 'custom',
  email: 'recipient@example.com'  // Required for email exports
};
```

### API Endpoints Constants

```javascript
import { API_ENDPOINTS } from './services/api';

// Available endpoints
API_ENDPOINTS.LOGIN
API_ENDPOINTS.LOGOUT
API_ENDPOINTS.ME
API_ENDPOINTS.TIMEZONES
API_ENDPOINTS.ACCOUNTS
API_ENDPOINTS.MULTI_REPORTS(accountIds)
API_ENDPOINTS.DETAILED_TRANSACTIONS(accountIds)
API_ENDPOINTS.EXPORT_CSV(accountId)
API_ENDPOINTS.EXPORT_XLS(accountId)
API_ENDPOINTS.EXPORT_PDF(accountId)
API_ENDPOINTS.EXPORT_EMAIL(accountId)
API_ENDPOINTS.EXPORT_GOOGLE_SHEETS(accountId)
API_ENDPOINTS.EXPORT_DETAILED_CSV(accountId)
API_ENDPOINTS.EXPORT_DETAILED_XLS(accountId)
API_ENDPOINTS.EXPORT_DETAILED_PDF(accountId)
API_ENDPOINTS.EXPORT_DETAILED_EMAIL(accountId)
API_ENDPOINTS.EXPORT_DETAILED_GOOGLE_SHEETS(accountId)
API_ENDPOINTS.VALIDATE_KEYS
```

## Request/Response Formats

### Date Format

All dates should be in `YYYY-MM-DD` format (e.g., `2024-01-15`).

### Timezone Format

Timezones should be in IANA timezone format (e.g., `America/New_York`, `America/Chicago`).

### Period Options

- `daily`: Last 1 day
- `weekly`: Last 7 days
- `monthly`: Last 30 days
- `custom`: Requires `start_date` and `end_date`

### Amount Format

All amounts in responses are in cents (integer). Divide by 100 to get the actual amount.

Example: `10000` = $100.00

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or token expired
- `500 Internal Server Error`: Server error

### Frontend Error Handling

The frontend API service automatically handles:
- Token expiration (401) - clears token and redirects to login
- Network errors - returns error to caller
- Timeout errors - returns error after 30 seconds (or configured timeout)

### Example Error Handling

```javascript
try {
  const report = await apiService.getMultiAccountReport(accountIds, params, headers);
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('Error:', error.response.data.message);
  } else if (error.request) {
    // Request made but no response
    console.error('Network error');
  } else {
    // Something else happened
    console.error('Error:', error.message);
  }
}
```

## Rate Limiting

Currently, there are no rate limits implemented. However, for production deployments, consider implementing rate limiting to prevent abuse.

## Timeout Configuration

- **Default API timeout**: 30 seconds
- **Report generation**: 10 minutes (600 seconds)
- **Export operations**: 5 minutes (300 seconds)
- **Detailed transaction queries**: 5 minutes (300 seconds)

## Security Notes

1. **JWT Tokens**: Tokens expire after 24 hours. Refresh by logging in again.
2. **Stripe Keys**: Keys are encrypted before storage and decrypted only when needed.
3. **Password-Protected Exports**: All exports (except email) are password-protected using `STRIPE_IMPORT_PASSWORD`.
4. **CORS**: Configured via `CLIENT_URL` environment variable.
5. **HTTPS**: Required in production for secure data transmission.

---

For more information about the application setup, see `README.md`.


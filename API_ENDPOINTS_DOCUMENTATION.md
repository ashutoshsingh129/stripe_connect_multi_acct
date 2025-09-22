# API Endpoints Documentation - View Details Button

## 🔗 **API Endpoints Used for "View Details" Button**

### **1. Frontend → Backend API Call**
```
GET /api/reports/detailed/:accountIds
```
**Parameters:**
- `accountIds`: Comma-separated account IDs (e.g., `acct_1Rv19VIjIKaO3oJP,acct_1Rv0JHRACLlesk4B`)
- Query parameters: `start_date`, `end_date`, `timezone`, `page`, `limit`

**Example:**
```
GET /api/reports/detailed/acct_1Rv19VIjIKaO3oJP,acct_1Rv0JHRACLlesk4B?start_date=2024-01-01&end_date=2024-12-31&timezone=UTC&page=1&limit=50
```

### **2. Backend → Stripe API Calls (6 endpoints)**

When the backend receives the request, it calls **6 Stripe API endpoints** for each account:

#### **A. GET /v1/charges**
```javascript
stripe.charges.list({
  limit: 100,
  created: { gte: startTimestamp, lte: endTimestamp }
}, { stripeAccount: connectedAccountId })
```

#### **B. GET /v1/payment_intents**
```javascript
stripe.paymentIntents.list({
  limit: 100,
  created: { gte: startTimestamp, lte: endTimestamp }
}, { stripeAccount: connectedAccountId })
```

#### **C. GET /v1/balance_transactions**
```javascript
stripe.balanceTransactions.list({
  limit: 100,
  created: { gte: startTimestamp, lte: endTimestamp }
}, { stripeAccount: connectedAccountId })
```

#### **D. GET /v1/events**
```javascript
stripe.events.list({
  limit: 100,
  created: { gte: startTimestamp, lte: endTimestamp }
}, { stripeAccount: connectedAccountId })
```

#### **E. GET /v1/refunds**
```javascript
stripe.refunds.list({
  limit: 100,
  created: { gte: startTimestamp, lte: endTimestamp }
}, { stripeAccount: connectedAccountId })
```

#### **F. GET /v1/disputes**
```javascript
stripe.disputes.list({
  limit: 100,
  created: { gte: startTimestamp, lte: endTimestamp }
}, { stripeAccount: connectedAccountId })
```

## 🔄 **Complete Flow Diagram**

```
User clicks "View Details"
    ↓
Frontend: DetailedTransactionView.js
    ↓
API Call: GET /api/reports/detailed/:accountIds
    ↓
Backend: server/routes/reports.ts
    ↓
For each account ID:
    ├── GET /v1/charges (Stripe API)
    ├── GET /v1/payment_intents (Stripe API)
    ├── GET /v1/balance_transactions (Stripe API)
    ├── GET /v1/events (Stripe API)
    ├── GET /v1/refunds (Stripe API)
    └── GET /v1/disputes (Stripe API)
    ↓
Combine all data and return to frontend
    ↓
Frontend displays in DetailedTransactionView component
```

## 📊 **Data Retrieved**

From these 6 Stripe endpoints, you get:
- **Individual transaction records** (not aggregated)
- **Customer IP addresses** (from metadata)
- **Decline reasons** and failure codes
- **Risk levels** and processor status
- **Fraud details** and compliance data
- **Complete audit trail** from events
- **Financial reconciliation** data

## 🔍 **Key Differences from "Generate Report"**

| Feature | Generate Report | View Details |
|---------|----------------|--------------|
| **API Endpoint** | `/api/reports/multi/:accountIds` | `/api/reports/detailed/:accountIds` |
| **Stripe Endpoints** | 6 endpoints (same) | 6 endpoints (same) |
| **Data Processing** | Aggregated by date | Individual transactions |
| **Display** | Summary table | Detailed transaction list |
| **Pagination** | No | Yes (50 items per page) |
| **Export Options** | Yes | No |

## 🎯 **Summary**

**So when you click "View Details", it uses exactly 1 backend endpoint that internally calls 6 Stripe API endpoints for each selected account.**

## 📁 **File Locations**

- **Frontend Component**: `client/src/components/reports/DetailedTransactionView.js`
- **Backend Route**: `server/routes/reports.ts` (line ~261)
- **Stripe Service**: `server/services/stripeService.ts` (getComplianceTransactions method)
- **API Service**: `client/src/services/api.js` (getDetailedTransactions method)

## 🔧 **Technical Details**

### **Authentication**
- All Stripe API calls use the user's secret key
- Connected account access via `stripeAccount` parameter
- JWT token validation for backend routes

### **Pagination**
- Frontend: 50 items per page
- Backend: 100 items per Stripe API call
- Automatic pagination handling for large datasets

### **Error Handling**
- Comprehensive error logging
- Graceful fallback for failed API calls
- User-friendly error messages in frontend

### **Performance**
- Parallel execution of all 6 Stripe API calls
- Efficient data processing and aggregation
- Optimized for multiple account processing

## 📤 **Export Functionality**

### **Export Formats Available**
The DetailedTransactionView now supports **5 export formats** with encryption:

#### **1. CSV Export**
- **Endpoint**: `POST /api/export/detailed/csv/:accountIds`
- **Format**: Password-protected ZIP containing CSV file
- **Filename**: `stripe-detailed-transactions-{start_date}-{end_date}-PROTECTED.csv.zip`

#### **2. Excel Export**
- **Endpoint**: `POST /api/export/detailed/xls/:accountIds`
- **Format**: Password-protected ZIP containing XLSX file
- **Filename**: `stripe-detailed-transactions-{start_date}-{end_date}-PROTECTED.zip`

#### **3. PDF Export**
- **Endpoint**: `POST /api/export/detailed/pdf/:accountIds`
- **Format**: Password-protected ZIP containing PDF file
- **Filename**: `stripe-detailed-transactions-{start_date}-{end_date}-PROTECTED.pdf.zip`

#### **4. Email Export**
- **Endpoint**: `POST /api/export/detailed/email/:accountIds`
- **Format**: CSV attachment sent via email
- **Content**: Complete detailed transaction data

#### **5. Google Sheets Export**
- **Endpoint**: `POST /api/export/detailed/sheets/:accountIds`
- **Format**: Password-protected ZIP containing XLSX file
- **Filename**: `stripe-detailed-transactions-{start_date}-{end_date}-google-sheets-PROTECTED.zip`

### **Export Data Fields**
All export formats include these comprehensive fields:

| Field | Description | Source |
|-------|-------------|---------|
| **Account ID** | Connected account identifier | `accountId` |
| **Transaction Type** | `charge` or `payment_intent` | Transaction type |
| **ID** | Stripe transaction ID | `charge.id` or `payment_intent.id` |
| **Amount** | Transaction amount (in currency units) | `amount / 100` |
| **Currency** | Transaction currency | `currency` |
| **Status** | Transaction status | `status` |
| **Created** | Transaction creation timestamp | `created` (formatted) |
| **Paid** | Whether transaction was paid | `paid` or derived |
| **Captured** | Whether transaction was captured | `captured` or derived |
| **Disputed** | Whether transaction was disputed | `disputed` |
| **Failure Code** | Decline/failure code | `failure_code` |
| **Failure Message** | Decline/failure message | `failure_message` |
| **Network Status** | Processor network status | `outcome.network_status` |
| **Outcome Type** | Transaction outcome type | `outcome.type` |
| **Risk Level** | Fraud risk level | `outcome.risk_level` |
| **Seller Message** | Seller-facing message | `outcome.seller_message` |
| **Customer IP** | Customer IP address | `metadata.customer_ip` |
| **Description** | Transaction description | `description` |
| **Receipt Email** | Receipt email address | `receipt_email` |
| **Receipt URL** | Receipt URL | `receipt_url` |

### **Security Features**
- **Password Protection**: All exports are password-protected ZIP files
- **Encryption**: Stripe keys are encrypted in transit
- **Access Control**: JWT token validation required
- **Data Sanitization**: All fields are properly escaped and formatted

### **Export Process Flow**
```
User clicks export button in DetailedTransactionView
    ↓
Frontend calls appropriate export API endpoint
    ↓
Backend fetches detailed transaction data from Stripe
    ↓
Data is processed and formatted for export
    ↓
File is created (CSV/Excel/PDF) and password-protected
    ↓
ZIP file is sent to user or email attachment
```

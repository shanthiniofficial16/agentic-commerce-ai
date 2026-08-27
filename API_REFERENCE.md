# API Reference

Complete API documentation for the AI Commerce Platform.

## Base URL
- Development: `http://localhost:5000/api`
- Production: `https://api.yourdomain.com/api`

## Response Format

All responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

## Authentication

Most endpoints require JWT authentication. Include token in header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### Register User
```
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure123",
  "role": "CUSTOMER" // or "MERCHANT"
}

Response: 201
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "CUSTOMER",
      "merchantId": null
    }
  }
}
```

### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secure123"
}

Response: 200
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "CUSTOMER",
      "merchantId": null
    }
  }
}
```

### Get Current User
```
GET /auth/me
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "CUSTOMER",
    "merchantId": null
  }
}
```

---

## Product Endpoints

### List Products
```
GET /products?category=Laptops&minPrice=50000&maxPrice=80000&search=gaming&limit=20&skip=0
Authorization: Optional

Response: 200
{
  "success": true,
  "data": {
    "products": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Gaming Laptop Pro",
        "description": "High-performance gaming laptop",
        "category": "Laptops",
        "price": 64999,
        "currency": "INR",
        "stock": 15,
        "images": ["url1", "url2"],
        "tags": ["gaming", "laptop"],
        "specifications": {...},
        "active": true,
        "relatedProducts": [...]
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 20,
      "skip": 0,
      "hasMore": false
    }
  }
}
```

### Get Product Details
```
GET /products/507f1f77bcf86cd799439011

Response: 200
{
  "success": true,
  "data": {
    "product": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Gaming Laptop Pro",
      ...all product fields...,
      "relatedProducts": [
        {
          "name": "Related Product",
          "price": 2999,
          "stock": 50
        }
      ]
    }
  }
}
```

### Create Product
```
POST /products
Authorization: Bearer <merchant-token>
Content-Type: application/json

{
  "name": "New Product",
  "description": "Product description",
  "category": "Electronics",
  "price": 9999,
  "currency": "INR",
  "stock": 10,
  "images": ["url"],
  "tags": ["tag1", "tag2"],
  "specifications": {"key": "value"},
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 201
{
  "success": true,
  "data": {
    "product": {...created product...}
  }
}
```

### Update Product
```
PUT /products/507f1f77bcf86cd799439011
Authorization: Bearer <merchant-token>
Content-Type: application/json

{
  "name": "Updated Name",
  "price": 10999,
  ...other fields to update...
}

Response: 200
{
  "success": true,
  "data": {
    "product": {...updated product...}
  }
}
```

### Delete Product
```
DELETE /products/507f1f77bcf86cd799439011
Authorization: Bearer <merchant-token>

Response: 200
{
  "success": true,
  "message": "Product deleted"
}
```

### Update Inventory
```
PATCH /products/507f1f77bcf86cd799439011/inventory
Authorization: Bearer <merchant-token>
Content-Type: application/json

{
  "stock": 25
}

Response: 200
{
  "success": true,
  "data": {
    "product": {...product with updated stock...}
  }
}
```

---

## Cart Endpoints

### Get Cart
```
GET /cart?merchantId=507f1f77bcf86cd799439011
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "cart": {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "...",
      "merchantId": "...",
      "items": [
        {
          "productId": {...},
          "quantity": 2,
          "price": 9999
        }
      ],
      "subtotal": 19998,
      "discount": 0,
      "total": 19998,
      "status": "ACTIVE"
    }
  }
}
```

### Create Cart
```
POST /cart
Authorization: Bearer <token>
Content-Type: application/json

{
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 201
{
  "success": true,
  "data": {
    "cart": {...new cart...}
  }
}
```

### Add to Cart
```
POST /cart/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 2,
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 200
{
  "success": true,
  "data": {
    "cart": {...updated cart...}
  }
}
```

### Update Cart Item
```
PUT /cart/items/507f1f77bcf86cd799439011
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 5,
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 200
{
  "success": true,
  "data": {
    "cart": {...updated cart...}
  }
}
```

### Remove from Cart
```
DELETE /cart/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 200
{
  "success": true,
  "data": {
    "cart": {...updated cart...}
  }
}
```

### Validate Cart
```
POST /cart/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "cartId": "507f1f77bcf86cd799439011",
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 200
{
  "success": true,
  "data": {
    "valid": true,
    "errors": []
  }
}
```

---

## Agent Endpoints (Placeholder - Coming Soon)

### Chat with Agent
```
POST /agent/chat
Authorization: Bearer <customer-token>
Content-Type: application/json

{
  "message": "I need a gaming laptop under ₹70000",
  "sessionId": "session-123"
}

Response: 200
{
  "success": true,
  "data": {
    "message": "Agent response"
  }
}
```

### Get Agent-Readable Catalog
```
GET /agent/catalog?merchantId=507f1f77bcf86cd799439011

Response: 200
{
  "success": true,
  "data": {
    "merchant": {...},
    "products": [...],
    "policies": {
      "currency": "INR",
      "maxTransactionAmount": 100000
    }
  }
}
```

---

## Payment Endpoints (Placeholder - Coming Soon)

### Create Payment Order
```
POST /payments/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "cartId": "507f1f77bcf86cd799439011",
  "merchantId": "507f1f77bcf86cd799439011"
}

Response: 201
{
  "success": true,
  "data": {
    "payment": {...}
  }
}
```

### Verify Payment
```
POST /payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "razorpayOrderId": "order_123",
  "razorpayPaymentId": "pay_123",
  "razorpaySignature": "signature_123"
}

Response: 200
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

### Get Payment Status
```
GET /payments/507f1f77bcf86cd799439011
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "payment": {...}
  }
}
```

---

## Order Endpoints (Placeholder - Coming Soon)

### List Orders
```
GET /orders
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "orders": [...]
  }
}
```

### Get Order Details
```
GET /orders/507f1f77bcf86cd799439011
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "order": {...}
  }
}
```

---

## Merchant Endpoints (Placeholder - Coming Soon)

### Dashboard Metrics
```
GET /merchant/dashboard
Authorization: Bearer <merchant-token>

Response: 200
{
  "success": true,
  "data": {
    "dashboard": {...metrics...}
  }
}
```

### Analytics
```
GET /merchant/analytics
Authorization: Bearer <merchant-token>

Response: 200
{
  "success": true,
  "data": {
    "analytics": {...}
  }
}
```

### Audit Logs
```
GET /merchant/audit
Authorization: Bearer <merchant-token>

Response: 200
{
  "success": true,
  "data": {
    "auditLogs": [...]
  }
}
```

### Recommendations Performance
```
GET /merchant/recommendations
Authorization: Bearer <merchant-token>

Response: 200
{
  "success": true,
  "data": {
    "recommendations": [...]
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Input validation failed |
| UNAUTHORIZED | No authentication token |
| INVALID_TOKEN | Invalid or expired token |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| USER_EXISTS | User already exists |
| INVALID_CREDENTIALS | Invalid email or password |
| PRODUCT_NOT_FOUND | Product doesn't exist |
| OUT_OF_STOCK | Insufficient inventory |
| CART_NOT_FOUND | Cart doesn't exist |
| PRICE_CHANGE_DETECTED | Product price changed |
| PAYMENT_FAILED | Payment processing failed |
| INTERNAL_SERVER_ERROR | Server error |

---

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "role": "CUSTOMER"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

### Get Products
```bash
curl http://localhost:5000/api/products
```

---

## Rate Limiting

- Standard API endpoints: 100 requests per 15 minutes per IP
- Authentication endpoints: More strict limits apply

---

**Last Updated:** 2026-08-27  
**API Version:** 1.0.0

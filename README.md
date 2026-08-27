# AI Growth & Agentic Commerce Platform

## Project Overview

A complete, production-style MVP of an AI-native commerce platform where an AI agent acts as a merchant-side commerce assistant. The system enables intelligent product recommendations, upsell/cross-sell, secure payment processing via Razorpay, and complete audit trails.

## Technology Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Razorpay** - Payment gateway (TEST MODE)
- **Joi** - Validation

### AI Integration
- **LLM API** (configurable - OpenAI, Anthropic, etc.)
- **Tool/Function Calling** - Controlled agent interactions

## Project Structure

```
ai-commerce/
├── backend/
│   ├── src/
│   │   ├── app.js                 # Express app setup
│   │   ├── server.js              # Server entry point
│   │   ├── models/                # MongoDB models
│   │   │   ├── User.js
│   │   │   ├── Merchant.js
│   │   │   ├── Product.js
│   │   │   ├── Cart.js
│   │   │   ├── Order.js
│   │   │   ├── Payment.js
│   │   │   ├── Conversation.js
│   │   │   ├── AgentAction.js
│   │   │   ├── AuditLog.js
│   │   │   └── Recommendation.js
│   │   ├── controllers/           # Business logic
│   │   │   ├── auth.controller.js
│   │   │   ├── product.controller.js
│   │   │   └── cart.controller.js
│   │   ├── routes/                # API endpoints
│   │   │   ├── auth.routes.js
│   │   │   ├── product.routes.js
│   │   │   ├── cart.routes.js
│   │   │   ├── order.routes.js
│   │   │   ├── payment.routes.js
│   │   │   ├── agent.routes.js
│   │   │   ├── merchant.routes.js
│   │   │   └── audit.routes.js
│   │   ├── middleware/            # Custom middleware
│   │   │   └── auth.js
│   │   ├── services/              # Business services
│   │   ├── agents/                # AI agent logic
│   │   ├── tools/                 # Agent tools
│   │   ├── validators/            # Input validation
│   │   └── utils/                 # Utility functions
│   ├── .env                       # Environment variables
│   ├── .env.example               # Example env
│   ├── package.json
│   └── .gitignore
│
└── frontend/
    ├── src/
    │   ├── main.jsx               # React entry point
    │   ├── App.jsx                # Main app component
    │   ├── index.css              # Global styles
    │   ├── pages/                 # Page components
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── CustomerShop.jsx
    │   │   └── MerchantDashboard.jsx
    │   ├── components/            # Reusable components
    │   │   └── ProtectedRoute.jsx
    │   ├── hooks/                 # Custom hooks
    │   │   └── useAuth.js
    │   ├── context/               # React context
    │   │   └── AuthContext.jsx
    │   ├── services/              # API clients
    │   └── utils/                 # Utilities
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── package.json
    ├── .gitignore
    └── .env.example
```

## Setup & Installation

### Prerequisites
- Node.js 18+ installed
- MongoDB 5+ (local or Atlas)
- Git

### Environment Variables

#### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/ai-commerce
JWT_SECRET=your-secret-key
NODE_ENV=development

# AI API
AI_API_KEY=your-openai-key
AI_MODEL=gpt-4-turbo
AI_PROVIDER=openai

# Razorpay TEST MODE
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_test_secret

# URLs
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
PORT=5000
```

#### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

### Installation Steps

1. **Clone and navigate:**
```bash
cd ai-commerce
```

2. **Backend setup:**
```bash
cd backend
npm install
npm run seed  # Optional: seed development data
npm run dev   # Start development server on port 5000
```

3. **Frontend setup (in another terminal):**
```bash
cd frontend
npm install
npm run dev   # Start on port 5173
```

4. **Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

## Database Setup

### MongoDB Local Installation
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Windows
# Download from https://www.mongodb.com/try/download/community
# Install and run MongoDB

# Linux
sudo apt-get install -y mongodb

# Start MongoDB
mongod --dbpath /path/to/data
```

### MongoDB Atlas Cloud
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string
4. Add to .env: `MONGODB_URI=mongodb+srv://...`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (merchant only)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PATCH /api/products/:id/inventory` - Update inventory

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart` - Create cart
- `POST /api/cart/items` - Add to cart
- `PUT /api/cart/items/:productId` - Update item quantity
- `DELETE /api/cart/items` - Remove from cart
- `POST /api/cart/validate` - Validate cart

### Agent (Coming Soon)
- `POST /api/agent/chat` - Chat with AI agent
- `GET /api/agent/catalog` - Get agent-readable catalog

### Payments (Coming Soon)
- `POST /api/payments/create` - Create payment order
- `POST /api/payments/verify` - Verify payment
- `GET /api/payments/:id` - Get payment status

### Orders (Coming Soon)
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order details

### Merchant
- `GET /api/merchant/dashboard` - Dashboard metrics
- `GET /api/merchant/analytics` - Revenue analytics
- `GET /api/merchant/audit` - Audit logs
- `GET /api/merchant/recommendations` - Recommendation performance

## Database Schema

### User
```json
{
  "_id": ObjectId,
  "name": String,
  "email": String (unique),
  "passwordHash": String,
  "role": "CUSTOMER" | "MERCHANT" | "ADMIN",
  "merchantId": ObjectId (ref: Merchant),
  "isActive": Boolean,
  "createdAt": Date,
  "updatedAt": Date
}
```

### Product
```json
{
  "_id": ObjectId,
  "merchantId": ObjectId (ref: Merchant),
  "name": String,
  "description": String,
  "category": String,
  "price": Number,
  "currency": String,
  "stock": Number,
  "images": [String],
  "tags": [String],
  "specifications": Object,
  "active": Boolean,
  "relatedProducts": [ObjectId],
  "createdAt": Date,
  "updatedAt": Date
}
```

### Cart
```json
{
  "_id": ObjectId,
  "userId": ObjectId (ref: User),
  "merchantId": ObjectId (ref: Merchant),
  "items": [
    {
      "productId": ObjectId,
      "quantity": Number,
      "price": Number
    }
  ],
  "subtotal": Number,
  "discount": Number,
  "total": Number,
  "status": "ACTIVE" | "CHECKED_OUT" | "ABANDONED",
  "createdAt": Date,
  "updatedAt": Date
}
```

### Order
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "merchantId": ObjectId,
  "items": [...],
  "subtotal": Number,
  "discount": Number,
  "total": Number,
  "currency": String,
  "paymentId": ObjectId,
  "razorpayOrderId": String,
  "status": "PENDING_PAYMENT" | "PAID" | "PAYMENT_FAILED" | "CANCELLED" | "COMPLETED",
  "createdAt": Date,
  "updatedAt": Date
}
```

### Payment
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "merchantId": ObjectId,
  "orderId": ObjectId,
  "razorpayOrderId": String (unique),
  "razorpayPaymentId": String (unique),
  "amount": Number,
  "currency": String,
  "status": "PENDING" | "SUCCESS" | "FAILED",
  "failureReason": String,
  "verified": Boolean,
  "idempotencyKey": String,
  "createdAt": Date
}
```

## Security Features

- ✅ JWT authentication with 30-day expiration
- ✅ Password hashing with bcryptjs
- ✅ Role-based access control (RBAC)
- ✅ CORS configured
- ✅ Helmet security headers
- ✅ Rate limiting on API endpoints
- ✅ Input validation with Joi
- ✅ MongoDB query sanitization
- ✅ Server-side price calculation
- ✅ Server-side inventory validation
- ✅ Razorpay signature verification
- ✅ Environment variables for secrets
- ✅ Idempotency for payment operations

## Testing

### Manual Testing
1. **Register as Customer:**
   - Navigate to `/register`
   - Select "Customer" role
   - Register account

2. **Register as Merchant:**
   - Navigate to `/register`
   - Select "Merchant" role
   - Register account
   - Access merchant dashboard at `/merchant/dashboard`

3. **Product Management (Merchant):**
   - Create products with real prices and inventory
   - Test inventory validation
   - Test price changes

4. **Cart Operations:**
   - Add products to cart
   - Verify server-side calculations
   - Test quantity updates

5. **Payment (TEST MODE):**
   - Proceed to checkout
   - Use Razorpay test card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: Any 3 digits
   - Verify payment success/failure handling

### Automated Testing
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Running the Application

### Development Mode
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Production Build
```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## Demo Scenario - Success Flow

1. **Login as customer**
   - Email: customer@example.com
   - Password: test123

2. **Browse products**
   - Products from real database appear

3. **AI Assistant Chat**
   - "I need a gaming laptop under ₹70,000"
   - Agent returns real product recommendations

4. **Product Selection**
   - Customer selects a product
   - Agent recommends complementary items

5. **Add to Cart**
   - Items added with real prices
   - Server validates inventory and calculates total

6. **Checkout**
   - Confirm cart contents
   - Authorize payment

7. **Payment**
   - Razorpay TEST MODE checkout
   - Complete test payment

8. **Order Confirmation**
   - Order created after payment verification
   - Inventory updated
   - Audit trail recorded

9. **View Dashboard**
   - Login as merchant
   - See generated revenue
   - View conversion metrics

## Demo Scenario - Failure Handling

### Price Change Detection
1. Create cart with products at current price
2. Use database to change product price
3. Attempt checkout
4. System detects price change
5. Payment blocked with clear message
6. Audit log records price change event
7. Customer can refresh and retry

### Payment Failure
1. Proceed to checkout
2. Use Razorpay test failure card
3. Payment fails
4. System records failure
5. Order remains unpaid
6. Cart preserved for retry
7. User sees clear error message
8. Retry option available

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:**
- Ensure MongoDB is running: `mongod`
- Check MONGODB_URI in .env
- Try MongoDB Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/db`

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:**
- Change PORT in .env
- Kill existing process: `lsof -i :5000` then `kill -9 <PID>`

### CORS Errors
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:**
- Verify CLIENT_URL in backend .env
- Verify SERVER_URL in frontend .env
- Ensure Vite proxy is configured

### Authentication Errors
```
Invalid or expired token
```
**Solution:**
- Clear browser localStorage
- Logout and login again
- Check JWT_SECRET is consistent
- Verify token expiration: 30 days

## Contributing

1. Create a feature branch
2. Commit changes with clear messages
3. Push to branch
4. Create pull request

## License

MIT

## Support

For issues and questions:
1. Check troubleshooting section
2. Review API documentation
3. Check application logs
4. Verify database connectivity

---

**Built with ❤️ for AI-native commerce**

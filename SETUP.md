# Setup Guide - AI Growth & Agentic Commerce Platform

This guide will walk you through setting up the complete AI-powered commerce platform from scratch.

## Prerequisites

Before starting, ensure you have:
- **Node.js 18+** - Download from https://nodejs.org/
- **MongoDB 5+** - Download from https://www.mongodb.com/ (local) or use MongoDB Atlas (cloud)
- **Git** - For version control
- **npm** - Comes with Node.js

## Step 1: Verify Node.js Installation

```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 9.0.0 or higher
```

## Step 2: MongoDB Setup

### Option A: Local MongoDB (Recommended for Development)

#### Windows
1. Download MongoDB Community Edition from https://www.mongodb.com/try/download/community
2. Run the installer
3. Choose "Run MongoDB as a Windows Service" option
4. MongoDB will automatically start on port 27017

#### macOS
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux (Ubuntu/Debian)
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org
systemctl start mongod
```

#### Verify MongoDB is Running
```bash
# Should connect to MongoDB
mongosh
# Type: exit
```

### Option B: MongoDB Atlas (Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a project and cluster
4. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/ai-commerce`
5. Use this in your .env file

## Step 3: Project Setup

### Clone/Create Project

```bash
# Navigate to your desired directory
cd /path/to/projects

# Create project directory
mkdir ai-commerce
cd ai-commerce
```

### Backend Setup

```bash
# Navigate to backend
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# For local MongoDB, use: mongodb://localhost:27017/ai-commerce
# Make sure MONGODB_URI is set correctly

# Install dependencies
npm install

# Seed development data
npm run seed

# Expected output:
# ✓ Connected to MongoDB
# ✓ Cleared existing data
# ✓ Created merchant user
# ✓ Created merchant profile
# ✓ Created 8 test products
# ✓ Created customer user
# ✅ Seed completed successfully!
```

### Frontend Setup

```bash
# In another terminal, navigate to frontend
cd frontend

# Copy environment template
cp .env.example .env

# Install dependencies
npm install
```

## Step 4: Start the Application

### Terminal 1 - Backend Server

```bash
cd backend
npm run dev

# Expected output:
# ╔═══════════════════════════════════════════════════════════╗
# ║  AI Growth & Agentic Commerce Platform - Backend          ║
# ║  Server running on http://localhost:5000            ║
# ║  Environment: development                           ║
# ╚═══════════════════════════════════════════════════════════╝
# ✓ Connected to MongoDB: mongodb://localhost:27017/ai-commerce
```

### Terminal 2 - Frontend Server

```bash
cd frontend
npm run dev

# Expected output:
# VITE v5.1.1  ready in 356 ms
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

## Step 5: Access the Application

Open your browser and navigate to:

**Frontend:** http://localhost:5173

You should see the login page with the platform branding.

## Step 6: Test the Application

### Login as Customer

1. Click on "Register" link
2. Fill in the form:
   - Full Name: John Customer
   - Email: customer@test.com
   - Password: test123
   - Account Type: Customer
3. Click "Register"
4. You'll be redirected to the shop page

### Login as Merchant

1. Go back to register (or login page)
2. Click "Register"
3. Fill in the form:
   - Full Name: My Store
   - Email: merchant@test.com
   - Password: test123
   - Account Type: Merchant
4. Click "Register"
5. You'll be redirected to the merchant dashboard

### Using Seeded Data

Pre-seeded accounts (from `npm run seed`):

**Merchant Account:**
- Email: merchant@example.com
- Password: test123
- Products: 8 gaming and tech items

**Customer Account:**
- Email: customer@example.com
- Password: test123

## Step 7: Verify Backend APIs

### Health Check
```bash
curl http://localhost:5000/api/health
# Response: { "status": "OK", "timestamp": "..." }
```

### Test Authentication
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "role": "CUSTOMER"
  }'

# Response should include token and user data
```

### List Products
```bash
curl http://localhost:5000/api/products
# Should return list of seeded products
```

## Troubleshooting

### MongoDB Connection Error

**Error:** `connect ECONNREFUSED 127.0.0.1:27017`

**Solutions:**
1. Verify MongoDB is running:
   ```bash
   # Windows - Check Services
   # macOS
   brew services list
   # Linux
   systemctl status mongod
   ```

2. Check MongoDB port:
   ```bash
   netstat -an | grep 27017  # Linux/macOS
   netstat -ano | findstr :27017  # Windows
   ```

3. If using MongoDB Atlas, ensure:
   - Connection string is correct
   - Your IP is whitelisted in Atlas
   - Database user has proper permissions

### Port Already in Use

**Error:** `Error: listen EADDRINUSE :::5000`

**Solution:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

Or change the port in `.env`: `PORT=5001`

### Dependencies Installation Failed

**Error:** `npm error code ETARGET`

**Solution:**
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Delete node_modules and try again:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### CORS Error in Frontend

**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Solution:**
1. Verify backend .env has correct CLIENT_URL:
   ```
   CLIENT_URL=http://localhost:5173
   ```

2. Restart backend server

3. Clear browser cache (Ctrl+Shift+Delete)

### Authentication Token Issues

**Error:** `Invalid or expired token` when accessing protected routes

**Solution:**
1. Clear browser localStorage:
   ```javascript
   // In browser console
   localStorage.clear()
   ```

2. Logout and login again

3. Check backend JWT_SECRET is set:
   ```bash
   grep JWT_SECRET backend/.env
   ```

## Development Commands

### Backend
```bash
npm run dev        # Start development server with hot reload
npm start          # Start production server
npm run seed       # Populate database with test data
npm test           # Run tests
npm run lint       # Run linter
```

### Frontend
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run linter
```

## Next Steps

Now that the platform is running, you can:

1. **Explore the UI:**
   - Customer Shop (coming soon)
   - Merchant Dashboard (coming soon)
   - Create products as merchant
   - Browse products as customer

2. **Test APIs:**
   - Use Postman or curl to test endpoints
   - Check API documentation in README.md

3. **Implement Features:**
   - AI Agent chat functionality
   - Payment integration
   - Complete checkout flow
   - Analytics dashboard

4. **Configure AI:**
   - Get OpenAI API key: https://platform.openai.com/
   - Add to backend .env: `AI_API_KEY=sk_...`
   - Set `AI_MODEL=gpt-4-turbo`

5. **Setup Razorpay (TEST MODE):**
   - Create account: https://razorpay.com/
   - Get TEST mode keys
   - Add to .env: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
   - Use test card: 4111 1111 1111 1111

## Database Management

### View MongoDB Data

#### Using Mongo Shell
```bash
mongosh
use ai-commerce
db.users.find()
db.products.find()
db.orders.find()
```

#### Using MongoDB Compass (GUI)
1. Download from https://www.mongodb.com/products/compass
2. Connect to `mongodb://localhost:27017`
3. Browse collections visually

### Backup Data
```bash
# Export database
mongodump --db ai-commerce --out ./backup

# Import database
mongorestore --db ai-commerce ./backup/ai-commerce
```

## Production Deployment

### Before Deploying

1. Set `NODE_ENV=production` in .env
2. Generate strong JWT_SECRET
3. Use MongoDB Atlas for production database
4. Configure Razorpay LIVE mode keys
5. Set up proper error logging
6. Enable HTTPS
7. Configure rate limiting appropriately

### Deploy Backend (Example: Heroku)

```bash
# Install Heroku CLI
# heroku login
# heroku create ai-commerce-api
# git push heroku main
```

### Deploy Frontend (Example: Vercel)

```bash
# Install Vercel CLI
# vercel

# Or connect GitHub repo to Vercel dashboard
```

## Support & Debugging

### View Logs

**Backend Logs:**
```bash
# All requests and errors logged to terminal
# Check VSCODE_TARGET_SESSION_LOG for detailed logs
```

**Frontend Logs:**
```bash
# Open browser DevTools (F12)
# Check Console tab for errors
# Check Network tab for API calls
```

### Enable Debug Mode

```bash
# Backend
DEBUG=* npm run dev

# Check specific service
DEBUG=app:* npm run dev
```

## Resources

- [MongoDB Docs](https://docs.mongodb.com/)
- [Express.js Docs](https://expressjs.com/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Razorpay Docs](https://razorpay.com/docs/)
- [JWT Docs](https://jwt.io/)

---

If you encounter issues, check:
1. All prerequisites are installed
2. MongoDB is running
3. Correct .env files with proper values
4. Both servers are running on correct ports
5. Browser console and server logs for errors

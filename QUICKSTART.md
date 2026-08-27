# Quick Start Guide

Get the AI Commerce Platform running in 5 minutes!

## 📋 Prerequisites
- Node.js 18+ installed
- MongoDB running locally or MongoDB Atlas connection string

## 🚀 Quick Setup

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Configure Environment
```bash
# .env is already configured, but verify MONGODB_URI points to your MongoDB
cat .env
```

### Step 3: Seed Database (Optional but Recommended)
```bash
npm run seed
# Output will show test credentials
```

### Step 4: Start Backend (Terminal 1)
```bash
npm run dev
# Should show: Server running on http://localhost:5000
```

### Step 5: Install Frontend Dependencies (Terminal 2)
```bash
cd frontend
npm install
```

### Step 6: Start Frontend (Terminal 2)
```bash
npm run dev
# Should show: Local:   http://localhost:5173/
```

### Step 7: Open in Browser
Navigate to **http://localhost:5173**

---

## 🎯 Test the System

### Option A: Use Seeded Accounts
**Merchant:**
- Email: `merchant@example.com`
- Password: `test123`

**Customer:**
- Email: `customer@example.com`
- Password: `test123`

### Option B: Create New Accounts
1. Click "Register" on the login page
2. Fill in details
3. Choose role: CUSTOMER or MERCHANT
4. Click "Register"

---

## ✅ Verification Checklist

- [ ] Backend started successfully on port 5000
- [ ] Frontend started successfully on port 5173
- [ ] Can access http://localhost:5173 in browser
- [ ] Can login with credentials
- [ ] Can navigate to dashboard (customer or merchant)
- [ ] Check backend logs show no errors

---

## 🛠️ Troubleshooting

### Backend won't start
```bash
# Check MongoDB is running
mongosh

# Check port 5000 is free
netstat -ano | findstr :5000

# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Frontend won't start
```bash
# Clear Vite cache
rm -rf node_modules .vite
npm install
npm run dev
```

### CORS errors
- Restart backend server
- Clear browser cache
- Check .env files have correct URLs

---

## 📚 Next Steps

1. **Explore the Code**
   - Backend logic: `backend/src/controllers/`
   - Frontend components: `frontend/src/pages/`
   - Database models: `backend/src/models/`

2. **Test APIs with Curl/Postman**
   ```bash
   # Get all products
   curl http://localhost:5000/api/products

   # Login
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"customer@example.com","password":"test123"}'
   ```

3. **Review Documentation**
   - See `README.md` for full API docs
   - See `SETUP.md` for detailed setup
   - See `PROJECT_STATUS.md` for implementation status

4. **Implement Next Features**
   - AI Agent chat
   - Payment system
   - Order management
   - Merchant analytics

---

## 📞 Support

If you encounter issues:
1. Check `SETUP.md` troubleshooting section
2. Verify MongoDB is running
3. Verify both servers on correct ports
4. Check terminal output for error messages
5. Review browser console (F12) for frontend errors

---

**Everything working? Proceed to full documentation in `README.md` and `SETUP.md`**

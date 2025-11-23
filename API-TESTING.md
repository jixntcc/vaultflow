# API Testing Guide

Test your backend API after deployment using these examples.

## Using Browser (Easiest)

### 1. Health Check
Open in browser:
```
https://your-app.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "message": "VaultFlow API is running"
}
```

## Using curl (Command Line)

### 1. Health Check
```bash
curl https://your-app.onrender.com/health
```

### 2. Register New User
```bash
curl -X POST https://your-app.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123456"
  }'
```

Should return token and user info.

### 3. Login
```bash
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123456"
  }'
```

Copy the `token` from the response!

### 4. Get Vaults (Protected Endpoint)
```bash
curl https://your-app.onrender.com/api/vaults \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Replace `YOUR_TOKEN_HERE` with the token from login.

Should return 5 default vaults.

### 5. Create Transaction
```bash
curl -X POST https://your-app.onrender.com/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "date": "2025-11-18",
    "time": "9:00 AM",
    "type": "income",
    "amount": 10000,
    "category": "Salary",
    "notes": "Monthly salary"
  }'
```

### 6. Get All Transactions
```bash
curl https://your-app.onrender.com/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Using Postman

1. Download Postman: https://www.postman.com/downloads/
2. Create new request
3. Set URL: `https://your-app.onrender.com/api/auth/register`
4. Set method: POST
5. Set Headers:
   - Content-Type: application/json
6. Set Body (raw JSON):
   ```json
   {
     "username": "myuser",
     "password": "mypass123"
   }
   ```
7. Click Send

For protected endpoints, add Authorization header:
- Key: Authorization
- Value: Bearer YOUR_TOKEN_HERE

## Expected Responses

### Success Responses

**Register:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser"
  }
}
```

**Login:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser"
  }
}
```

**Get Vaults:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "name": "👑 Sovereign Capital Vault",
    "percentage": 50,
    "description": "Locked capital for empire building",
    "totalIncome": 0,
    "totalSpent": 0,
    "balance": 0
  },
  // ... 4 more vaults
]
```

### Error Responses

**Missing Token:**
```json
{
  "error": "Access token required"
}
```

**Invalid Credentials:**
```json
{
  "error": "Invalid credentials"
}
```

**Username Already Exists:**
```json
{
  "error": "Username already exists"
}
```

## Frontend Testing Checklist

Once deployed, test these flows:

- [ ] Open app URL in browser
- [ ] See login/signup page
- [ ] Click "Try Demo" - demo data loads
- [ ] Logout from demo
- [ ] Register new account with unique username
- [ ] Login with new account
- [ ] Dashboard loads with 5 default vaults (all zero balance)
- [ ] Click "Add Transaction"
- [ ] Add income: ₹10,000, Salary
- [ ] Submit - vaults auto-allocate:
  - Sovereign Capital: ₹5,000
  - Risk Lab: ₹2,000
  - Infrastructure: ₹1,000
  - Core Survival: ₹1,000
  - Chaos Play: ₹1,000
- [ ] Click "Add Transaction" again
- [ ] Add expense: ₹300, Food, 1:30 PM, "Juma Masjid, Delhi"
- [ ] Select vault: Chaos Play Vault
- [ ] Submit - Chaos Play balance decreases to ₹700
- [ ] Navigate to "Transaction Log" - see both transactions
- [ ] Navigate to "Future Goals"
- [ ] Add goal: "New Laptop", ₹50,000, Core Survival Vault
- [ ] See progress: 2% (₹1,000/₹50,000)
- [ ] Navigate to "Monthly Reports"
- [ ] See current month income: ₹10,000
- [ ] See current month expense: ₹300
- [ ] See net savings: ₹9,700
- [ ] Navigate to "Vault Balances"
- [ ] See all 5 vaults with correct balances
- [ ] Logout
- [ ] Close browser completely
- [ ] Open browser again
- [ ] Navigate to app URL
- [ ] Login with same credentials
- [ ] All data is still there! ✅

## Troubleshooting

### Cannot connect to backend
1. Check Render service is running (green status)
2. Check Render logs for errors
3. Verify MongoDB connection in environment variables
4. Test health endpoint first

### 401 Unauthorized errors
1. Token expired (login again)
2. Token not included in request
3. Token format wrong (should be: Bearer <token>)

### 500 Server errors
1. Check Render logs
2. MongoDB connection issue
3. Missing environment variables
4. Database operation failed

### CORS errors
1. Frontend and backend on different domains
2. Check CORS is enabled in server.js (it is)
3. Verify API_BASE_URL in frontend is correct

## Success Indicators

Your deployment is successful if:
- ✅ Health endpoint returns 200 OK
- ✅ Can register new user
- ✅ Can login and get token
- ✅ Can access protected endpoints with token
- ✅ Vault auto-allocation works
- ✅ Data persists after logout/login
- ✅ Frontend connects to backend
- ✅ No CORS errors in browser console

## Performance Notes

**First Request (Cold Start):**
- Free tier services sleep after 15 min inactivity
- First request takes 30-60 seconds to wake up
- This is normal behavior

**Subsequent Requests:**
- Should be fast (< 1 second)
- Database queries optimized
- JWT validation is quick

**Keeping Warm (Optional):**
- Use UptimeRobot to ping every 5 minutes
- Prevents cold starts
- Free tier: https://uptimerobot.com

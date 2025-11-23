# 🏗️ VaultFlow System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Frontend (HTML + CSS + JavaScript)         │    │
│  │                                                      │    │
│  │  • Login/Signup UI                                   │    │
│  │  • Dashboard with Vault Balances                     │    │
│  │  • Transaction Log (with Time + Location)            │    │
│  │  • Goal Tracking                                     │    │
│  │  • Monthly/Annual Reports                            │    │
│  │  • Analytics & Visualizations                        │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │ HTTPS Requests                         │
│                     │ (with JWT Token)                       │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDER.COM (FREE TIER)                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Backend API (Node.js + Express)            │    │
│  │                                                      │    │
│  │  Authentication Routes:                              │    │
│  │    POST /api/auth/register                           │    │
│  │    POST /api/auth/login                              │    │
│  │                                                      │    │
│  │  Vault Routes:                                       │    │
│  │    GET    /api/vaults                                │    │
│  │    POST   /api/vaults                                │    │
│  │    PUT    /api/vaults/:id                            │    │
│  │    DELETE /api/vaults/:id                            │    │
│  │                                                      │    │
│  │  Transaction Routes:                                 │    │
│  │    GET    /api/transactions                          │    │
│  │    POST   /api/transactions                          │    │
│  │    PUT    /api/transactions/:id                      │    │
│  │    DELETE /api/transactions/:id                      │    │
│  │                                                      │    │
│  │  Goal Routes:                                        │    │
│  │    GET    /api/goals                                 │    │
│  │    POST   /api/goals                                 │    │
│  │    PUT    /api/goals/:id                             │    │
│  │    DELETE /api/goals/:id                             │    │
│  │                                                      │    │
│  │  Analytics Routes:                                   │    │
│  │    GET /api/analytics/summary                        │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │ MongoDB Queries                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              MONGODB ATLAS (FREE M0 TIER)                    │
│                                                              │
│  Database: vaultflow                                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Collection: users                                   │    │
│  │    • username (unique)                               │    │
│  │    • password (bcrypt hashed)                        │    │
│  │    • createdAt                                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Collection: vaults                                  │    │
│  │    • userId (reference)                              │    │
│  │    • name (e.g., "👑 Sovereign Capital Vault")       │    │
│  │    • percentage (50, 20, 10, 10, 10)                │    │
│  │    • description                                     │    │
│  │    • totalIncome, totalSpent, balance                │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Collection: transactions                            │    │
│  │    • userId (reference)                              │    │
│  │    • date, time, type                                │    │
│  │    • amount, category                                │    │
│  │    • location (NEW: "Delhi", "Juma Masjid")         │    │
│  │    • vaultId, vaultName                              │    │
│  │    • notes (journey diary)                           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Collection: goals                                   │    │
│  │    • userId (reference)                              │    │
│  │    • name, targetAmount, currentAmount               │    │
│  │    • vaultId, deadline, status                       │    │
│  │    • notes                                           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Storage: 512 MB FREE (100,000+ transactions)                │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### 1. User Registration
```
Browser                 Backend                   Database
  │                       │                         │
  │  POST /register       │                         │
  │  {username, pass} ───>│                         │
  │                       │                         │
  │                       │  Hash password          │
  │                       │  (bcrypt)               │
  │                       │                         │
  │                       │  Create user        ───>│
  │                       │                         │
  │                       │  Create 5 vaults    ───>│
  │                       │                         │
  │                       │<─── User + Vaults saved │
  │                       │                         │
  │                       │  Generate JWT           │
  │                       │  (30-day expiry)        │
  │                       │                         │
  │<─── {token, user}     │                         │
  │                       │                         │
  │  Store token          │                         │
  │  Navigate to dashboard│                         │
```

### 2. Add Income (Auto-Allocation)
```
Browser                 Backend                   Database
  │                       │                         │
  │  POST /transactions   │                         │
  │  {type: income,       │                         │
  │   amount: 10000} ────>│                         │
  │                       │                         │
  │                       │  Verify JWT token       │
  │                       │                         │
  │                       │  Get user's vaults  ───>│
  │                       │<─── 5 vaults            │
  │                       │                         │
  │                       │  Calculate allocations: │
  │                       │   • Sovereign: ₹5,000   │
  │                       │   • Risk Lab: ₹2,000    │
  │                       │   • Infra: ₹1,000       │
  │                       │   • Survival: ₹1,000    │
  │                       │   • Chaos: ₹1,000       │
  │                       │                         │
  │                       │  Save transaction   ───>│
  │                       │                         │
  │                       │  Update each vault  ───>│
  │                       │   +income, +balance     │
  │                       │                         │
  │                       │<─── Success             │
  │<─── Transaction saved │                         │
  │                       │                         │
  │  Refresh UI           │                         │
  │  Show updated balances│                         │
```

### 3. Add Expense with Diary Details
```
Browser                 Backend                   Database
  │                       │                         │
  │  POST /transactions   │                         │
  │  {type: expense,      │                         │
  │   amount: 300,        │                         │
  │   time: "1:30 PM",    │                         │
  │   location: "Delhi",  │                         │
  │   vaultId: chaos,     │                         │
  │   notes: "Biryani"} ─>│                         │
  │                       │                         │
  │                       │  Verify JWT token       │
  │                       │                         │
  │                       │  Save transaction   ───>│
  │                       │  (with time, location)  │
  │                       │                         │
  │                       │  Get Chaos vault    ───>│
  │                       │<─── Vault (balance:1000)│
  │                       │                         │
  │                       │  Update Chaos vault ───>│
  │                       │   +spent (300)          │
  │                       │   -balance (300)        │
  │                       │   New balance: 700      │
  │                       │                         │
  │<─── Transaction saved │                         │
  │                       │                         │
  │  Update timeline view │                         │
  │  Show: 1:30 PM | ₹300 │                         │
  │        📍 Delhi       │                         │
```

### 4. View Dashboard
```
Browser                 Backend                   Database
  │                       │                         │
  │  GET /vaults          │                         │
  │  (with JWT token) ───>│                         │
  │                       │                         │
  │                       │  Verify token           │
  │                       │                         │
  │                       │  Query user's vaults ──>│
  │                       │<─── All vaults          │
  │<─── Vault data        │                         │
  │                       │                         │
  │  GET /transactions    │                         │
  │  (with JWT token) ───>│                         │
  │                       │                         │
  │                       │  Query transactions ───>│
  │                       │<─── All transactions    │
  │<─── Transaction data  │                         │
  │                       │                         │
  │  Render dashboard     │                         │
  │  • Vault balances     │                         │
  │  • Recent transactions│                         │
  │  • Monthly totals     │                         │
```

## Security Flow

### Authentication Flow
```
1. User submits credentials
   ↓
2. Backend hashes password (bcrypt, 10 rounds)
   ↓
3. Compares with stored hash
   ↓
4. If match: Generate JWT token
   {
     userId: "...",
     username: "...",
     exp: (30 days from now)
   }
   ↓
5. Sign with JWT_SECRET
   ↓
6. Return token to browser
   ↓
7. Browser stores token (in memory)
   ↓
8. All subsequent requests include token:
   Authorization: Bearer <token>
   ↓
9. Backend verifies token on each request
   ↓
10. If valid: Process request
    If invalid: Return 401 Unauthorized
```

## Component Responsibilities

### Frontend (Browser)
- ✅ User interface and interactions
- ✅ Form validation
- ✅ Data visualization
- ✅ Token storage (in memory)
- ✅ HTTP requests to backend
- ❌ NO business logic
- ❌ NO direct database access
- ❌ NO password storage

### Backend (Render)
- ✅ API endpoints
- ✅ Authentication & authorization
- ✅ Business logic (vault calculations)
- ✅ Data validation
- ✅ Database operations
- ✅ Security (password hashing, JWT)
- ❌ NO UI rendering
- ❌ NO data visualization

### Database (MongoDB Atlas)
- ✅ Data persistence
- ✅ Query optimization
- ✅ Data relationships
- ✅ Automatic backups
- ✅ Scalability
- ❌ NO business logic
- ❌ NO authentication (handled by backend)

## Deployment Architecture

```
GitHub Repository
  │
  │ Push code
  │
  ▼
Render Build System
  │
  │ 1. Detect Node.js
  │ 2. Run: npm install
  │ 3. Run: npm start
  │
  ▼
Render Container
  │
  │ Environment Variables:
  │  • MONGODB_URI
  │  • JWT_SECRET
  │  • PORT
  │
  ▼
Running Web Service
  │
  │ URL: https://your-app.onrender.com
  │ SSL: Automatic (HTTPS)
  │ Uptime: 24/7
  │ Cost: $0
  │
  ▼
Connected to MongoDB Atlas
  │
  │ Connection String
  │ Username/Password Auth
  │ 512 MB Storage
  │
  ▼
Data Persists Forever
```

## Scaling Considerations

### Current Capacity (Free Tier)
- **Users**: Unlimited
- **Transactions**: 100,000+
- **Storage**: 512 MB
- **Bandwidth**: 100 GB/month
- **Uptime**: 750 hours/month (24/7)

### When to Upgrade
- If you get 1000+ active users
- If transactions exceed 100,000
- If you need faster response times
- If you want custom domain

### Upgrade Path
1. **Render**: $7/month (faster, no cold starts)
2. **MongoDB**: $9/month (2 GB storage)
3. **Total**: $16/month for professional tier

But free tier is perfect for personal use and small teams!

## Technology Choices Explained

### Why Node.js?
- ✅ Fast and efficient
- ✅ JavaScript everywhere (frontend + backend)
- ✅ Huge ecosystem (npm packages)
- ✅ Great for APIs
- ✅ Easy to deploy

### Why MongoDB?
- ✅ Flexible schema (easy to modify)
- ✅ JSON-like documents (natural for JS)
- ✅ Generous free tier (512 MB)
- ✅ Excellent documentation
- ✅ Built-in relationships

### Why Render?
- ✅ True free tier (no credit card)
- ✅ Auto-deploy from GitHub
- ✅ Free SSL certificates
- ✅ Simple configuration
- ✅ Reliable uptime

### Why JWT?
- ✅ Stateless authentication
- ✅ No session storage needed
- ✅ Works across devices
- ✅ Secure (signed + expiry)
- ✅ Industry standard

## File Structure Explained

```
vaultflow/
│
├── server.js                 # Main backend server
│   ├── Express app setup
│   ├── Middleware (CORS, JSON)
│   ├── MongoDB models
│   ├── Authentication middleware
│   └── All API routes
│
├── package.json              # Dependencies and scripts
│   ├── express (web framework)
│   ├── mongoose (MongoDB ODM)
│   ├── bcryptjs (password hashing)
│   ├── jsonwebtoken (JWT auth)
│   └── dotenv (environment variables)
│
├── .env                      # Secret configuration (NOT in git)
│   ├── MONGODB_URI
│   ├── JWT_SECRET
│   └── PORT
│
├── .gitignore               # Files to exclude from git
│   ├── node_modules/
│   ├── .env
│   └── *.log
│
├── public/
│   └── index.html           # Frontend application
│       ├── HTML structure
│       ├── CSS styling
│       └── JavaScript logic
│
└── Documentation/
    ├── README.md            # Project overview
    ├── DEPLOYMENT-GUIDE.md  # Step-by-step deployment
    ├── API-INTEGRATION.md   # Connect frontend to backend
    ├── API-TESTING.md       # How to test the API
    └── ARCHITECTURE.md      # This file
```

## Summary

**You now have:**
- ✅ Complete full-stack financial tracking system
- ✅ Secure multi-user authentication
- ✅ Vault-based budget management
- ✅ Journey diary with time/location tracking
- ✅ Goal tracking and analytics
- ✅ Free lifetime hosting
- ✅ Permanent data storage
- ✅ Production-ready architecture
- ✅ Comprehensive documentation

**Total cost:** $0/month forever

**Deployment time:** 15 minutes

**Maintenance:** Minimal (just use it!)

Ready to deploy? Follow **DEPLOYMENT-GUIDE.md** 🚀

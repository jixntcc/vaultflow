# 💰 VaultFlow - Personal Finance Vault Manager

A comprehensive financial tracking application with vault-based budgeting, wallet management, and goal tracking.

## ✨ Features

- **🏦 Vault System**: Auto-allocate income across 5 customizable vaults
- **👛 Dual Wallets**: Track HR and HL wallet balances separately
- **📊 Dashboard**: Real-time financial overview
- **💳 Transaction Tracking**: Record income and expenses with time, location, and notes
- **🎯 Goal Setting**: Set and track financial goals
- **📈 Reports**: Monthly and annual financial summaries
- **🎨 Beautiful UI**: Modern, responsive design
- **🔐 Secure Auth**: JWT-based authentication
- **☁️ Cloud Storage**: MongoDB Atlas for permanent data storage

## 🚀 Live Demo

**Demo Mode Available**: Try the app without signup!

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Responsive design (mobile-friendly)

**Backend:**
- Node.js + Express
- MongoDB (Mongoose)
- JWT Authentication
- bcrypt for password hashing

**Deployment:**
- Vercel (Frontend + Backend)
- MongoDB Atlas (Database)

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account
- Git

### Local Setup

1. **Clone the repository**
```bash
git clone https://github.com/YOUR-USERNAME/vaultflow.git
cd vaultflow
```

2. **Install dependencies**
```bash
npm install
```

3. **Create .env file**
```bash
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key
PORT=3000
```

4. **Start the server**
```bash
npm start
```

5. **Open in browser**
```
http://localhost:3000
```

## 🌐 Deployment

See [VERCEL-DEPLOY.md](VERCEL-DEPLOY.md) for detailed deployment instructions.

### Quick Deploy

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy!

## 📖 Usage

### Default Vaults

New users automatically get 5 vaults:
- 👑 **Sovereign Capital Vault** (50%) - Long-term savings
- 🧪 **Risk Lab Wallet** (20%) - Investments and experiments
- 🧱 **Infrastructure Vault** (10%) - Tools and resources
- 🔒 **Core Survival Vault** (10%) - Essential expenses
- 🎭 **Chaos Play Vault** (10%) - Discretionary spending

### Wallets

Two separate wallets for tracking:
- **HR Wallet** - Wallet 1
- **HL Wallet** - Wallet 2

### Transaction Flow

**Income:**
1. Choose wallet to receive money
2. Money auto-distributes across vaults
3. Track complete financial journey

**Expense:**
1. Choose vault to deduct from
2. Choose wallet that paid
3. Both balances update

## 🎯 Features Breakdown

### Dashboard
- Wallet balances overview
- Total income/expenses
- Net savings and rate
- Recent transactions

### Transactions
- Add/edit/delete transactions
- Time and location tracking
- Search and filter
- Full transaction history

### Vaults
- Create custom vaults
- Adjust allocation percentages
- Track vault balances
- View vault statistics

### Wallets
- Track HR and HL wallet balances
- View income vs spending per wallet
- Current balance tracking

### Goals
- Set financial targets
- Track progress
- Link to vaults
- Deadline reminders

### Reports
- Monthly summaries
- Annual totals
- Savings rate
- Financial trends

## 🔒 Security

- JWT-based authentication
- bcrypt password hashing
- Secure MongoDB connection
- Environment variable protection

## 📱 Mobile Responsive

Fully responsive design works on:
- 📱 Mobile phones
- 💻 Tablets
- 🖥️ Desktop computers

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 👤 Author

Created with ❤️ for better financial tracking

## 🙏 Acknowledgments

- Icons: Emoji
- Database: MongoDB Atlas
- Hosting: Vercel

## 📞 Support

For issues or questions:
1. Check existing GitHub issues
2. Create new issue with details
3. Include screenshots if applicable

## 🔮 Roadmap

Potential future features:
- Data export (CSV, PDF)
- Budget alerts
- Recurring transactions
- Category analytics
- Multi-currency support
- Dark mode

---

**Start tracking your finances better today!** 💰📊🚀

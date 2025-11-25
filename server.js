/**
 * VaultFlow Financial Tracker - Backend Server (Vercel Optimized)
 * Node.js + Express + MongoDB
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all non-API routes
app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

// ============================================
// MONGODB CONNECTION (VERCEL OPTIMIZED)
// ============================================

let cachedConnection = null;

async function connectToDatabase() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        console.log('✅ Using cached MongoDB connection');
        return cachedConnection;
    }

    try {
        const opts = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 second timeout
            socketTimeoutMS: 45000, // 45 second timeout
            maxPoolSize: 10,
            minPoolSize: 2,
            bufferCommands: false
        };

        console.log('🔄 Connecting to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI, opts);
        cachedConnection = conn;
        console.log('✅ MongoDB Connected');
        return conn;
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        throw err;
    }
}

// ============================================
// MODELS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Vault Schema
const vaultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    percentage: { type: Number, required: true },
    description: { type: String },
    totalIncome: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Vault = mongoose.model('Vault', vaultSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    time: { type: String },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    location: { type: String },
    wallet: { type: String, enum: ['HR', 'HL'] },
    vaultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' },
    vaultName: { type: String },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Goal Schema (FIXED)
const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    vaultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' }, // Made optional
    vaultName: { type: String },
    deadline: { type: Date },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const Goal = mongoose.model('Goal', goalSchema);

// ============================================
// MIDDLEWARE
// ============================================

// Database connection middleware
const ensureConnection = async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    } catch (error) {
        console.error('Database connection failed:', error);
        return res.status(503).json({ error: 'Database connection failed' });
    }
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register
app.post('/api/auth/register', ensureConnection, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            password: hashedPassword
        });

        await user.save();

        // Create default vaults
        const defaultVaults = [
            { name: 'Sovereign Capital Vault', percentage: 50, description: 'Locked capital for empire building' },
            { name: 'Risk Lab Wallet', percentage: 20, description: 'For trades, loops, experiments' },
            { name: 'Infrastructure Vault', percentage: 10, description: 'For tools, scripts, books' },
            { name: 'Core Survival Vault', percentage: 10, description: 'Essential needs' },
            { name: 'Chaos Play Vault', percentage: 10, description: 'Spend freely' }
        ];

        for (const vaultData of defaultVaults) {
            const vault = new Vault({
                userId: user._id,
                ...vaultData
            });
            await vault.save();
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user._id, username: user.username }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', ensureConnection, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ============================================
// VAULT ROUTES (OPTIMIZED)
// ============================================

// Get all vaults
app.get('/api/vaults', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const vaults = await Vault.find({ userId: req.user.userId })
            .sort({ createdAt: 1 })
            .lean()
            .maxTimeMS(10000);
        
        res.json(vaults);
    } catch (error) {
        console.error('Get vaults error:', error);
        res.status(500).json({ error: 'Server error fetching vaults' });
    }
});

// Create vault
app.post('/api/vaults', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const { name, percentage, description } = req.body;

        if (!name || percentage === undefined) {
            return res.status(400).json({ error: 'Name and percentage required' });
        }

        const vault = new Vault({
            userId: req.user.userId,
            name,
            percentage,
            description
        });

        await vault.save();
        res.status(201).json(vault);

    } catch (error) {
        console.error('Create vault error:', error);
        res.status(500).json({ error: 'Server error creating vault' });
    }
});

// Update vault
app.put('/api/vaults/:id', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const { name, percentage, description } = req.body;

        const vault = await Vault.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { name, percentage, description },
            { new: true }
        );

        if (!vault) {
            return res.status(404).json({ error: 'Vault not found' });
        }

        res.json(vault);

    } catch (error) {
        console.error('Update vault error:', error);
        res.status(500).json({ error: 'Server error updating vault' });
    }
});

// Delete vault
app.delete('/api/vaults/:id', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const vault = await Vault.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!vault) {
            return res.status(404).json({ error: 'Vault not found' });
        }

        res.json({ message: 'Vault deleted successfully' });

    } catch (error) {
        console.error('Delete vault error:', error);
        res.status(500).json({ error: 'Server error deleting vault' });
    }
});

// ============================================
// TRANSACTION ROUTES
// ============================================

// Get all transactions
app.get('/api/transactions', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId })
            .sort({ date: -1, time: -1 })
            .lean()
            .maxTimeMS(10000);
        
        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Server error fetching transactions' });
    }
});

// Create transaction
app.post('/api/transactions', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const { date, time, type, amount, category, location, wallet, vaultId, vaultName, notes } = req.body;

        if (!date || !type || !amount || !category) {
            return res.status(400).json({ error: 'Date, type, amount, and category required' });
        }

        const transaction = new Transaction({
            userId: req.user.userId,
            date,
            time,
            type,
            amount,
            category,
            location,
            wallet,
            vaultId: vaultId || null,
            vaultName,
            notes
        });

        await transaction.save();

        // Update vault balances
        if (type === 'income') {
            const vaults = await Vault.find({ userId: req.user.userId });
            for (const vault of vaults) {
                const allocation = (amount * vault.percentage) / 100;
                vault.totalIncome += allocation;
                vault.balance += allocation;
                await vault.save();
            }
        } else if (type === 'expense' && vaultId) {
            const vault = await Vault.findById(vaultId);
            if (vault) {
                vault.totalSpent += amount;
                vault.balance -= amount;
                await vault.save();
            }
        }

        res.status(201).json(transaction);

    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Server error creating transaction' });
    }
});

// Update transaction
app.put('/api/transactions/:id', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const { date, time, type, amount, category, location, wallet, vaultId, vaultName, notes } = req.body;

        const oldTransaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!oldTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Reverse old effects
        if (oldTransaction.type === 'income') {
            const vaults = await Vault.find({ userId: req.user.userId });
            for (const vault of vaults) {
                const allocation = (oldTransaction.amount * vault.percentage) / 100;
                vault.totalIncome -= allocation;
                vault.balance -= allocation;
                await vault.save();
            }
        } else if (oldTransaction.type === 'expense' && oldTransaction.vaultId) {
            const vault = await Vault.findById(oldTransaction.vaultId);
            if (vault) {
                vault.totalSpent -= oldTransaction.amount;
                vault.balance += oldTransaction.amount;
                await vault.save();
            }
        }

        // Update transaction
        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { date, time, type, amount, category, location, wallet, vaultId: vaultId || null, vaultName, notes },
            { new: true }
        );

        // Apply new effects
        if (type === 'income') {
            const vaults = await Vault.find({ userId: req.user.userId });
            for (const vault of vaults) {
                const allocation = (amount * vault.percentage) / 100;
                vault.totalIncome += allocation;
                vault.balance += allocation;
                await vault.save();
            }
        } else if (type === 'expense' && vaultId) {
            const vault = await Vault.findById(vaultId);
            if (vault) {
                vault.totalSpent += amount;
                vault.balance -= amount;
                await vault.save();
            }
        }

        res.json(transaction);

    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ error: 'Server error updating transaction' });
    }
});

// Delete transaction
app.delete('/api/transactions/:id', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Reverse effects
        if (transaction.type === 'income') {
            const vaults = await Vault.find({ userId: req.user.userId });
            for (const vault of vaults) {
                const allocation = (transaction.amount * vault.percentage) / 100;
                vault.totalIncome -= allocation;
                vault.balance -= allocation;
                await vault.save();
            }
        } else if (transaction.type === 'expense' && transaction.vaultId) {
            const vault = await Vault.findById(transaction.vaultId);
            if (vault) {
                vault.totalSpent -= transaction.amount;
                vault.balance += transaction.amount;
                await vault.save();
            }
        }

        await Transaction.findByIdAndDelete(req.params.id);
        res.json({ message: 'Transaction deleted successfully' });

    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: 'Server error deleting transaction' });
    }
});

// ============================================
// GOAL ROUTES (FIXED)
// ============================================

// Get all goals (AUTO-UPDATE CURRENT AMOUNT FROM VAULT BALANCE)
app.get('/api/goals', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const goals = await Goal.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .lean()
            .maxTimeMS(10000);
        
        // Get all user's vaults for balance lookup
        const vaults = await Vault.find({ userId: req.user.userId }).lean();
        const vaultMap = {};
        vaults.forEach(vault => {
            vaultMap[String(vault._id)] = vault.balance || 0;
        });

        // Auto-update goal.currentAmount with linked vault's balance
        goals.forEach(goal => {
            if (goal.vaultId && vaultMap[String(goal.vaultId)]) {
                goal.currentAmount = vaultMap[String(goal.vaultId)];
            }
        });

        res.json(goals);
    } catch (error) {
        console.error('Get goals error:', error);
        res.status(500).json({ error: 'Server error fetching goals' });
    }
});


// Create goal (FIXED)
app.post('/api/goals', ensureConnection, authenticateToken, async (req, res) => {
    try {
        let { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes } = req.body;

        if (!name || !targetAmount) {
            return res.status(400).json({ error: 'Name and target amount required' });
        }

        // FIX: Handle empty vaultId
        if (vaultId === '' || vaultId === 'null' || vaultId === 'undefined') {
            vaultId = null;
        }

        const goal = new Goal({
            userId: req.user.userId,
            name,
            targetAmount,
            currentAmount: currentAmount || 0,
            vaultId: vaultId || null,
            vaultName,
            deadline,
            status: status || 'active',
            notes
        });

        await goal.save();
        res.status(201).json(goal);

    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Server error creating goal' });
    }
});

// Update goal (FIXED)
app.put('/api/goals/:id', ensureConnection, authenticateToken, async (req, res) => {
    try {
        let { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes } = req.body;

        // FIX: Handle empty vaultId
        if (vaultId === '' || vaultId === 'null' || vaultId === 'undefined') {
            vaultId = null;
        }

        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { name, targetAmount, currentAmount, vaultId: vaultId || null, vaultName, deadline, status, notes },
            { new: true }
        );

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        res.json(goal);

    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Server error updating goal' });
    }
});

// Delete goal
app.delete('/api/goals/:id', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        res.json({ message: 'Goal deleted successfully' });

    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Server error deleting goal' });
    }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

// Get dashboard summary
app.get('/api/analytics/summary', ensureConnection, authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId }).lean();

        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : 0;

        res.json({
            totalIncome,
            totalExpenses,
            netSavings,
            savingsRate,
            transactionCount: transactions.length
        });

    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Server error fetching summary' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'VaultFlow API is running' });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 VaultFlow server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
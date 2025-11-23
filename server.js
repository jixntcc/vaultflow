/**
 * VaultFlow Financial Tracker - Backend Server
 * Node.js + Express + MongoDB
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

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

// Transaction Schema (UPDATED with wallet field)
const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    time: { type: String }, // NEW: Time field
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    location: { type: String }, // NEW: Location field
    wallet: { type: String, enum: ['HR', 'HL'] }, // NEW: Wallet field (HR or HL)
    vaultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' },
    vaultName: { type: String },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Goal Schema
const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    vaultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' },
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
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            username,
            password: hashedPassword
        });

        await user.save();

        // Create default vaults for new user
        const defaultVaults = [
            { name: '👑 Sovereign Capital Vault', percentage: 50, description: 'Locked capital for empire building' },
            { name: '🧪 Risk Lab Wallet', percentage: 20, description: 'For trades, loops, experiments' },
            { name: '🧱 Infrastructure Vault', percentage: 10, description: 'For tools, scripts, books' },
            { name: '🔒 Core Survival Vault', percentage: 10, description: 'Essential needs' },
            { name: '🎭 Chaos Play Vault', percentage: 10, description: 'Spend freely' }
        ];

        for (const vaultData of defaultVaults) {
            const vault = new Vault({
                userId: user._id,
                ...vaultData
            });
            await vault.save();
        }

        // Generate token
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
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
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
// VAULT ROUTES
// ============================================

// Get all vaults for user
app.get('/api/vaults', authenticateToken, async (req, res) => {
    try {
        const vaults = await Vault.find({ userId: req.user.userId }).sort({ createdAt: 1 });
        res.json(vaults);
    } catch (error) {
        console.error('Get vaults error:', error);
        res.status(500).json({ error: 'Server error fetching vaults' });
    }
});

// Create vault
app.post('/api/vaults', authenticateToken, async (req, res) => {
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
app.put('/api/vaults/:id', authenticateToken, async (req, res) => {
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
app.delete('/api/vaults/:id', authenticateToken, async (req, res) => {
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
// TRANSACTION ROUTES (UPDATED with wallet support)
// ============================================

// Get all transactions for user
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId })
            .sort({ date: -1, time: -1 });
        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Server error fetching transactions' });
    }
});

// Create transaction (UPDATED with wallet field)
app.post('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { date, time, type, amount, category, location, wallet, vaultId, vaultName, notes } = req.body;

        // Validation
        if (!date || !type || !amount || !category) {
            return res.status(400).json({ error: 'Date, type, amount, and category required' });
        }

        // Create transaction with wallet field
        const transaction = new Transaction({
            userId: req.user.userId,
            date,
            time,
            type,
            amount,
            category,
            location,
            wallet, // NEW: Save wallet (HR or HL)
            vaultId,
            vaultName,
            notes
        });

        await transaction.save();

        // Update vault balances if applicable
        if (type === 'income') {
            // Distribute income across all vaults
            const vaults = await Vault.find({ userId: req.user.userId });
            for (const vault of vaults) {
                const allocation = (amount * vault.percentage) / 100;
                vault.totalIncome += allocation;
                vault.balance += allocation;
                await vault.save();
            }
        } else if (type === 'expense' && vaultId) {
            // Deduct from specific vault
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

// Update transaction (UPDATED with wallet field)
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const { date, time, type, amount, category, location, wallet, vaultId, vaultName, notes } = req.body;

        // Get old transaction to reverse vault changes
        const oldTransaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!oldTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Reverse old transaction effects
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

        // Update transaction with wallet field
        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { date, time, type, amount, category, location, wallet, vaultId, vaultName, notes },
            { new: true }
        );

        // Apply new transaction effects
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
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Reverse vault effects
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
// GOAL ROUTES
// ============================================

// Get all goals for user
app.get('/api/goals', authenticateToken, async (req, res) => {
    try {
        const goals = await Goal.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(goals);
    } catch (error) {
        console.error('Get goals error:', error);
        res.status(500).json({ error: 'Server error fetching goals' });
    }
});

// Create goal
app.post('/api/goals', authenticateToken, async (req, res) => {
    try {
        const { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes } = req.body;

        if (!name || !targetAmount) {
            return res.status(400).json({ error: 'Name and target amount required' });
        }

        const goal = new Goal({
            userId: req.user.userId,
            name,
            targetAmount,
            currentAmount: currentAmount || 0,
            vaultId,
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

// Update goal
app.put('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        const { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes } = req.body;

        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes },
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
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
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
app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId });

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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 VaultFlow server running on port ${PORT}`);
});

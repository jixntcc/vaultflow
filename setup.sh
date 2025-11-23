#!/bin/bash

# VaultFlow Quick Start Script
# This script helps you set up your project quickly

echo "🚀 VaultFlow Financial Tracker - Quick Setup"
echo "============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please download and install Node.js from: https://nodejs.org"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "📝 IMPORTANT: Edit the .env file and add your:"
    echo "   1. MongoDB connection string (MONGODB_URI)"
    echo "   2. JWT secret key (JWT_SECRET)"
    echo ""
    echo "Then run: npm start"
    exit 0
fi

echo "✅ .env file found"
echo ""

# Check if MongoDB URI is set
if grep -q "your-username:your-password" .env; then
    echo "⚠️  MongoDB connection string not configured!"
    echo "Please edit .env file and add your MongoDB Atlas connection string"
    echo ""
    echo "Get it from:"
    echo "1. Go to MongoDB Atlas"
    echo "2. Click 'Connect' on your cluster"
    echo "3. Choose 'Connect your application'"
    echo "4. Copy the connection string"
    echo "5. Replace <password> with your actual password"
    echo "6. Add database name: .net/vaultflow?retryWrites..."
    echo ""
    exit 1
fi

echo "✅ Configuration looks good"
echo ""
echo "🎉 Setup complete! Ready to run."
echo ""
echo "Commands:"
echo "  npm start        - Start production server"
echo "  npm run dev      - Start development server (with auto-reload)"
echo ""
echo "After starting, visit: http://localhost:3000"
echo ""

read -p "Start the server now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting VaultFlow server..."
    npm start
fi

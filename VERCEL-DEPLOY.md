# 🚀 VaultFlow Deployment Guide

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - VaultFlow ready for deployment"

# Create repository on GitHub (github.com/new)
# Then connect and push:
git remote add origin https://github.com/YOUR-USERNAME/vaultflow.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "New Project"
4. Import your `vaultflow` repository
5. Configure:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: public
   - **Install Command**: npm install

6. Add Environment Variables:
   - Click "Environment Variables"
   - Add these:
     ```
     MONGODB_URI = your-mongodb-connection-string
     JWT_SECRET = your-secret-key
     PORT = 3000
     ```

7. Click "Deploy"

### 3. Access Your App

After deployment (2-3 minutes):
- Your app will be live at: `https://vaultflow-XXXXX.vercel.app`
- Test login/signup
- Add transactions
- Everything should work!

### 4. Custom Domain (Optional)

In Vercel dashboard:
1. Go to your project
2. Settings → Domains
3. Add your custom domain

---

## Environment Variables

Make sure these are set in Vercel:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vaultflow?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-key-here-change-this
PORT=3000
```

---

## Troubleshooting

**Issue: Backend not connecting**
- Check environment variables are set correctly
- Check MongoDB Atlas IP whitelist includes 0.0.0.0/0

**Issue: Frontend shows but no data**
- Check browser console for API errors
- Verify API base URL in frontend

**Issue: Build fails**
- Check package.json has all dependencies
- Run `npm install` locally first

---

## Success Checklist

- ✅ Code pushed to GitHub
- ✅ Vercel project created
- ✅ Environment variables set
- ✅ Deployment successful
- ✅ App loads in browser
- ✅ Can signup/login
- ✅ Can add transactions
- ✅ Data persists

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console
3. Verify MongoDB connection
4. Test locally first

---

**Your app will be live at: `https://vaultflow-XXXXX.vercel.app`**

Enjoy your deployed VaultFlow! 🎉

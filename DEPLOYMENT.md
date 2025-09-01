# 🚀 Render Production Deployment Guide

This guide will walk you through deploying your Stripe Connect Multi-Account Reporting Application to Render.

## 📋 Prerequisites

-   [Render account](https://render.com) (free tier available)
-   GitHub repository with your code
-   Gmail account for email functionality
-   Stripe account with Connect enabled

## 🗄️ Step 1: Deploy PostgreSQL Database

### 1.1 Create Database Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure the database:
    - **Name**: `stripe-connect-db`
    - **Database**: `stripe_connect_db`
    - **User**: `stripe_user`
    - **Region**: Choose closest to your users
    - **Plan**: Start with **Free** (upgrade later if needed)

### 1.2 Save Database Credentials

After creation, note down:

-   **Internal Database URL**: `postgresql://stripe_user:password@host:port/stripe_connect_db`
-   **External Database URL**: `postgresql://stripe_user:password@host:port/stripe_connect_db`
-   **Host**: `host`
-   **Port**: `port`
-   **Database**: `stripe_connect_db`
-   **User**: `stripe_user`
-   **Password**: `password`

## 🌐 Step 2: Deploy Web Service

### 2.1 Connect Repository

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select the `deployment-multiple-users` branch

### 2.2 Configure Web Service

-   **Name**: `stripe-connect-app`
-   **Environment**: `Node`
-   **Build Command**: `npm run build:prod`
-   **Start Command**: `npm start`
-   **Plan**: Start with **Free** (upgrade later if needed)

### 2.3 Set Environment Variables

Click **"Environment"** and add these variables:

#### Database Configuration

```
PG_USER=stripe_user
PG_HOST=[from database step]
PG_DB=stripe_connect_db
PG_PASS=[from database step]
PG_PORT=5432
```

#### JWT Configuration

```
JWT_SECRET=[Render will generate this automatically]
```

#### Email Configuration

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

#### Application Configuration

```
NODE_ENV=production
PORT=10000
DEFAULT_TIMEZONE=America/New_York
CLIENT_URL=https://your-app-name.onrender.com
```

### 2.4 Advanced Settings

-   **Health Check Path**: `/health`
-   **Auto-Deploy**: ✅ Enabled
-   **Branch**: `deployment-multiple-users`

## 🔧 Step 3: Configure Gmail for Email

### 3.1 Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

### 3.2 Generate App Password

1. Go to **App passwords**
2. Select **Mail** and **Other (Custom name)**
3. Name it: `Stripe Connect App`
4. Copy the 16-character password
5. Use this password in `SMTP_PASS` environment variable

## 🚀 Step 4: Deploy and Test

### 4.1 Initial Deployment

1. Click **"Create Web Service"**
2. Render will automatically:
    - Install dependencies
    - Build the application
    - Deploy to production

### 4.2 Monitor Deployment

-   Watch the build logs for any errors
-   Check the health endpoint: `https://your-app-name.onrender.com/health`
-   Verify the service is running

### 4.3 Test the Application

1. Visit your app URL: `https://your-app-name.onrender.com`
2. Test the complete flow:
    - Stripe keys validation
    - User login
    - Dashboard functionality
    - Report generation
    - Export functionality

## 🔍 Step 5: Troubleshooting

### Common Issues

#### Build Failures

-   Check Node.js version compatibility (requires 18+)
-   Verify all dependencies are in package.json
-   Check build logs for specific error messages

#### Database Connection Issues

-   Verify database credentials
-   Check if database is running
-   Ensure proper network access

#### Email Issues

-   Verify Gmail app password
-   Check SMTP settings
-   Ensure 2FA is enabled

#### CORS Issues

-   Verify `CLIENT_URL` environment variable
-   Check server CORS configuration

### Debug Commands

```bash
# Check application logs
# In Render Dashboard → Your Service → Logs

# Check database connection
# In Render Dashboard → Your Database → Connect → External Database URL
```

## 📊 Step 6: Monitoring and Maintenance

### Health Checks

-   Monitor `/health` endpoint
-   Set up alerts for downtime
-   Check Render metrics dashboard

### Database Management

-   Monitor database performance
-   Set up automated backups
-   Scale database as needed

### Application Updates

-   Push to `deployment-multiple-users` branch
-   Render will auto-deploy
-   Monitor deployment logs

## 🔐 Security Considerations

### Environment Variables

-   Never commit sensitive data to Git
-   Use Render's environment variable encryption
-   Rotate secrets regularly

### Database Security

-   Use strong passwords
-   Limit database access
-   Enable SSL connections

### API Security

-   JWT tokens are automatically managed
-   Stripe keys are encrypted client-side
-   HTTPS is enforced by Render

## 💰 Cost Optimization

### Free Tier Limits

-   **Web Service**: 750 hours/month
-   **Database**: 90 days, then $7/month
-   **Bandwidth**: 100 GB/month

### Upgrade When Needed

-   Monitor usage in Render dashboard
-   Upgrade plans before hitting limits
-   Consider reserved instances for production

## 📞 Support

### Render Support

-   [Render Documentation](https://render.com/docs)
-   [Render Community](https://community.render.com)
-   [Render Status](https://status.render.com)

### Application Issues

-   Check application logs
-   Verify environment variables
-   Test locally with production config

---

## 🎯 Quick Deployment Checklist

-   [ ] PostgreSQL database created
-   [ ] Database credentials saved
-   [ ] Web service configured
-   [ ] Environment variables set
-   [ ] Gmail app password generated
-   [ ] Repository connected
-   [ ] Initial deployment successful
-   [ ] Health check passing
-   [ ] Application functionality tested
-   [ ] Monitoring configured

**Your application will be available at**: `https://your-app-name.onrender.com`

**Database connection**: `postgresql://stripe_user:password@host:port/stripe_connect_db`

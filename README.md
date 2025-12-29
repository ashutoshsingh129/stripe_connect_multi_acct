# Stripe Connect Multi-Account Reporting Application

> **Working Branch**: `detailed-reporting-chargeback`  
> This is the active development branch for the project.

A comprehensive reporting application for Stripe Connect accounts that allows users to generate detailed reports, export data in multiple formats (CSV, Excel, PDF, Email, Google Sheets), and manage multiple Stripe Connect accounts from a single dashboard.

## 🚀 Features

- **Multi-Account Management**: Handle multiple Stripe Connect accounts from a single dashboard
- **Comprehensive Reporting**: Generate detailed transaction reports with charts and analytics
- **Multiple Export Formats**: Export data as CSV, Excel, PDF, Email, or Google Sheets
- **Detailed Transaction View**: View compliance-ready transaction data with all required fields
- **Real-time Data**: Fetch live data from Stripe Connect accounts
- **User Authentication**: Secure JWT-based authentication system
- **Responsive UI**: Modern Material-UI based interface
- **Timezone Support**: Handle data across different timezones (USA timezones)
- **Password-Protected Exports**: Secure PDF and ZIP exports with password protection

## 📋 Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **PostgreSQL**: Version 12.0 or higher
- **Git**: For version control

### Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🛠️ Technology Stack

### Backend

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with pg driver
- **Authentication**: JWT (JSON Web Tokens)
- **Email**: Nodemailer with SMTP
- **File Processing**: PDFKit, XLSX, Archiver
- **Encryption**: Custom encryption for API keys

### Frontend

- **Framework**: React 18
- **UI Library**: Material-UI (MUI) v5
- **Charts**: Recharts for data visualization
- **HTTP Client**: Axios for API calls
- **Date Handling**: date-fns
- **Build Tool**: Create React App

## 🏗️ Project Structure

```
stripe_connect_multi_acct/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── server/                 # Node.js backend
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
├── package.json           # Root package.json
└── README.md              # This file
```

## 🔧 Environment Setup

### 1. Database Setup (PostgreSQL)

#### Install PostgreSQL

**macOS (using Homebrew):**

```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**

Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

#### Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database
CREATE DATABASE stripe_connect_db;

# Create user
CREATE USER stripe_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE stripe_connect_db TO stripe_user;

# Exit
\q
```

### 2. Email Setup (Gmail)

#### Enable 2-Factor Authentication

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password for this application

#### App Password Generation

1. Go to Google Account → Security → 2-Step Verification
2. Click on "App passwords"
3. Generate a new app password for "Mail"
4. Use this password in your environment variables

### 3. Stripe Account Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Enable Stripe Connect in your dashboard
3. Note down your API keys (Publishable and Secret keys)
4. The keys will be encrypted and stored securely in the database

## 📁 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd stripe_connect_multi_acct
```

### 2. Install Dependencies

```bash
# Install all dependencies (root, client, and server)
npm run install-all
```

### 3. Environment Configuration

#### Backend Environment Variables

Create a `.env` file in the `server/` directory:

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production

# Database Configuration
PG_USER=stripe_user
PG_HOST=localhost
PG_DB=stripe_connect_db
PG_PASS=your_secure_password
PG_PORT=5432

# Email Configuration (for email export functionality)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password

# Timezone
DEFAULT_TIMEZONE=America/New_York

# Client URL (for CORS configuration)
CLIENT_URL=http://localhost:3000

# Optional: Stripe Import Password (default: stripe2024!)
# Used for password-protecting exported files
STRIPE_IMPORT_PASSWORD=stripe2024!

# Optional: Master Admin Credentials (default: admin/admin123)
# Used for creating the master admin user on first run
MASTER_ADMIN_USER=admin
MASTER_ADMIN_PASSWORD=admin123
```

**Important Notes:**

- **JWT_SECRET**: Use a strong, random string in production. This is used to sign JWT tokens.
- **PG_PASS**: Use the password you set when creating the PostgreSQL user.
- **SMTP_PASS**: Use the Gmail app password (16 characters, no spaces).
- **STRIPE_SECRET_KEY** and **STRIPE_PUBLISHABLE_KEY**: These are no longer needed in `.env` as they are provided from the frontend and encrypted before storage.

#### Frontend Environment Variables

Create a `.env` file in the `client/` directory (optional for development):

```bash
REACT_APP_API_URL=http://localhost:5000
```

**Note:** In production, this should point to your production API URL.

### 4. Database Schema Setup

The application will automatically create necessary tables on first run. Ensure your PostgreSQL user has CREATE TABLE privileges.

### 5. Build the Application

```bash
# Build both client and server
npm run build
```

## 🚀 Running the Application

### Development Mode

#### Option 1: Run Both Frontend and Backend Concurrently

```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend development server on http://localhost:3000

#### Option 2: Run Separately

```bash
# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Start frontend
cd client && npm start
```

### Production Mode

#### 1. Build the Application

```bash
npm run build
```

#### 2. Start Production Server

```bash
npm start
```

The application will be available at the configured port (default: 5000).

## 🔐 First-Time Setup

1. **Access the Application**: Navigate to http://localhost:3000 (development) or your production URL
2. **Enter Stripe Keys**: Provide your Stripe Connect API keys (Publishable and Secret keys)
   - Keys are encrypted before storage
   - The system will validate and import your Stripe Connect accounts
3. **Create User Account**: 
   - Master admin user is created automatically with credentials from `MASTER_ADMIN_USER` and `MASTER_ADMIN_PASSWORD` env variables
   - Additional users can be created through the application
4. **Import Accounts**: The system will automatically import your Stripe Connect accounts
5. **Generate Reports**: Start generating and exporting reports

## 📊 Available Scripts

### Root Level

- `npm run install-all` - Install dependencies for root, client, and server
- `npm run build` - Build both client and server
- `npm run build:prod` - Build for production
- `npm run dev` - Run both frontend and backend in development mode
- `npm start` - Start production server

### Server

- `cd server && npm run dev` - Start development server with hot reload
- `cd server && npm run build` - Build TypeScript to JavaScript
- `cd server && npm start` - Start production server

### Client

- `cd client && npm start` - Start development server
- `cd client && npm run build` - Build for production
- `cd client && npm test` - Run tests

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready` or `sudo systemctl status postgresql`
- Check database credentials in `.env`
- Ensure database exists and user has proper privileges
- Test connection: `psql -U stripe_user -d stripe_connect_db -h localhost`

#### Email Sending Issues

- Verify Gmail app password is correct (16 characters, no spaces)
- Check SMTP settings in `.env`
- Ensure 2FA is enabled on Gmail account
- Check that `SMTP_USER` matches the Gmail account

#### Stripe API Issues

- Verify Stripe API keys are correct
- Check Stripe account status
- Ensure proper permissions for Connect accounts
- Verify keys are in the correct format (starts with `sk_` for secret, `pk_` for publishable)

#### Build Issues

- Clear node_modules: `rm -rf node_modules && npm install`
- Clear npm cache: `npm cache clean --force`
- Check Node.js version: `node --version` (should be 18+)
- Reinstall dependencies: `npm run install-all`

#### Port Already in Use

- Change `PORT` in server `.env` file
- Kill process using the port: `lsof -ti:5000 | xargs kill` (macOS/Linux)

### Logs

- **Backend**: Check server console output
- **Frontend**: Check browser console (F12)
- **Database**: Check PostgreSQL logs

## 🔒 Security Considerations

### Environment Variables

- Never commit `.env` files to version control
- Use strong, unique values for `JWT_SECRET` in production
- Rotate secrets regularly
- Use different credentials for development and production

### Database Security

- Use strong passwords for database users
- Limit database access to necessary IPs
- Enable SSL connections in production
- Regular backups

### API Security

- JWT tokens are automatically managed and expire after 24 hours
- Stripe keys are encrypted before storage
- All API endpoints require authentication (except login and key validation)
- HTTPS should be enforced in production

## 📝 Development

### Code Style

- Use TypeScript for type safety
- Follow ESLint configuration
- Use Prettier for code formatting

### Testing

```bash
# Run frontend tests
cd client && npm test

# Run backend tests (when implemented)
cd server && npm test
```

### Adding New Features

1. Create feature branch: `git checkout -b feature/new-feature`
2. Implement changes
3. Test thoroughly
4. Create pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation (see `API.md`)

## 🔄 Updates

To update the application:

```bash
git pull origin main
npm run install-all
npm run build
```

---

**Note**: This application handles sensitive financial data. Ensure proper security measures are in place for production deployments, including HTTPS, secure database connections, and proper access controls.

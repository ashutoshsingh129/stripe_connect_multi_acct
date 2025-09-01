# Stripe Connect Multi-Account Reporting Application

A comprehensive reporting application for Stripe Connect accounts that allows users to generate detailed reports, export data in multiple formats (CSV, Excel, PDF), and manage multiple Stripe Connect accounts from a single dashboard.

## 🚀 Features

-   **Multi-Account Management**: Handle multiple Stripe Connect accounts
-   **Comprehensive Reporting**: Generate detailed transaction reports with charts
-   **Multiple Export Formats**: Export data as CSV, Excel, PDF, or via email
-   **Real-time Data**: Fetch live data from Stripe Connect accounts
-   **User Authentication**: Secure JWT-based authentication system
-   **Responsive UI**: Modern Material-UI based interface
-   **Timezone Support**: Handle data across different timezones

## 📋 Software Requirements

### System Requirements

-   **Node.js**: Version 18.0.0 or higher
-   **npm**: Version 8.0.0 or higher (comes with Node.js)
-   **PostgreSQL**: Version 12.0 or higher
-   **Git**: For version control

### Browser Support

-   Chrome 90+
-   Firefox 88+
-   Safari 14+
-   Edge 90+

## 🛠️ Technology Stack

### Backend

-   **Runtime**: Node.js with TypeScript
-   **Framework**: Express.js
-   **Database**: PostgreSQL with pg driver
-   **Authentication**: JWT (JSON Web Tokens)
-   **Email**: Nodemailer with SMTP
-   **File Processing**: PDFKit, XLSX, Archiver
-   **Encryption**: Custom encryption for API keys

### Frontend

-   **Framework**: React 18 with TypeScript
-   **UI Library**: Material-UI (MUI) v5
-   **Charts**: Recharts for data visualization
-   **HTTP Client**: Axios for API calls
-   **Date Handling**: date-fns
-   **Build Tool**: Create React App

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

## 📁 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/stripe_connect_multi_acct.git
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
JWT_SECRET=your-super-secret-jwt-key-here

# Database Configuration
PG_USER=stripe_user
PG_HOST=localhost
PG_DB=stripe_connect_db
PG_PASS=your_secure_password
PG_PORT=5432

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Timezone
DEFAULT_TIMEZONE=America/New_York
```

#### Frontend Environment Variables

Create a `.env` file in the `client/` directory (optional for development):

```bash
REACT_APP_API_URL=http://localhost:5000
```

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

-   Backend server on http://localhost:5000
-   Frontend development server on http://localhost:3000

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

## 🌐 Production Deployment

### Using Render (Recommended)

1. **Connect Repository**: Connect your GitHub repository to Render
2. **Create Web Service**: Create a new Web Service
3. **Build Command**: `npm run build`
4. **Start Command**: `npm start`
5. **Environment Variables**: Add all environment variables from your `.env` file

### Using Heroku

1. **Install Heroku CLI**
2. **Create Heroku App**: `heroku create your-app-name`
3. **Set Environment Variables**: `heroku config:set KEY=value`
4. **Deploy**: `git push heroku main`

### Using Docker

Create a `Dockerfile` in the root directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm run install-all

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t stripe-connect-app .
docker run -p 5000:5000 stripe-connect-app
```

## 🔐 First-Time Setup

1. **Access the Application**: Navigate to your application URL
2. **Enter Stripe Keys**: Provide your Stripe Connect API keys
3. **Create User Account**: Set up your first user account
4. **Import Accounts**: The system will automatically import your Stripe Connect accounts
5. **Generate Reports**: Start generating and exporting reports

## 📊 API Endpoints

### Authentication

-   `POST /api/auth/login` - User login
-   `POST /api/auth/logout` - User logout
-   `GET /api/auth/me` - Get current user info

### Reports

-   `GET /api/reports/timezones` - Get available timezones
-   `GET /api/reports/accounts` - Get Stripe Connect accounts
-   `GET /api/reports/multi/:accountIds` - Generate multi-account reports

### Export

-   `POST /api/export/csv/:accountId` - Export to CSV
-   `POST /api/export/xls/:accountId` - Export to Excel
-   `POST /api/export/pdf/:accountId` - Export to PDF
-   `POST /api/export/email/:accountId` - Export via email

### Validation

-   `POST /api/validate-keys` - Validate Stripe API keys

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues

-   Verify PostgreSQL is running
-   Check database credentials in `.env`
-   Ensure database exists and user has proper privileges

#### Email Sending Issues

-   Verify Gmail app password is correct
-   Check SMTP settings in `.env`
-   Ensure 2FA is enabled on Gmail account

#### Stripe API Issues

-   Verify Stripe API keys are correct
-   Check Stripe account status
-   Ensure proper permissions for Connect accounts

#### Build Issues

-   Clear node_modules: `rm -rf node_modules && npm install`
-   Clear npm cache: `npm cache clean --force`
-   Check Node.js version: `node --version`

### Logs

-   **Backend**: Check server console output
-   **Frontend**: Check browser console (F12)
-   **Database**: Check PostgreSQL logs

## 📝 Development

### Code Style

-   Use TypeScript for type safety
-   Follow ESLint configuration
-   Use Prettier for code formatting

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

-   Create an issue on GitHub
-   Check the troubleshooting section
-   Review the API documentation

## 🔄 Updates

To update the application:

```bash
git pull origin main
npm run install-all
npm run build
```

---

**Note**: This application handles sensitive financial data. Ensure proper security measures are in place for production deployments, including HTTPS, secure database connections, and proper access controls.

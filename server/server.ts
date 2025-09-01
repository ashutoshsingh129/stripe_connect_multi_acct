import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

// Import routes
// import authRoutes from './routes/auth';
import authRoutes from './routes/auth';
import validateKeysRoutes from './routes/validateKeys';
import reportRoutes from './routes/reports';
import exportRoutes from './routes/export';

const app = express();
const PORT: string | number = process.env['PORT'] || 5000;

// Middleware
app.use(helmet());
app.use(
    cors({
        origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
        credentials: false, // No cookies needed with JWT in headers
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/validate-keys', validateKeysRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env['NODE_ENV'] === 'development' ? err.message : 'Internal server error',
    });
});

// Serve static files from React build in production
if (process.env['NODE_ENV'] === 'production') {
    console.log('🏗️  Production mode - looking for client build...');
    console.log(`📁 Current working directory: ${process.cwd()}`);
    console.log(`📁 __dirname: ${__dirname}`);

    // Try multiple possible paths for the client build
    const possiblePaths = [
        path.join(__dirname, '../client/build'),
        path.join(__dirname, '../../client/build'),
        path.join(process.cwd(), 'client/build'),
        path.join(process.cwd(), '../client/build'),
        path.join(process.cwd(), 'src/client/build'), // Render path
        path.join(__dirname, 'client/build'), // Alternative Render path
    ];

    let clientBuildPath = null;
    for (const buildPath of possiblePaths) {
        if (require('fs').existsSync(buildPath)) {
            clientBuildPath = buildPath;
            console.log(`✅ Found client build at: ${buildPath}`);
            break;
        }
    }

    if (clientBuildPath) {
        // Serve static files from the React build
        app.use(express.static(clientBuildPath));

        // Handle React routing, return all requests to React app
        app.get('*', (_req, res) => {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        });
    } else {
        console.warn('⚠️  Client build directory not found. API-only mode.');
        console.log('📱 Searched in these locations:');
        possiblePaths.forEach(path => console.log(`   - ${path}`));
        console.log('📱 To serve the frontend, build the client and place it in client/build/');

        // 404 handler for API-only mode
        app.use('*', (_req: Request, res: Response) => {
            res.status(404).json({ error: 'Route not found' });
        });
    }
} else {
    // In development mode, don't add a catch-all route that interferes with API calls
    console.log('🌍 Development mode - API routes available at /api/*');
}

const serverInstance = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Stripe Connect Reporting API ready`);
    console.log(`🌍 Environment: ${process.env['NODE_ENV']}`);
});

// Increase server timeouts for long-running requests (e.g., large date ranges)
serverInstance.setTimeout(600000); // 10 minutes for inactive socket timeout
// Ensure headers timeout is greater than request timeout
// @ts-ignore - headersTimeout is a Node.js HTTP server property
serverInstance.headersTimeout = 610000;
// Optional: keep-alive timeout for persistent connections
// @ts-ignore - keepAliveTimeout is a Node.js HTTP server property
serverInstance.keepAliveTimeout = 65000;

console.log('🚀 Server ready - Stripe accounts will be imported when users provide their keys');

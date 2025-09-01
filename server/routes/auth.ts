import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import userService from '../services/userService';
import { validateJWT } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Username and password are required',
            });
            return;
        }

        const user = await userService.findUserByUsername(username);

        if (!user || !user.passwordHash) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid username or password',
            });
            return;
        }

        const isValid = await userService.validatePassword(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid username or password',
            });
            return;
        }

        const jwtSecret = process.env['JWT_SECRET'] || 'stripe-connect-jwt-secret-2025';
        const isMaster = user.stripeId && user.stripeId.startsWith('MASTER_ADMIN_'); // check for MASTER_ADMIN_ prefix
        const token = jwt.sign(
            {
                id: user.id,
                stripeId: user.stripeId,
                username: user.username,
                isMaster,
                authenticated: true,
                iat: Math.floor(Date.now() / 1000), // explicit issued-at time
            },
            jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                stripeId: user.stripeId,
                username: user.username,
                email: user.email,
                name: user.name,
                isMaster,
            },
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Login failed',
        });
    }
});

// Logout endpoint
router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
    try {
        // For JWT-based auth, logout is typically handled client-side
        // But we can add server-side logic here if needed (e.g., token blacklisting)

        res.json({
            message: 'Logout successful',
            success: true,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Logout failed',
        });
    }
});

// Get current user info endpoint - using middleware for validation
router.get('/me', validateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        // User is already validated by middleware
        res.json({
            authenticated: true,
            user: {
                stripeId: req.user?.stripeId,
                username: req.user?.username,
                isMaster: req.user?.isMaster,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get user info',
        });
    }
});

export default router;

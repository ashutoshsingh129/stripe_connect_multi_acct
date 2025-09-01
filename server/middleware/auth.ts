import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import { decryptSecretKey, decryptPublicKey } from '../utils/encryption';

// JWT-based authentication middleware
const validateJWT = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Please login.',
            });
            return;
        }

        // Extract JWT token from Bearer header
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!token) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token format.',
            });
            return;
        }

        const jwtSecret = process.env['JWT_SECRET'] || 'stripe-connect-jwt-secret-2025';
        const decoded = jwt.verify(token, jwtSecret) as any;

        // Set user info from JWT
        req.user = {
            username: decoded.username,
            stripeId: decoded.stripeId,
            isMaster: Boolean(decoded.isMaster),
            connectedAccountId: '',
            secretKey: '',
            publicKey: '',
        };

        next();
    } catch (error) {
        console.error('JWT validation error:', error);
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token.',
        });
    }
};

// Stripe key validation middleware (validates encrypted Stripe keys from headers)
const validateStripeKeys = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const secretKey: string | undefined = req.headers['x-secret-key'] as string;
        const publicKey: string | undefined = req.headers['x-public-key'] as string;

        if (!secretKey) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing x-secret-key header',
            });
            return;
        }

        if (!publicKey) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing x-public-key header',
            });
            return;
        }

        // Decrypt the keys from frontend
        const encryptedSecretKey = secretKey;
        const encryptedPublicKey = publicKey;

        const decryptedSecretKey = decryptSecretKey(encryptedSecretKey);
        const decryptedPublicKey = decryptPublicKey(encryptedPublicKey);

        if (!decryptedSecretKey || !decryptedPublicKey) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Failed to decrypt API keys',
            });
            return;
        }

        // Basic validation that keys look like Stripe keys (more flexible)
        const isValidSecretKey = /^(sk_|rk_)(test_|live_)\w+/.test(decryptedSecretKey);
        const isValidPublicKey = /^pk_(test_|live_)\w+/.test(decryptedPublicKey);

        if (!isValidSecretKey || !isValidPublicKey) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid Stripe API key format',
            });
            return;
        }

        // Use decrypted keys from frontend for all Stripe API calls
        req.user = {
            ...req.user, // Preserve existing user info (like username from JWT)
            connectedAccountId: '', // Empty for accounts endpoint
            secretKey: decryptedSecretKey,
            publicKey: decryptedPublicKey,
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to validate credentials',
        });
    }
};

export { validateStripeKeys, validateJWT };

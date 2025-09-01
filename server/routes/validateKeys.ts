import express, { Request, Response } from 'express';
import { decryptSecretKey, decryptPublicKey } from '../utils/encryption';
import userService from '../services/userService';

const router = express.Router();

// Test route to debug routing
router.get('/test', (_req: Request, res: Response) => {
    res.json({ message: 'Test route working' });
});

// Validate Stripe keys and import accounts
router.post('/', async (req: Request, res: Response) => {
    try {
        const { publicKey, secretKey } = req.body;

        if (!publicKey || !secretKey) {
            return res.status(400).json({
                success: false,
                error: 'Both public key and secret key are required',
            });
        }

        // Decrypt the keys
        const decryptedPublicKey = decryptPublicKey(publicKey);
        const decryptedSecretKey = decryptSecretKey(secretKey);

        if (!decryptedPublicKey || !decryptedSecretKey) {
            return res.status(400).json({
                success: false,
                error: 'Invalid key format or decryption failed',
            });
        }

        // Accept any key format - no validation restrictions
        console.log('Keys received:', {
            publicKey: decryptedPublicKey.substring(0, 10) + '...',
            secretKey: decryptedSecretKey.substring(0, 10) + '...',
        });

        // Test the keys by trying to import accounts
        try {
            // Import accounts using the provided keys
            await userService.importStripeAccountsWithKeys(decryptedPublicKey, decryptedSecretKey);

            return res.json({
                success: true,
                message: 'Stripe keys validated successfully and accounts imported',
                publicKey: decryptedPublicKey,
                secretKey: decryptedSecretKey,
            });
        } catch (importError) {
            console.error('Failed to import accounts with provided keys:', importError);
            return res.status(400).json({
                success: false,
                error: 'Invalid Stripe keys. Please check your API keys and try again.',
            });
        }
    } catch (error) {
        console.error('Error validating keys:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

export default router;

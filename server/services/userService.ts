import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { pool } from '../utils/dbconfig';
import { User } from '../types';

class UserService {
    constructor() {
        // Constructor intentionally empty
    }

    async createUser(user: User): Promise<User> {
        const hash = await bcrypt.hash(user.passwordHash || '', 10);

        const query = `
        INSERT INTO users (stripe_id, username, email, name, password_hash, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (stripe_id)
        DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          raw_data = EXCLUDED.raw_data
        RETURNING id, stripe_id as "stripeId", username, email, name, password_hash as "passwordHash", raw_data as "rawData", created_at as "createdAt", updated_at as "updatedAt";
      `;

        const values = [
            user.stripeId,
            user.username,
            user.email || null,
            user.name || null,
            hash,
            user.rawData || {},
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    async findUserByUsername(username: string): Promise<User | null> {
        const query = `SELECT id, stripe_id as "stripeId", username, email, name, password_hash as "passwordHash", raw_data as "rawData", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE username=$1`;
        const res = await pool.query(query, [username]);
        return res.rows[0] || null;
    }

    async validatePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    async importStripeAccounts() {
        try {
            // Load from environment
            const stripeImportPassword = process.env['STRIPE_IMPORT_PASSWORD'] || 'stripe2024!';
            const masterAdminUser = process.env['MASTER_ADMIN_USER'] || 'admin';
            const masterAdminPassword = process.env['MASTER_ADMIN_PASSWORD'] || 'admin123';

            const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || '');

            // 1. Import Stripe accounts
            const accounts = await stripe.accounts.list({ limit: 100 });
            for (const acct of accounts.data) {
                try {
                    await this.createUser({
                        stripeId: acct.id,
                        username: acct.email || acct.id, // fallback if no email
                        email: acct.email || undefined,
                        name: acct.business_profile?.name || undefined,
                        passwordHash: stripeImportPassword, // createUser will hash internally
                        rawData: acct as any,
                    });

                    console.log(`Imported ${acct.id} with password from ENV`);
                } catch (error) {
                    console.error(`Failed to import account ${acct.id}:`, error);
                    // Continue with other accounts even if one fails
                }
            }

            // 2. Add static master admin user
            try {
                await this.createUser({
                    stripeId: 'MASTER_ADMIN_' + Date.now(), // unique identifier for master admin
                    username: masterAdminUser,
                    email: undefined,
                    name: 'Master Admin',
                    passwordHash: masterAdminPassword, // createUser will hash internally
                    rawData: {}, // optional empty object
                });

                console.log(`Master admin '${masterAdminUser}' added with password from ENV`);
            } catch (error) {
                console.error('Failed to create master admin user:', error);
            }

            console.log('Stripe accounts import completed successfully');
        } catch (error) {
            console.error('Failed to import Stripe accounts:', error);
            throw error; // Re-throw to let the server handle it
        }
    }

    async importStripeAccountsWithKeys(_publicKey: string, secretKey: string) {
        try {
            // Load from environment
            const stripeImportPassword = process.env['STRIPE_IMPORT_PASSWORD'] || 'stripe2024!';
            const masterAdminUser = process.env['MASTER_ADMIN_USER'] || 'admin';
            const masterAdminPassword = process.env['MASTER_ADMIN_PASSWORD'] || 'admin123';

            const stripe = new Stripe(secretKey);

            // 1. Import Stripe accounts
            const accounts = await stripe.accounts.list({ limit: 100 });
            for (const acct of accounts.data) {
                try {
                    await this.createUser({
                        stripeId: acct.id,
                        username: acct.email || acct.id, // fallback if no email
                        email: acct.email || undefined,
                        name: acct.business_profile?.name || undefined,
                        passwordHash: stripeImportPassword, // createUser will hash internally
                        rawData: acct as any,
                    });

                    console.log(`Imported ${acct.id} with password from ENV`);
                } catch (error) {
                    console.error(`Failed to import account ${acct.id}:`, error);
                    // Continue with other accounts even if one fails
                }
            }

            // 2. Add static master admin user
            try {
                await this.createUser({
                    stripeId: 'MASTER_ADMIN_' + Date.now(), // unique identifier for master admin
                    username: masterAdminUser,
                    email: undefined,
                    name: 'Master Admin',
                    passwordHash: masterAdminPassword, // createUser will hash internally
                    rawData: {}, // optional empty object
                });

                console.log(`Master admin '${masterAdminUser}' added with password from ENV`);
            } catch (error) {
                console.error('Failed to create master admin user:', error);
            }

            console.log('Stripe accounts import completed successfully');
        } catch (error) {
            console.error('Failed to import Stripe accounts:', error);
            throw error; // Re-throw to let the server handle it
        }
    }
}

// Create and export a singleton instance
const userService = new UserService();
export default userService;

// Export individual methods for backward compatibility
export const { createUser, findUserByUsername, validatePassword, importStripeAccounts } =
    userService;

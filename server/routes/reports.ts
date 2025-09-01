import { Router, Request, Response } from 'express';
import stripeService from '../services/stripeService';

import { validateStripeKeys, validateJWT } from '../middleware/auth';
import { AuthenticatedRequest, TimezoneResponse, MultiAccountReportResponse } from '../types';
import moment from 'moment-timezone';

const router = Router();

// Get available timezones (USA only)
router.get('/timezones', (_req: Request, res: Response): Response => {
    try {
        // Filter for USA timezones only
        const allTimezones = moment.tz.names();
        const usaTimezones = allTimezones.filter(
            tz => tz.startsWith('America/') || tz.startsWith('US/') || tz === 'UTC' || tz === 'GMT'
        );

        // Sort USA timezones by name for better UX
        usaTimezones.sort();

        const response: TimezoneResponse = {
            success: true,
            timezones: usaTimezones,
            total: usaTimezones.length,
            note: 'Showing USA timezones only',
        };

        return res.json(response);
    } catch (error) {
        console.error('Error in timezone endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch timezones',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get multiple accounts for the authenticated user
router.get(
    '/accounts',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { secretKey, isMaster, stripeId } = req.user!;
            let accounts;
            if (isMaster) {
                accounts = await stripeService.getMultipleAccounts(secretKey);
            } else {
                // Non-master: only their own connected account (stripeId)
                const acct = await stripeService.getSingleAccount(secretKey, stripeId as string);
                accounts = acct ? [acct] : [];
            }

            return res.json({
                success: true,
                accounts,
                total: accounts.length,
            });
        } catch (error) {
            console.error('Error fetching accounts:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch accounts',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Get transaction report for multiple connected accounts
router.get(
    '/multi/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const {
                start_date,
                end_date,
                timezone = 'UTC',
                period = 'custom', // daily, weekly, monthly, custom
                page = 1,
                limit = 10,
            } = req.query;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            let accountIdList = accountIds.split(',').map(id => id.trim());
            // Enforce access: non-master may only request their own account
            if (!req.user!.isMaster) {
                accountIdList = [req.user!.stripeId as string];
            }
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            const pageNum = parseInt(page as string, 10);
            const limitNum = parseInt(limit as string, 10);

            // Get transactions for all accounts
            const { transactions, accounts } = await stripeService.getMultiAccountTransactions(
                req.user!.secretKey,
                accountIdList,
                startDate,
                endDate,
                timezone as string
            );

            // Paginate the combined results
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            const paginatedTransactions = transactions.slice(startIndex, endIndex);

            const response: MultiAccountReportResponse = {
                success: true,
                data: paginatedTransactions,
                accounts,
                pagination: {
                    currentPage: pageNum,
                    itemsPerPage: limitNum,
                    totalItems: transactions.length,
                    totalPages: Math.ceil(transactions.length / limitNum),
                    hasPrevPage: pageNum > 1,
                    hasNextPage: pageNum < Math.ceil(transactions.length / limitNum),
                },
            };

            return res.json(response);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch transactions',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

export default router;

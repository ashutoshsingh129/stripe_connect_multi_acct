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

// Get detailed transaction data with compliance fields
router.get(
    '/detailed/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            console.log(`Server received accountIds: "${accountIds}"`);
            
            const {
                start_date,
                end_date,
                timezone = 'UTC',
                period = 'custom',
                page = 1,
                limit = 50,
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

            console.log(`Processing ${accountIdList.length} accounts:`, accountIdList);
            console.log(`📅 Date range: ${startDate} to ${endDate} (timezone: ${timezone})`);

            // Get detailed compliance data for all accounts
            const allDetailedData: any[] = [];

            for (const accountId of accountIdList) {
                try {
                    console.log(`Processing account: ${accountId}`);
                    const complianceData = await stripeService.getComplianceTransactions(
                        req.user!.secretKey,
                        accountId,
                        startDate,
                        endDate,
                        timezone as string
                    );
                    console.log(`Account ${accountId} - Charges: ${complianceData.charges.length}, PaymentIntents: ${complianceData.paymentIntents.length}`);

                    // Flatten charges data with compliance fields
                    const detailedCharges = complianceData.charges.map((charge: any) => ({
                        account_id: accountId,
                        transaction_type: 'charge',
                        id: charge.id,
                        amount: charge.amount / 100,
                        currency: charge.currency,
                        status: charge.status,
                        created: moment.unix(charge.created).format('YYYY-MM-DD HH:mm:ss'),
                        paid: charge.paid,
                        captured: charge.captured,
                        disputed: charge.disputed,
                        failure_code: charge.failure_code || '',
                        failure_message: charge.failure_message || '',
                        network_status: charge.outcome?.network_status || '',
                        outcome_type: charge.outcome?.type || '',
                        risk_level: charge.outcome?.risk_level || '',
                        outcome_reason: charge.outcome?.reason || '',
                        seller_message: charge.outcome?.seller_message || '',
                        description: charge.description || '',
                        customer_id: charge.customer || '',
                        payment_method_id: charge.payment_method || '',
                        receipt_email: charge.receipt_email || '',
                        statement_descriptor: charge.statement_descriptor || '',
                        authorization_code: charge.authorization_code || '',
                        balance_transaction_id: charge.balance_transaction || '',
                        fraud_details: charge.fraud_details || {},
                        metadata: charge.metadata || {},
                        // Customer information from billing details
                        customer_name: charge.billing_details?.name || '',
                        customer_email: charge.billing_details?.email || '',
                        customer_phone: charge.billing_details?.phone || '',
                        // Chargeback information
                        chargeback_status: charge.disputed ? 'disputed' : 'none',
                        chargeback_reason: charge.dispute?.reason || '',
                        chargeback_amount: charge.dispute?.amount ? charge.dispute.amount / 100 : 0,
                        chargeback_currency: charge.dispute?.currency || '',
                        chargeback_created: charge.dispute?.created ? moment.unix(charge.dispute.created).format('YYYY-MM-DD HH:mm:ss') : '',
                        chargeback_evidence_due_by: charge.dispute?.evidence_details?.due_by ? moment.unix(charge.dispute.evidence_details.due_by).format('YYYY-MM-DD HH:mm:ss') : '',
                        chargeback_status_details: charge.dispute?.status || '',
                        // IP address from various sources
                        customer_ip: charge.metadata?.customer_ip || 
                                   charge.metadata?.ip_address || 
                                   charge.metadata?.client_ip ||
                                   charge.payment_intent?.metadata?.customer_ip ||
                                   charge.payment_intent?.metadata?.ip_address ||
                                   charge.payment_intent?.metadata?.client_ip ||
                                   '',
                        // Additional IP sources
                        request_ip: charge.metadata?.request_ip || '',
                        webhook_ip: charge.metadata?.webhook_ip || ''
                    }));

                    // Flatten payment intents data
                    const detailedPaymentIntents = complianceData.paymentIntents.map((pi: any) => ({
                        account_id: accountId,
                        transaction_type: 'payment_intent',
                        id: pi.id,
                        amount: pi.amount / 100,
                        currency: pi.currency,
                        status: pi.status,
                        created: moment.unix(pi.created).format('YYYY-MM-DD HH:mm:ss'),
                        paid: pi.status === 'succeeded',
                        captured: pi.status === 'succeeded',
                        disputed: false,
                        failure_code: pi.last_payment_error?.code || '',
                        failure_message: pi.last_payment_error?.message || '',
                        network_status: '',
                        outcome_type: pi.last_payment_error?.type || '',
                        risk_level: '',
                        outcome_reason: pi.last_payment_error?.decline_code || '',
                        seller_message: pi.last_payment_error?.message || '',
                        description: pi.description || '',
                        customer_id: pi.customer || '',
                        payment_method_id: '',
                        receipt_email: pi.receipt_email || '',
                        statement_descriptor: pi.statement_descriptor || '',
                        authorization_code: '',
                        balance_transaction_id: '',
                        fraud_details: {},
                        metadata: pi.metadata || {},
                        // Customer information from payment intent
                        customer_name: '',
                        customer_email: pi.receipt_email || '',
                        customer_phone: '',
                        // Chargeback information (payment intents don't have direct chargeback info)
                        chargeback_status: 'none',
                        chargeback_reason: '',
                        chargeback_amount: 0,
                        chargeback_currency: '',
                        chargeback_created: '',
                        chargeback_evidence_due_by: '',
                        chargeback_status_details: '',
                        // IP address from PaymentIntent metadata
                        customer_ip: pi.metadata?.customer_ip || 
                                   pi.metadata?.ip_address || 
                                   pi.metadata?.client_ip ||
                                   pi.metadata?.request_ip ||
                                   '',
                        // Additional IP sources
                        request_ip: pi.metadata?.request_ip || '',
                        webhook_ip: pi.metadata?.webhook_ip || ''
                    }));

                    allDetailedData.push(...detailedCharges, ...detailedPaymentIntents);
                    console.log(`Added ${detailedCharges.length + detailedPaymentIntents.length} transactions from account ${accountId}. Total so far: ${allDetailedData.length}`);
                } catch (error) {
                    console.error(`Error processing account ${accountId}:`, error);
                    // Continue with other accounts
                }
            }

            // Sort by created date (newest first)
            allDetailedData.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

            // Paginate the results
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            const paginatedData = allDetailedData.slice(startIndex, endIndex);

            // Debug logging
            console.log(`Detailed Transactions - Total: ${allDetailedData.length}, Page: ${pageNum}, Limit: ${limitNum}, Showing: ${paginatedData.length} items`);

            const response = {
                success: true,
                data: paginatedData,
                pagination: {
                    currentPage: pageNum,
                    itemsPerPage: limitNum,
                    totalItems: allDetailedData.length,
                    totalPages: Math.ceil(allDetailedData.length / limitNum),
                    hasPrevPage: pageNum > 1,
                    hasNextPage: pageNum < Math.ceil(allDetailedData.length / limitNum),
                },
                dateRange: { start: startDate, end: endDate },
                timezone: timezone as string,
            };

            return res.json(response);
        } catch (error) {
            console.error('Error fetching detailed transactions:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch detailed transactions',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

export default router;

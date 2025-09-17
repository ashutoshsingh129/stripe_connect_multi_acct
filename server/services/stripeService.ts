import Stripe from 'stripe';
import moment from 'moment-timezone';
import { TransactionData } from '../types';
// import fs from 'fs';

class StripeService {
    // No longer requiring Stripe keys in environment variables
    // All Stripe keys are now provided via encrypted headers from frontend
    constructor() {
        // Constructor intentionally empty - Stripe keys come from request headers
    }

    // Get multiple accounts for the authenticated user
    async getMultipleAccounts(secretKey: string): Promise<any[]> {
        try {
            const stripe = new Stripe(secretKey);
            const accounts = await stripe.accounts.list({ limit: 100 });

            return accounts.data.map(account => ({
                id: account.id,
                business_type: account.business_type || 'individual',
                country: account.country || 'US',
                charges_enabled: account.charges_enabled || false,
                payouts_enabled: account.payouts_enabled || false,
                email: account.email || '',
                type: account.type || 'express',
            }));
        } catch (error) {
            console.error('Error fetching multiple accounts:', error);
            throw error;
        }
    }

    // Get a single account's basic info
    async getSingleAccount(secretKey: string, accountId: string): Promise<any | null> {
        try {
            const stripe = new Stripe(secretKey);
            const account = await stripe.accounts.retrieve(accountId);
            return {
                id: account.id,
                business_type: account.business_type || 'individual',
                country: account.country || 'US',
                charges_enabled: account.charges_enabled || false,
                payouts_enabled: account.payouts_enabled || false,
                email: account.email || '',
                type: account.type || 'express',
            };
        } catch (_err) {
            return null;
        }
    }

    // Get transactions for multiple accounts
    async getMultiAccountTransactions(
        secretKey: string,
        accountIds: string[],
        startDate: string,
        endDate: string,
        timezone: string = 'UTC'
    ): Promise<{ transactions: any[]; accounts: any[] }> {
        try {
            const stripe = new Stripe(secretKey);
            const allTransactions: any[] = [];
            const accountInfos: any[] = [];

            // Process each account
            for (const accountId of accountIds) {
                try {
                    // Get account info
                    const account = await stripe.accounts.retrieve(accountId);
                    accountInfos.push({
                        id: account.id,
                        business_type: account.business_type || 'individual',
                        country: account.country || 'US',
                        charges_enabled: account.charges_enabled || false,
                        payouts_enabled: account.payouts_enabled || false,
                        email: account.email || '',
                        type: account.type || 'express',
                    });

                    // Get transactions for this account
                    const accountTransactions = await this.getTransactions(
                        secretKey,
                        accountId,
                        startDate,
                        endDate,
                        timezone
                    );

                    // Add account_id to each transaction
                    const transactionsWithAccountId = accountTransactions.map(tx => ({
                        ...tx,
                        account_id: accountId,
                    }));

                    allTransactions.push(...transactionsWithAccountId);
                } catch (error) {
                    console.error(`Error processing account ${accountId}:`, error);
                    // Continue with other accounts
                }
            }

            // Sort transactions by date
            allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return {
                transactions: allTransactions,
                accounts: accountInfos,
            };
        } catch (error) {
            console.error('Error in getMultiAccountTransactions:', error);
            throw error;
        }
    }

    // Get transactions for a connected account within a date range
    async getTransactions(
        apiKey: string,
        connectedAccountId: string,
        startDate: string,
        endDate: string,
        timezone: string = 'UTC'
    ): Promise<TransactionData[]> {
        try {
            const userStripe = new Stripe(apiKey);

            // Convert dates to Unix timestamps
            const startTimestamp = moment.tz(startDate, timezone).unix();
            const endTimestamp = moment.tz(endDate, timezone).unix();

            // Get charges
            const charges = await this.getCharges(
                userStripe,
                connectedAccountId,
                startTimestamp,
                endTimestamp
            );

            // Get refunds
            const refunds = await this.getRefunds(
                userStripe,
                connectedAccountId,
                startTimestamp,
                endTimestamp
            );

            // Get chargebacks
            const chargebacks = await this.getChargebacks(
                userStripe,
                connectedAccountId,
                startTimestamp,
                endTimestamp
            );

            // Get declines (failed charges)
            const declines = await this.getDeclines(
                userStripe,
                connectedAccountId,
                startTimestamp,
                endTimestamp
            );

            // Group transactions by date
            const groupedTransactions = this.groupTransactionsByDate(
                charges,
                refunds,
                chargebacks,
                declines,
                startDate,
                endDate,
                timezone,
                connectedAccountId
            );

            return groupedTransactions;
        } catch (error) {
            console.error('Error fetching transactions:', error);
            throw new Error(
                `Failed to fetch transactions: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    // Get comprehensive transaction data including all endpoints
    async getComprehensiveTransactions(
        apiKey: string,
        connectedAccountId: string,
        startDate: string,
        endDate: string,
        timezone: string = 'UTC'
    ): Promise<{
        transactions: TransactionData[];
        paymentIntents: Stripe.PaymentIntent[];
        balanceTransactions: Stripe.BalanceTransaction[];
        events: Stripe.Event[];
        detailedRefunds: Stripe.Refund[];
        detailedDisputes: Stripe.Dispute[];
    }> {
        try {
            const userStripe = new Stripe(apiKey);

            // Convert dates to Unix timestamps
            const startTimestamp = moment.tz(startDate, timezone).unix();
            const endTimestamp = moment.tz(endDate, timezone).unix();

            // Get all data in parallel for better performance
            const [
                charges,
                refunds,
                chargebacks,
                declines,
                paymentIntents,
                balanceTransactions,
                events,
                detailedRefunds,
                detailedDisputes
            ] = await Promise.all([
                this.getCharges(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getRefunds(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getChargebacks(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getDeclines(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getPaymentIntents(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getBalanceTransactions(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getEvents(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getDetailedRefunds(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getDetailedDisputes(userStripe, connectedAccountId, startTimestamp, endTimestamp)
            ]);

            // Group transactions by date
            const groupedTransactions = this.groupTransactionsByDate(
                charges,
                refunds,
                chargebacks,
                declines,
                startDate,
                endDate,
                timezone,
                connectedAccountId
            );

            return {
                transactions: groupedTransactions,
                paymentIntents,
                balanceTransactions,
                events,
                detailedRefunds,
                detailedDisputes
            };
        } catch (error) {
            console.error('Error fetching comprehensive transactions:', error);
            throw new Error(
                `Failed to fetch comprehensive transactions: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    // Get compliance-focused transaction data with fraud monitoring details
    async getComplianceTransactions(
        apiKey: string,
        connectedAccountId: string,
        startDate: string,
        endDate: string,
        timezone: string = 'UTC'
    ): Promise<{
        charges: Stripe.Charge[];
        paymentIntents: Stripe.PaymentIntent[];
        balanceTransactions: Stripe.BalanceTransaction[];
        events: Stripe.Event[];
        refunds: Stripe.Refund[];
        disputes: Stripe.Dispute[];
    }> {
        try {
            const userStripe = new Stripe(apiKey);

            // Convert dates to Unix timestamps
            const startTimestamp = moment.tz(startDate, timezone).unix();
            const endTimestamp = moment.tz(endDate, timezone).unix();

            // Get all data in parallel for better performance
            const [
                charges,
                paymentIntents,
                balanceTransactions,
                events,
                refunds,
                disputes
            ] = await Promise.all([
                this.getCharges(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getPaymentIntents(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getBalanceTransactions(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getEvents(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getDetailedRefunds(userStripe, connectedAccountId, startTimestamp, endTimestamp),
                this.getDetailedDisputes(userStripe, connectedAccountId, startTimestamp, endTimestamp)
            ]);

            return {
                charges,
                paymentIntents,
                balanceTransactions,
                events,
                refunds,
                disputes
            };
        } catch (error) {
            console.error('Error fetching compliance transactions:', error);
            throw new Error(
                `Failed to fetch compliance transactions: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    // Get charges for a connected account
    private async getCharges(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Charge[]> {
        console.log(`🔍 Fetching charges for account ${connectedAccountId}`);
        console.log(`📅 Date range: ${new Date(startTimestamp * 1000)} to ${new Date(endTimestamp * 1000)}`);
        
        const charges: Stripe.Charge[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.ChargeListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                console.log(`📡 Stripe API call - charges.list for ${connectedAccountId}:`, params);
                const response = await stripeInstance.charges.list(params, {
                    stripeAccount: connectedAccountId,
                });

                console.log(`✅ Charges response for ${connectedAccountId}: ${response.data.length} charges found`);
                if (response.data.length > 0) {
                    console.log(`📋 Sample charge IDs:`, response.data.slice(0, 3).map(c => c.id));
                }

                charges.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error(`❌ Error fetching charges for ${connectedAccountId}:`, error);
                hasMore = false;
            }
        }

        console.log(`📊 Total charges found for ${connectedAccountId}: ${charges.length}`);
        
        // If no charges found, let's check if there are ANY charges in this account (without date filter)
        if (charges.length === 0) {
            console.log(`🔍 No charges found in date range. Checking if account has ANY charges...`);
            try {
                const testResponse = await stripeInstance.charges.list({ limit: 5 }, {
                    stripeAccount: connectedAccountId,
                });
                console.log(`📋 Account ${connectedAccountId} has ${testResponse.data.length} total charges (any date)`);
                if (testResponse.data.length > 0) {
                    console.log(`📅 Sample charge dates:`, testResponse.data.map(c => new Date(c.created * 1000).toISOString()));
                }
            } catch (error) {
                console.error(`❌ Error checking total charges for ${connectedAccountId}:`, error);
            }
        }
        
        return charges;
    }

    // Get refunds for a connected account
    private async getRefunds(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Refund[]> {
        const refunds: Stripe.Refund[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.RefundListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.refunds.list(params, {
                    stripeAccount: connectedAccountId,
                });

                refunds.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching refunds:', error);
                hasMore = false;
            }
        }

        return refunds;
    }

    // Get chargebacks for a connected account
    private async getChargebacks(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Dispute[]> {
        const chargebacks: Stripe.Dispute[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.DisputeListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.disputes.list(params, {
                    stripeAccount: connectedAccountId,
                });

                chargebacks.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching chargebacks:', error);
                hasMore = false;
            }
        }

        return chargebacks;
    }

    // Get declines (failed charges) for a connected account
    private async getDeclines(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Charge[]> {
        const declines: Stripe.Charge[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.ChargeListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.charges.list(params, {
                    stripeAccount: connectedAccountId,
                });

                declines.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching declines:', error);
                hasMore = false;
            }
        }

        return declines;
    }

    // Get payment intents for a connected account
    private async getPaymentIntents(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.PaymentIntent[]> {
        console.log(`🔍 Fetching payment intents for account ${connectedAccountId}`);
        console.log(`📅 Date range: ${new Date(startTimestamp * 1000)} to ${new Date(endTimestamp * 1000)}`);
        
        const paymentIntents: Stripe.PaymentIntent[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.PaymentIntentListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                console.log(`📡 Stripe API call - paymentIntents.list for ${connectedAccountId}:`, params);
                const response = await stripeInstance.paymentIntents.list(params, {
                    stripeAccount: connectedAccountId,
                });

                console.log(`✅ PaymentIntents response for ${connectedAccountId}: ${response.data.length} payment intents found`);
                if (response.data.length > 0) {
                    console.log(`📋 Sample payment intent IDs:`, response.data.slice(0, 3).map(pi => pi.id));
                }

                paymentIntents.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error(`❌ Error fetching payment intents for ${connectedAccountId}:`, error);
                hasMore = false;
            }
        }

        console.log(`📊 Total payment intents found for ${connectedAccountId}: ${paymentIntents.length}`);
        
        // If no payment intents found, let's check if there are ANY payment intents in this account (without date filter)
        if (paymentIntents.length === 0) {
            console.log(`🔍 No payment intents found in date range. Checking if account has ANY payment intents...`);
            try {
                const testResponse = await stripeInstance.paymentIntents.list({ limit: 5 }, {
                    stripeAccount: connectedAccountId,
                });
                console.log(`📋 Account ${connectedAccountId} has ${testResponse.data.length} total payment intents (any date)`);
                if (testResponse.data.length > 0) {
                    console.log(`📅 Sample payment intent dates:`, testResponse.data.map(pi => new Date(pi.created * 1000).toISOString()));
                }
            } catch (error) {
                console.error(`❌ Error checking total payment intents for ${connectedAccountId}:`, error);
            }
        }
        
        return paymentIntents;
    }

    // Get balance transactions for a connected account
    private async getBalanceTransactions(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.BalanceTransaction[]> {
        const balanceTransactions: Stripe.BalanceTransaction[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.BalanceTransactionListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.balanceTransactions.list(params, {
                    stripeAccount: connectedAccountId,
                });

                balanceTransactions.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching balance transactions:', error);
                hasMore = false;
            }
        }

        return balanceTransactions;
    }

    // Get events for a connected account
    private async getEvents(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Event[]> {
        const events: Stripe.Event[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.EventListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                    // Focus on payment-related events - get all events and filter later
                    // Note: Stripe API only accepts single type, so we'll get all events
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.events.list(params, {
                    stripeAccount: connectedAccountId,
                });

                // Filter for payment-related events
                const paymentRelatedEvents = response.data.filter(event => 
                    event.type.startsWith('charge.') ||
                    event.type.startsWith('payment_intent.') ||
                    event.type.startsWith('refund.') ||
                    event.type.startsWith('dispute.') ||
                    event.type.startsWith('balance.')
                );

                events.push(...paymentRelatedEvents);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching events:', error);
                hasMore = false;
            }
        }

        return events;
    }

    // Get detailed refunds for a connected account
    private async getDetailedRefunds(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Refund[]> {
        const refunds: Stripe.Refund[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.RefundListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.refunds.list(params, {
                    stripeAccount: connectedAccountId,
                });

                refunds.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching detailed refunds:', error);
                hasMore = false;
            }
        }

        return refunds;
    }

    // Get detailed disputes for a connected account
    private async getDetailedDisputes(
        stripeInstance: Stripe,
        connectedAccountId: string,
        startTimestamp: number,
        endTimestamp: number
    ): Promise<Stripe.Dispute[]> {
        const disputes: Stripe.Dispute[] = [];
        let hasMore = true;
        let startingAfter: string | null = null;

        while (hasMore) {
            try {
                const params: Stripe.DisputeListParams = {
                    limit: 100,
                    created: {
                        gte: startTimestamp,
                        lte: endTimestamp,
                    },
                };

                if (startingAfter) {
                    params.starting_after = startingAfter;
                }

                const response = await stripeInstance.disputes.list(params, {
                    stripeAccount: connectedAccountId,
                });

                disputes.push(...response.data);
                hasMore = response.has_more;
                startingAfter = response.data[response.data.length - 1]?.id || null;
            } catch (error) {
                console.error('Error fetching detailed disputes:', error);
                hasMore = false;
            }
        }

        return disputes;
    }

    // Group transactions by date and calculate daily summaries
    private groupTransactionsByDate(
        charges: Stripe.Charge[],
        refunds: Stripe.Refund[],
        chargebacks: Stripe.Dispute[],
        declines: Stripe.Charge[],
        startDate: string,
        endDate: string,
        timezone: string,
        accountId: string
    ): TransactionData[] {
        const dailyData: Record<string, TransactionData> = {};
        const currentDate = moment.tz(startDate, timezone);
        const endMoment = moment.tz(endDate, timezone);

        // Initialize all dates in the range
        while (currentDate.isSameOrBefore(endMoment, 'day')) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            dailyData[dateStr] = {
                date: dateStr,
                charges_count: 0,
                charges_amount: 0,
                refunds_count: 0,
                refunds_amount: 0,
                chargebacks_count: 0,
                chargebacks_amount: 0,
                declines_count: 0,
                aprvl_pct: 100,
                totals_count: 0,
                totals_amount: 0,
                account_id: accountId,
            };
            currentDate.add(1, 'day');
        }

        // Process charges
        charges.forEach(charge => {
            const dateStr = moment.unix(charge.created).tz(timezone).format('YYYY-MM-DD');
            if (dailyData[dateStr]) {
                dailyData[dateStr].charges_count++;
                dailyData[dateStr].charges_amount += charge.amount / 100; // Convert from cents
                dailyData[dateStr].totals_count++;
                dailyData[dateStr].totals_amount += charge.amount / 100;
            }
        });

        // Process refunds
        refunds.forEach(refund => {
            const dateStr = moment.unix(refund.created).tz(timezone).format('YYYY-MM-DD');
            if (dailyData[dateStr]) {
                dailyData[dateStr].refunds_count++;
                dailyData[dateStr].refunds_amount += refund.amount / 100;
                dailyData[dateStr].totals_count++;
                dailyData[dateStr].totals_amount -= refund.amount / 100;
            }
        });

        // Process chargebacks
        chargebacks.forEach(chargeback => {
            const dateStr = moment.unix(chargeback.created).tz(timezone).format('YYYY-MM-DD');
            if (dailyData[dateStr]) {
                dailyData[dateStr].chargebacks_count++;
                dailyData[dateStr].chargebacks_amount += chargeback.amount / 100;
                dailyData[dateStr].totals_count++;
                dailyData[dateStr].totals_amount -= chargeback.amount / 100;
            }
        });

        // Process declines
        declines.forEach(decline => {
            const dateStr = moment.unix(decline.created).tz(timezone).format('YYYY-MM-DD');
            if (dailyData[dateStr]) {
                dailyData[dateStr].declines_count++;
                dailyData[dateStr].totals_count++;
                // Declines don't affect total amount since they're failed
            }
        });

        // Calculate approval percentages and format amounts
        Object.values(dailyData).forEach(day => {
            day.charges_amount = Math.round(day.charges_amount * 100) / 100;
            day.refunds_amount = Math.round(day.refunds_amount * 100) / 100;
            day.chargebacks_amount = Math.round(day.chargebacks_amount * 100) / 100;
            day.totals_amount = Math.round(day.totals_amount * 100) / 100;

            // Calculate approval percentage
            const totalAttempts = day.charges_count + day.declines_count;
            day.aprvl_pct =
                totalAttempts > 0
                    ? Math.round((day.charges_count / totalAttempts) * 100 * 100) / 100
                    : 100;
        });

        return Object.values(dailyData);
    }
}

export default new StripeService();

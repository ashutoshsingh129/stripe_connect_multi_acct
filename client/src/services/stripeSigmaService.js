// Direct Stripe API Service (Sigma-like queries)
// This service simulates Sigma queries using Stripe's regular API endpoints

class StripeSigmaService {
    constructor() {
        this.baseURL = 'https://api.stripe.com/v1';
    }

    /**
     * Execute a Sigma-like query using Stripe's regular API
     */
    async executeQuery(query, accountIds = [], startDate = null, endDate = null) {
        const secretKey = localStorage.getItem('stripeSecretKey');
        
        if (!secretKey) {
            throw new Error('Stripe secret key not found. Please enter your Stripe keys first.');
        }

        console.log('🚀 Executing Sigma-like query using Stripe API');
        console.log(`   Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
        console.log(`   Account IDs: ${accountIds.length > 0 ? accountIds.join(', ') : 'All accounts'}`);
        console.log(`   Date Range: ${startDate || 'No start'} to ${endDate || 'No end'}`);
        console.log(`   Secret Key: ${secretKey.substring(0, 20)}...`);

        try {
            // Parse the query to determine what data to fetch
            const queryLower = query.toLowerCase();
            
            if (queryLower.includes('charges') || queryLower.includes('charge_id')) {
                return await this.executeChargesQuery(query, accountIds, startDate, endDate, secretKey);
            } else if (queryLower.includes('customers') || queryLower.includes('customer_id')) {
                return await this.executeCustomersQuery(query, accountIds, secretKey);
            } else if (queryLower.includes('payment_intents') || queryLower.includes('payment_intent_id')) {
                return await this.executePaymentIntentsQuery(query, accountIds, startDate, endDate, secretKey);
            } else {
                // Default to charges query
                return await this.executeChargesQuery(query, accountIds, startDate, endDate, secretKey);
            }

        } catch (error) {
            console.error('❌ Query execution failed:', error);
            throw error;
        }
    }

    /**
     * Execute charges-based queries
     */
    async executeChargesQuery(query, accountIds, startDate, endDate, secretKey) {
        console.log('📊 Executing charges query...');
        
        const allData = [];
        const accounts = accountIds.length > 0 ? accountIds : await this.getAllAccounts(secretKey);
        
        for (const accountId of accounts) {
            try {
                console.log(`   Fetching charges for account: ${accountId}`);
                
                // Build query parameters
                const params = new URLSearchParams({
                    limit: '100'
                });
                
                if (startDate) {
                    params.append('created[gte]', Math.floor(new Date(startDate).getTime() / 1000));
                }
                if (endDate) {
                    params.append('created[lte]', Math.floor(new Date(endDate).getTime() / 1000));
                }

                const response = await fetch(`${this.baseURL}/charges?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Stripe-Account': accountId
                    }
                });

                if (!response.ok) {
                    console.warn(`Failed to fetch charges for account ${accountId}: ${response.statusText}`);
                    continue;
                }

                const data = await response.json();
                
                // Transform charges data to match Sigma format
                const chargesData = data.data.map(charge => {
                    // Enhanced IP extraction from multiple sources
                    const customerIp = this.extractCustomerIP(charge);
                    
                    return {
                        account_id: accountId,
                        charge_id: charge.id,
                        amount: charge.amount / 100, // Convert from cents
                        currency: charge.currency,
                        created: new Date(charge.created * 1000).toISOString(),
                        status: charge.status,
                        description: charge.description || '',
                        customer_id: charge.customer || '',
                        receipt_email: charge.receipt_email || '',
                        payment_method: charge.payment_method_details?.type || '',
                        card_brand: charge.payment_method_details?.card?.brand || '',
                        card_country: charge.payment_method_details?.card?.country || '',
                        card_last4: charge.payment_method_details?.card?.last4 || '',
                        failure_code: charge.failure_code || '',
                        failure_message: charge.failure_message || '',
                        risk_level: charge.outcome?.risk_level || 'normal',
                        risk_reason: charge.outcome?.reason || '',
                        seller_message: charge.outcome?.seller_message || '',
                        network_status: charge.outcome?.network_status || '',
                        outcome_type: charge.outcome?.type || '',
                        // Enhanced IP fields
                        customer_ip: customerIp,
                        request_ip: charge.metadata?.request_ip || charge.metadata?.client_ip || '',
                        webhook_ip: charge.metadata?.webhook_ip || '',
                        source_ip: charge.metadata?.source_ip || '',
                        ip_address: charge.metadata?.ip_address || '',
                        client_ip: charge.metadata?.client_ip || '',
                        // Additional IP-related fields
                        ip_country: charge.metadata?.ip_country || '',
                        ip_city: charge.metadata?.ip_city || '',
                        ip_region: charge.metadata?.ip_region || '',
                        // Metadata analysis
                        metadata_keys: Object.keys(charge.metadata || {}).join(', '),
                        has_metadata: Object.keys(charge.metadata || {}).length > 0,
                        metadata_count: Object.keys(charge.metadata || {}).length,
                        has_ip_data: !!customerIp,
                        ip_source: this.getIPSource(charge),
                        payment_intent_id: typeof charge.payment_intent === 'object' ? charge.payment_intent?.id : charge.payment_intent || '',
                        has_payment_intent: !!charge.payment_intent,
                        has_outcome: !!charge.outcome,
                        has_payment_method_details: !!charge.payment_method_details
                    };
                });

                allData.push(...chargesData);
                console.log(`   Found ${chargesData.length} charges for account ${accountId}`);
                
            } catch (error) {
                console.error(`Error fetching charges for account ${accountId}:`, error);
            }
        }

        // Apply SQL-like filtering and aggregation
        return this.applyQueryFilters(query, allData);
    }

    /**
     * Execute customers-based queries
     */
    async executeCustomersQuery(query, accountIds, secretKey) {
        console.log('👥 Executing customers query...');
        
        const allData = [];
        const accounts = accountIds.length > 0 ? accountIds : await this.getAllAccounts(secretKey);
        
        for (const accountId of accounts) {
            try {
                const response = await fetch(`${this.baseURL}/customers?limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Stripe-Account': accountId
                    }
                });

                if (!response.ok) continue;

                const data = await response.json();
                
                const customersData = data.data.map(customer => ({
                    account_id: accountId,
                    customer_id: customer.id,
                    email: customer.email || '',
                    name: customer.name || '',
                    created: new Date(customer.created * 1000).toISOString(),
                    description: customer.description || '',
                    metadata_keys: Object.keys(customer.metadata || {}).join(', '),
                    has_metadata: Object.keys(customer.metadata || {}).length > 0,
                    metadata_count: Object.keys(customer.metadata || {}).length
                }));

                allData.push(...customersData);
                
            } catch (error) {
                console.error(`Error fetching customers for account ${accountId}:`, error);
            }
        }

        return this.applyQueryFilters(query, allData);
    }

    /**
     * Execute payment intents-based queries
     */
    async executePaymentIntentsQuery(query, accountIds, startDate, endDate, secretKey) {
        console.log('💳 Executing payment intents query...');
        
        const allData = [];
        const accounts = accountIds.length > 0 ? accountIds : await this.getAllAccounts(secretKey);
        
        for (const accountId of accounts) {
            try {
                const params = new URLSearchParams({ limit: '100' });
                if (startDate) params.append('created[gte]', Math.floor(new Date(startDate).getTime() / 1000));
                if (endDate) params.append('created[lte]', Math.floor(new Date(endDate).getTime() / 1000));

                const response = await fetch(`${this.baseURL}/payment_intents?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Stripe-Account': accountId
                    }
                });

                if (!response.ok) continue;

                const data = await response.json();
                
                const paymentIntentsData = data.data.map(pi => ({
                    account_id: accountId,
                    payment_intent_id: pi.id,
                    amount: pi.amount / 100,
                    currency: pi.currency,
                    created: new Date(pi.created * 1000).toISOString(),
                    status: pi.status,
                    description: pi.description || '',
                    customer_id: pi.customer || '',
                    receipt_email: pi.receipt_email || '',
                    payment_method: typeof pi.payment_method === 'object' ? pi.payment_method?.type || '' : '',
                    metadata_keys: Object.keys(pi.metadata || {}).join(', '),
                    has_metadata: Object.keys(pi.metadata || {}).length > 0,
                    metadata_count: Object.keys(pi.metadata || {}).length
                }));

                allData.push(...paymentIntentsData);
                
            } catch (error) {
                console.error(`Error fetching payment intents for account ${accountId}:`, error);
            }
        }

        return this.applyQueryFilters(query, allData);
    }

    /**
     * Enhanced customer IP extraction from multiple sources
     */
    extractCustomerIP(charge) {
        const metadata = charge.metadata || {};
        
        // Priority order for IP extraction
        const ipFields = [
            'customer_ip',
            'ip_address', 
            'client_ip',
            'source_ip',
            'user_ip',
            'visitor_ip',
            'remote_ip',
            'client_ip_address',
            'ip',
            'user_agent_ip'
        ];
        
        // Check metadata first
        for (const field of ipFields) {
            if (metadata[field] && this.isValidIP(metadata[field])) {
                return metadata[field].trim();
            }
        }
        
        // Check payment intent metadata if available
        if (charge.payment_intent && typeof charge.payment_intent === 'object') {
            const piMetadata = charge.payment_intent.metadata || {};
            for (const field of ipFields) {
                if (piMetadata[field] && this.isValidIP(piMetadata[field])) {
                    return piMetadata[field].trim();
                }
            }
        }
        
        // Check source if it's an object with metadata
        if (charge.source && typeof charge.source === 'object') {
            const sourceMetadata = charge.source.metadata || {};
            for (const field of ipFields) {
                if (sourceMetadata[field] && this.isValidIP(sourceMetadata[field])) {
                    return sourceMetadata[field].trim();
                }
            }
        }
        
        return '';
    }

    /**
     * Validate IP address format
     */
    isValidIP(ip) {
        if (!ip || typeof ip !== 'string') return false;
        
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        return ipRegex.test(ip) || ipv6Regex.test(ip);
    }

    /**
     * Determine the source of the IP address
     */
    getIPSource(charge) {
        const metadata = charge.metadata || {};
        
        if (metadata.customer_ip) return 'metadata.customer_ip';
        if (metadata.ip_address) return 'metadata.ip_address';
        if (metadata.client_ip) return 'metadata.client_ip';
        if (metadata.source_ip) return 'metadata.source_ip';
        if (metadata.user_ip) return 'metadata.user_ip';
        if (metadata.visitor_ip) return 'metadata.visitor_ip';
        if (metadata.remote_ip) return 'metadata.remote_ip';
        
        // Check payment intent
        if (charge.payment_intent && typeof charge.payment_intent === 'object') {
            const piMetadata = charge.payment_intent.metadata || {};
            if (piMetadata.customer_ip) return 'payment_intent.metadata.customer_ip';
            if (piMetadata.ip_address) return 'payment_intent.metadata.ip_address';
            if (piMetadata.client_ip) return 'payment_intent.metadata.client_ip';
        }
        
        return 'none';
    }

    /**
     * Get all connected accounts
     */
    async getAllAccounts(secretKey) {
        try {
            const response = await fetch(`${this.baseURL}/accounts?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${secretKey}`
                }
            });

            if (!response.ok) {
                console.warn('Could not fetch connected accounts, using main account only');
                return ['']; // Use main account
            }

            const data = await response.json();
            return data.data.map(account => account.id);
        } catch (error) {
            console.warn('Error fetching accounts:', error);
            return ['']; // Use main account
        }
    }

    /**
     * Apply SQL-like filters and aggregations to the data
     */
    applyQueryFilters(query, data) {
        console.log(`📊 Applying query filters to ${data.length} records...`);
        
        const queryLower = query.toLowerCase();
        let filteredData = [...data];
        
        // Apply WHERE clauses
        if (queryLower.includes('where')) {
            // Simple WHERE clause parsing
            if (queryLower.includes('status = \'failed\'')) {
                filteredData = filteredData.filter(row => row.status === 'failed');
            }
            if (queryLower.includes('status = \'succeeded\'')) {
                filteredData = filteredData.filter(row => row.status === 'succeeded');
            }
            if (queryLower.includes('customer_ip is not null')) {
                filteredData = filteredData.filter(row => row.customer_ip && row.customer_ip !== '');
            }
            if (queryLower.includes('has_ip_data = true')) {
                filteredData = filteredData.filter(row => row.has_ip_data === true);
            }
            if (queryLower.includes('has_metadata = true')) {
                filteredData = filteredData.filter(row => row.has_metadata === true);
            }
            if (queryLower.includes('risk_level in (\'elevated\', \'highest\')')) {
                filteredData = filteredData.filter(row => ['elevated', 'highest'].includes(row.risk_level));
            }
        }

        // Apply LIMIT
        const limitMatch = queryLower.match(/limit\s+(\d+)/);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1]);
            filteredData = filteredData.slice(0, limit);
        }

        // Apply ORDER BY
        if (queryLower.includes('order by created desc')) {
            filteredData.sort((a, b) => new Date(b.created) - new Date(a.created));
        } else if (queryLower.includes('order by created asc')) {
            filteredData.sort((a, b) => new Date(a.created) - new Date(b.created));
        }

        // Apply GROUP BY and aggregations
        if (queryLower.includes('group by') && queryLower.includes('count(*)')) {
            return this.applyGroupByCount(queryLower, filteredData);
        }
        if (queryLower.includes('group by') && queryLower.includes('sum(')) {
            return this.applyGroupBySum(queryLower, filteredData);
        }

        // Extract columns based on SELECT clause
        const columns = this.extractColumns(query);
        const resultData = filteredData.map(row => {
            const result = {};
            columns.forEach(col => {
                result[col] = row[col] || '';
            });
            return result;
        });

        console.log(`✅ Query executed successfully: ${resultData.length} rows returned`);
        
        return {
            success: true,
            data: resultData,
            columns: columns,
            row_count: resultData.length,
            execution_time: Date.now()
        };
    }

    /**
     * Extract column names from SELECT clause
     */
    extractColumns(query) {
        const selectMatch = query.match(/select\s+(.*?)\s+from/i);
        if (!selectMatch) return ['*'];
        
        const selectClause = selectMatch[1];
        if (selectClause.includes('*')) {
            // Return all available columns including enhanced IP fields
            return [
                'account_id', 'charge_id', 'amount', 'currency', 'created', 'status',
                'description', 'customer_id', 'receipt_email', 'payment_method',
                'card_brand', 'card_country', 'card_last4', 'failure_code',
                'failure_message', 'risk_level', 'risk_reason', 'seller_message',
                'network_status', 'outcome_type', 
                // Enhanced IP fields
                'customer_ip', 'request_ip', 'webhook_ip', 'source_ip', 'ip_address', 'client_ip',
                'ip_country', 'ip_city', 'ip_region',
                // Metadata analysis
                'metadata_keys', 'has_metadata', 'metadata_count', 'has_ip_data', 'ip_source',
                'payment_intent_id', 'has_payment_intent', 'has_outcome',
                'has_payment_method_details'
            ];
        }
        
        return selectClause.split(',').map(col => col.trim());
    }

    /**
     * Apply GROUP BY COUNT aggregation
     */
    applyGroupByCount(queryLower, data) {
        const groupByMatch = queryLower.match(/group by\s+(\w+)/);
        if (!groupByMatch) return { success: false, data: [], columns: [], row_count: 0 };
        
        const groupColumn = groupByMatch[1];
        const groups = {};
        
        data.forEach(row => {
            const key = row[groupColumn] || 'null';
            groups[key] = (groups[key] || 0) + 1;
        });
        
        const resultData = Object.entries(groups).map(([key, count]) => ({
            [groupColumn]: key,
            count: count
        }));
        
        return {
            success: true,
            data: resultData,
            columns: [groupColumn, 'count'],
            row_count: resultData.length,
            execution_time: Date.now()
        };
    }

    /**
     * Apply GROUP BY SUM aggregation
     */
    applyGroupBySum(queryLower, data) {
        const groupByMatch = queryLower.match(/group by\s+(\w+)/);
        const sumMatch = queryLower.match(/sum\((\w+)\)/);
        
        if (!groupByMatch || !sumMatch) return { success: false, data: [], columns: [], row_count: 0 };
        
        const groupColumn = groupByMatch[1];
        const sumColumn = sumMatch[1];
        const groups = {};
        
        data.forEach(row => {
            const key = row[groupColumn] || 'null';
            groups[key] = (groups[key] || 0) + (row[sumColumn] || 0);
        });
        
        const resultData = Object.entries(groups).map(([key, sum]) => ({
            [groupColumn]: key,
            [`sum_${sumColumn}`]: sum
        }));
        
        return {
            success: true,
            data: resultData,
            columns: [groupColumn, `sum_${sumColumn}`],
            row_count: resultData.length,
            execution_time: Date.now()
        };
    }

    /**
     * Get query templates
     */
    getQueryTemplates() {
        return [
            {
                name: 'Basic Charges Query',
                query: 'SELECT account_id, charge_id, amount, currency, created, status FROM charges LIMIT 10',
                description: 'Get basic charge information'
            },
            {
                name: 'Charges with Customer IP',
                query: 'SELECT account_id, charge_id, customer_ip, amount, currency, created FROM charges WHERE customer_ip IS NOT NULL LIMIT 10',
                description: 'Get charges with customer IP addresses'
            },
            {
                name: 'All IP Data Fields',
                query: 'SELECT account_id, charge_id, customer_ip, request_ip, webhook_ip, source_ip, ip_address, client_ip, ip_source FROM charges LIMIT 10',
                description: 'View all IP-related fields for analysis'
            },
            {
                name: 'IP Analysis by Account',
                query: 'SELECT account_id, COUNT(*) as total_charges, COUNT(customer_ip) as charges_with_ip FROM charges GROUP BY account_id',
                description: 'Analyze IP data coverage by account'
            },
            {
                name: 'Charges Count by Account',
                query: 'SELECT account_id, COUNT(*) as count FROM charges GROUP BY account_id',
                description: 'Count charges per account'
            },
            {
                name: 'Total Amount by Account',
                query: 'SELECT account_id, SUM(amount) as sum_amount FROM charges GROUP BY account_id',
                description: 'Sum of amounts per account'
            },
            {
                name: 'Recent Charges with IP',
                query: 'SELECT account_id, charge_id, customer_ip, amount, currency, created FROM charges ORDER BY created DESC LIMIT 20',
                description: 'Get recent charges with IP information'
            },
            {
                name: 'Failed Charges with IP',
                query: 'SELECT account_id, charge_id, customer_ip, amount, currency, created, failure_code FROM charges WHERE status = \'failed\' LIMIT 10',
                description: 'Get failed charges with IP data'
            },
            {
                name: 'High Risk Charges with IP',
                query: 'SELECT account_id, charge_id, customer_ip, risk_level, risk_reason, amount, created FROM charges WHERE risk_level IN (\'elevated\', \'highest\') LIMIT 10',
                description: 'Get high-risk charges with IP information'
            },
            {
                name: 'IP Source Analysis',
                query: 'SELECT ip_source, COUNT(*) as count FROM charges WHERE customer_ip IS NOT NULL GROUP BY ip_source',
                description: 'Analyze where IP addresses come from'
            },
            {
                name: 'Charges with Metadata',
                query: 'SELECT account_id, charge_id, metadata_keys, has_ip_data, metadata_count FROM charges WHERE has_metadata = true LIMIT 10',
                description: 'View charges with metadata and IP data flags'
            }
        ];
    }

    /**
     * Save query (local storage only)
     */
    saveQuery(name, query, description) {
        const savedQueries = this.getSavedQueries();
        const newQuery = {
            id: `query_${Date.now()}`,
            name,
            query,
            description,
            created_at: new Date().toISOString()
        };
        
        savedQueries.push(newQuery);
        localStorage.setItem('sigma_saved_queries', JSON.stringify(savedQueries));
        
        return newQuery;
    }

    /**
     * Get saved queries
     */
    getSavedQueries() {
        const saved = localStorage.getItem('sigma_saved_queries');
        return saved ? JSON.parse(saved) : [];
    }
}

// Create singleton instance
const stripeSigmaService = new StripeSigmaService();

export default stripeSigmaService;

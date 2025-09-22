import React, { useState, useEffect } from 'react';
import stripeSigmaService from '../../services/stripeSigmaService';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const SigmaQueryInterface = () => {
    const [query, setQuery] = useState('');
    const [queryResult, setQueryResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savedQueries, setSavedQueries] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [accountIds, setAccountIds] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [availableAccounts, setAvailableAccounts] = useState([]);

    useEffect(() => {
        loadSavedQueries();
        loadTemplates();
        loadAvailableAccounts();
    }, []);

    const loadSavedQueries = async () => {
        try {
            const queries = stripeSigmaService.getSavedQueries();
            setSavedQueries(queries);
        } catch (error) {
            console.error('Error loading saved queries:', error);
        }
    };

    const loadTemplates = async () => {
        try {
            const templates = stripeSigmaService.getQueryTemplates();
            setTemplates(templates);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    const loadAvailableAccounts = async () => {
        try {
            const secretKey = localStorage.getItem('stripeSecretKey');
            if (!secretKey) return;

            const response = await fetch('https://api.stripe.com/v1/accounts?limit=100', {
                headers: {
                    'Authorization': `Bearer ${secretKey}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setAvailableAccounts(data.data);
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    };

    const executeQuery = async () => {
        if (!query.trim()) {
            setError('Please enter a query');
            return;
        }

        setLoading(true);
        setError('');
        setQueryResult(null);

        try {
            // Parse account IDs from the input
            const accountIdList = accountIds 
                ? accountIds.split(',').map(id => id.trim()).filter(id => id)
                : [];

            const response = await stripeSigmaService.executeQuery(
                query, 
                accountIdList, 
                startDate || null, 
                endDate || null
            );
            setQueryResult(response);
        } catch (error) {
            setError(error.message || 'Failed to execute query');
            console.error('Query execution error:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveQuery = async () => {
        if (!query.trim()) {
            setError('Please enter a query to save');
            return;
        }

        const name = prompt('Enter a name for this query:');
        if (!name) return;

        const description = prompt('Enter a description (optional):') || '';

        try {
            const savedQuery = stripeSigmaService.saveQuery(name, query, description);
            alert('Query saved successfully!');
            loadSavedQueries();
        } catch (error) {
            setError('Failed to save query');
            console.error('Save query error:', error);
        }
    };

    const loadTemplate = (template) => {
        setQuery(template.query);
    };

    const loadSavedQuery = (savedQuery) => {
        setQuery(savedQuery.query);
    };

    const exportResults = async (format) => {
        if (!queryResult) {
            setError('No results to export');
            return;
        }

        try {
            // Convert results to CSV format
            const csvContent = [
                queryResult.columns.join(','),
                ...queryResult.data.map(row => 
                    queryResult.columns.map(col => `"${row[col] || ''}"`).join(',')
                )
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sigma-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            setError('Export failed');
            console.error('Export error:', error);
        }
    };

    return (
        <div className="sigma-query-interface">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 text-gray-800">Stripe Sigma Query Interface</h1>
                
                {/* Query Templates */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Query Templates</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">{template.name}</h3>
                                <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                                <button
                                    onClick={() => loadTemplate(template)}
                                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                                >
                                    Load Template
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Saved Queries */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Saved Queries</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedQueries.map((savedQuery, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">{savedQuery.name}</h3>
                                <p className="text-sm text-gray-600 mb-2">{savedQuery.description}</p>
                                <button
                                    onClick={() => loadSavedQuery(savedQuery)}
                                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                                >
                                    Load Query
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Query Input */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Query Configuration</h2>
                    
                    {/* Date Range Selection */}
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Date (Optional)
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Date (Optional)
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Account Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Account IDs (comma-separated, leave empty for all accounts)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={accountIds}
                                onChange={(e) => setAccountIds(e.target.value)}
                                placeholder="acct_1234567890, acct_0987654321"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {availableAccounts.length > 0 && (
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setAccountIds(e.target.value);
                                        }
                                    }}
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Account</option>
                                    {availableAccounts.map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.id} - {account.business_profile?.name || account.display_name || 'Unnamed'}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {availableAccounts.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                Found {availableAccounts.length} connected accounts
                            </p>
                        )}
                    </div>

                    {/* SQL Query */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            SQL Query
                        </label>
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter your SQL query here..."
                            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mb-6 flex flex-wrap gap-4">
                    <button
                        onClick={executeQuery}
                        disabled={loading}
                        className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Executing...' : 'Execute Query'}
                    </button>
                    <button
                        onClick={saveQuery}
                        className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600"
                    >
                        Save Query
                    </button>
                    {queryResult && (
                        <button
                            onClick={() => exportResults('csv')}
                            className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
                        >
                            Export CSV
                        </button>
                    )}
                </div>

                {/* Error Display */}
                {error && <ErrorMessage message={error} />}

                {/* Loading Spinner */}
                {loading && <LoadingSpinner />}

                {/* Query Results */}
                {queryResult && (
                    <div className="mt-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Query Results</h2>
                        <div className="mb-4 text-sm text-gray-600">
                            <p>Rows: {queryResult.row_count}</p>
                            <p>Execution Time: {queryResult.execution_time}ms</p>
                        </div>
                        
                        {queryResult.data.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-300">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {queryResult.columns.map((column, index) => (
                                                <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {queryResult.data.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {queryResult.columns.map((column, colIndex) => (
                                                    <td key={colIndex} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border-b">
                                                        {row[column] !== null && row[column] !== undefined ? String(row[column]) : ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                No data returned from query
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SigmaQueryInterface;

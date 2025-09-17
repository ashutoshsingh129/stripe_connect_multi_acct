import { useState, useCallback } from 'react';
import { apiService } from '../services/api';
import { encryptSecretKey, encryptPublicKey } from '../utils/encryption';

export const useReport = () => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [paginationLoading, setPaginationLoading] = useState(false);
    const [error, setError] = useState(null);

    const generateReport = useCallback(
        async (formData, page = 1, limit = 10) => {
            try {
                // Set appropriate loading state based on whether it's a pagination change
                if (
                    report &&
                    (page !== report.pagination?.currentPage ||
                        limit !== report.pagination?.itemsPerPage)
                ) {
                    setPaginationLoading(true);
                } else {
                    setLoading(true);
                }
                setError(null);

                const params = new URLSearchParams({
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    timezone: formData.timezone,
                    period: formData.period,
                    page: page.toString(),
                    limit: limit.toString(),
                });

                // Prepare encrypted headers (only Stripe keys, no auth token)
                const headers = {
                    'x-secret-key': encryptSecretKey(formData.secretKey),
                    'x-public-key': encryptPublicKey(formData.publicKey),
                };

                // Always use multi-account endpoint for consistency
                const response = await apiService.getMultiAccountReport(
                    formData.connectedAccountId,
                    params,
                    headers
                );

                if (response.success) {
                    const transformedReport = {
                        transactions: response.data || [],
                        accounts: response.accounts || [],
                        pagination: {
                            currentPage: response.pagination?.currentPage || page,
                            itemsPerPage: response.pagination?.itemsPerPage || limit,
                            totalItems: response.pagination?.totalItems || 0,
                            totalPages: response.pagination?.totalPages || 0,
                            hasPrevPage: response.pagination?.hasPrevPage || false,
                            hasNextPage: response.pagination?.hasNextPage || false,
                        },
                        dateRange: {
                            start: formData.startDate,
                            end: formData.endDate,
                        },
                        timezone: formData.timezone,
                    };

                    setReport(transformedReport);
                    return transformedReport;
                } else {
                    throw new Error(response.error || 'Failed to generate report');
                }
            } catch (error) {
                console.error('Error generating report:', error);
                setError(error.message || 'Failed to generate report');
                throw error;
            } finally {
                setLoading(false);
                setPaginationLoading(false);
            }
        },
        [report]
    );

    const exportReport = useCallback(async (formData, format = 'csv', email = null) => {
        try {
            setExportLoading(true);
            setError(null);

            // Prepare encrypted headers for export functions (only Stripe keys, no auth token)
            const headers = {
                'x-secret-key': encryptSecretKey(formData.secretKey),
                'x-public-key': encryptPublicKey(formData.publicKey),
            };

            let response;
            if (format === 'csv') {
                response = await apiService.exportToCSV(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: formData.period,
                    },
                    headers
                );
            } else if (format === 'xls' || format === 'xlsx') {
                response = await apiService.exportToXLS(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: formData.period,
                    },
                    headers
                );
            } else if (format === 'pdf') {
                response = await apiService.exportToPDF(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: formData.period,
                    },
                    headers
                );
            } else if (format === 'sheets') {
                response = await apiService.exportToGoogleSheets(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: formData.period,
                    },
                    headers
                );
            } else if (format === 'email') {
                if (!email) {
                    throw new Error('Email address is required for email export');
                }

                response = await apiService.exportToEmail(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: formData.period,
                        email: email,
                    },
                    headers
                );
            } else {
                throw new Error(`Unsupported export format: ${format}`);
            }

            // Handle file download for binary downloads (CSV, Excel, PDF, Google Sheets)
            if (
                format === 'csv' ||
                format === 'xls' ||
                format === 'xlsx' ||
                format === 'pdf' ||
                format === 'sheets'
            ) {
                // For binary downloads, response.data is a Blob
                if (response && response.data) {
                    const blob = response.data;
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;

                    // Get filename from Content-Disposition header or create default
                    const contentDisposition = response.headers['content-disposition'];
                    let filename;
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(
                            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
                        );
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                    }

                    // Fallback to default filename
                    if (!filename) {
                        if (format === 'csv') {
                            filename = `stripe-report-${formData.startDate}-${formData.endDate}-PROTECTED.csv.zip`;
                        } else if (format === 'xls' || format === 'xlsx') {
                            filename = `stripe-report-${formData.startDate}-${formData.endDate}-PROTECTED.zip`;
                        } else if (format === 'pdf') {
                            filename = `stripe-report-${formData.startDate}-${formData.endDate}-PROTECTED.pdf`;
                        } else if (format === 'sheets') {
                            filename = `stripe-report-${formData.startDate}-${formData.endDate}-google-sheets-PROTECTED.zip`;
                        }
                    }

                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    throw new Error('No file data received from server');
                }
            } else if (format === 'email') {
                // Handle email export response (still JSON)
                if (response && response.success) {
                    // Show success message (you can enhance this with a toast notification)
                    // You could set a success state here to show a success message to the user
                    console.log('Email export successful:', response.message);
                } else {
                    throw new Error(response?.error || 'Failed to send email export');
                }
            }
        } catch (error) {
            console.error('Error exporting report:', error);
            setError(error.message || 'Failed to export report');
            throw error;
        } finally {
            setExportLoading(false);
        }
    }, []);

    const exportDetailedTransactions = useCallback(async (formData, format = 'csv', email = null) => {
        try {
            setExportLoading(true);
            setError(null);

            // Prepare encrypted headers for export functions (only Stripe keys, no auth token)
            const headers = {
                'x-secret-key': encryptSecretKey(formData.secretKey),
                'x-public-key': encryptPublicKey(formData.publicKey),
            };

            let response;
            if (format === 'csv') {
                response = await apiService.exportDetailedToCSV(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: 'custom', // Detailed transactions always use custom period
                    },
                    headers
                );
            } else if (format === 'xls' || format === 'xlsx') {
                response = await apiService.exportDetailedToXLS(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: 'custom',
                    },
                    headers
                );
            } else if (format === 'pdf') {
                response = await apiService.exportDetailedToPDF(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: 'custom',
                    },
                    headers
                );
            } else if (format === 'sheets') {
                response = await apiService.exportDetailedToGoogleSheets(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: 'custom',
                    },
                    headers
                );
            } else if (format === 'email') {
                if (!email) {
                    throw new Error('Email address is required for email export');
                }

                response = await apiService.exportDetailedToEmail(
                    formData.connectedAccountId,
                    {
                        start_date: formData.startDate,
                        end_date: formData.endDate,
                        timezone: formData.timezone,
                        period: 'custom',
                        email: email,
                    },
                    headers
                );
            } else {
                throw new Error(`Unsupported export format: ${format}`);
            }

            // Handle file download for binary downloads (CSV, Excel, PDF, Google Sheets)
            if (
                format === 'csv' ||
                format === 'xls' ||
                format === 'xlsx' ||
                format === 'pdf' ||
                format === 'sheets'
            ) {
                // For binary downloads, response.data is a Blob
                if (response && response.data) {
                    const blob = response.data;
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;

                    // Get filename from Content-Disposition header or create default
                    const contentDisposition = response.headers['content-disposition'];
                    let filename;
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(
                            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
                        );
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                    }

                    // Fallback to default filename
                    if (!filename) {
                        if (format === 'csv') {
                            filename = `stripe-detailed-transactions-${formData.startDate}-${formData.endDate}-PROTECTED.csv.zip`;
                        } else if (format === 'xls' || format === 'xlsx') {
                            filename = `stripe-detailed-transactions-${formData.startDate}-${formData.endDate}-PROTECTED.zip`;
                        } else if (format === 'pdf') {
                            filename = `stripe-detailed-transactions-${formData.startDate}-${formData.endDate}-PROTECTED.pdf`;
                        } else if (format === 'sheets') {
                            filename = `stripe-detailed-transactions-${formData.startDate}-${formData.endDate}-google-sheets-PROTECTED.zip`;
                        }
                    }

                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    throw new Error('No file data received from server');
                }
            } else if (format === 'email') {
                // Handle email export response (still JSON)
                if (response && response.success) {
                    // Show success message (you can enhance this with a toast notification)
                    // You could set a success state here to show a success message to the user
                    console.log('Email export successful:', response.message);
                } else {
                    throw new Error(response?.error || 'Failed to send email export');
                }
            }
        } catch (error) {
            console.error('Error exporting detailed transactions:', error);
            setError(error.message || 'Failed to export detailed transactions');
            throw error;
        } finally {
            setExportLoading(false);
        }
    }, []);

    return {
        report,
        setReport,
        loading,
        exportLoading,
        paginationLoading,
        error,
        generateReport,
        exportReport,
        exportDetailedTransactions,
    };
};

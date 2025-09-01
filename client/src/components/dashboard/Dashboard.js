import React, { useState, useEffect } from 'react';
import { Container, Typography, AppBar, Toolbar, Button, Box } from '@mui/material';
import { format } from 'date-fns';

// Custom hooks
import { useTimezones } from '../../hooks/useTimezones';
import { useReport } from '../../hooks/useReport';

// API service
import { apiService, logout } from '../../services/api';

// Encryption utilities
import { encryptSecretKey, encryptPublicKey } from '../../utils/encryption';

// Components
import ReportForm from '../forms/ReportForm';
import ReportDisplay from '../reports/ReportDisplay';
import StandardReport from '../reports/StandardReport';
import ReportToggle from '../reports/ReportToggle';
import ExportButtons from '../export/ExportButtons';
import EmailExportModal from '../export/EmailExportModal';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const Dashboard = ({ user, onLogout }) => {
    // Form state
    const [formData, setFormData] = useState({
        connectedAccountId: '',
        startDate: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        timezone: 'America/New_York',
        period: 'custom',
    });

    // Accounts state
    const [accounts, setAccounts] = useState([]);

    // Email export modal state
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    // Custom hooks
    const { timezones } = useTimezones();
    const {
        report,
        setReport,
        loading,
        exportLoading,
        paginationLoading,
        error,
        generateReport,
        exportReport,
    } = useReport();

    // Load Stripe Connect accounts when component mounts
    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const { publicKey, secretKey } = getStripeKeys();
                console.log('Loading accounts with keys:', {
                    publicKey: publicKey ? 'present' : 'missing',
                    secretKey: secretKey ? 'present' : 'missing',
                });

                if (publicKey && secretKey) {
                    // Add keys to form data
                    setFormData(prev => ({
                        ...prev,
                        publicKey,
                        secretKey,
                    }));

                    console.log('Fetching accounts from API...');
                    const headers = {
                        'x-secret-key': encryptSecretKey(secretKey),
                        'x-public-key': encryptPublicKey(publicKey),
                    };
                    const accountsData = await apiService.getAccounts(headers);
                    console.log('Accounts API response:', accountsData);

                    if (accountsData.success && accountsData.accounts) {
                        setAccounts(accountsData.accounts);
                        console.log('Accounts loaded:', accountsData.accounts);
                    }
                } else {
                    console.log('Stripe keys not available yet');
                }
            } catch (error) {
                console.error('Failed to load accounts:', error);
            }
        };

        loadAccounts();
    }, []);

    // Report type state for toggling between Standard and Detailed views
    const [reportType, setReportType] = useState('standard'); // 'standard' or 'detailed'

    // Get Stripe keys from localStorage
    const getStripeKeys = () => {
        const publicKey = localStorage.getItem('stripePublicKey');
        const secretKey = localStorage.getItem('stripeSecretKey');
        return { publicKey, secretKey };
    };

    // Handle form changes
    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear the report when configuration changes (except for account selection)
        const configFields = ['startDate', 'endDate', 'timezone', 'period'];
        if (configFields.includes(field) && report) {
            // Clear the report to force regeneration
            setReport(null);
        }
    };

    // Handle form submission
    const handleSubmit = async () => {
        try {
            const { publicKey, secretKey } = getStripeKeys();
            if (!publicKey || !secretKey) {
                console.error('Stripe keys not found');
                return;
            }

            // Add keys to form data for the report generation
            const reportFormData = {
                ...formData,
                publicKey,
                secretKey,
            };

            await generateReport(reportFormData);
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    };

    // Handle export
    const handleExport = async format => {
        try {
            const { publicKey, secretKey } = getStripeKeys();
            if (!publicKey || !secretKey) {
                console.error('Stripe keys not found');
                return;
            }

            const exportFormData = {
                ...formData,
                publicKey,
                secretKey,
            };

            await exportReport(exportFormData, format);
        } catch (error) {
            console.error('Failed to export report:', error);
        }
    };

    // Handle email export
    const handleEmailExport = () => {
        setEmailModalOpen(true);
    };

    // Handle email export submission
    const handleEmailExportSubmit = async email => {
        try {
            const { publicKey, secretKey } = getStripeKeys();
            if (!publicKey || !secretKey) {
                console.error('Stripe keys not found');
                return;
            }

            const exportFormData = {
                ...formData,
                publicKey,
                secretKey,
            };

            await exportReport(exportFormData, 'email', email);
            setEmailModalOpen(false);
        } catch (error) {
            console.error('Failed to export report via email:', error);
        }
    };

    // Handle report type toggle
    const handleReportTypeChange = (event, newReportType) => {
        if (newReportType !== null) {
            setReportType(newReportType);
        }
    };

    // Handle logout
    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear Stripe keys from localStorage
            localStorage.removeItem('stripePublicKey');
            localStorage.removeItem('stripeSecretKey');

            // Call parent logout handler
            onLogout();
        }
    };

    return (
        <>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Stripe Connect Reporting
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2">Welcome, {user?.username}</Typography>
                        <Button color="inherit" onClick={handleLogout}>
                            Logout
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Transaction Reports
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                    Generate Standard Reports with charts and insights, or Detailed Reports with
                    transaction data and export options
                </Typography>

                <ReportForm
                    formData={formData}
                    onFormChange={handleFormChange}
                    onGenerateReport={handleSubmit}
                    loading={loading}
                    timezones={timezones}
                    accounts={accounts}
                />

                {/* Show Export Buttons even when no report exists */}
                <ExportButtons
                    onExportCSV={() => handleExport('csv')}
                    onExportXLS={() => handleExport('xls')}
                    onExportPDF={() => handleExport('pdf')}
                    onEmailExport={handleEmailExport}
                    onExportGoogleSheets={() => handleExport('sheets')}
                    loading={exportLoading}
                    hasReport={!!report}
                    hasCredentials={!!formData.connectedAccountId}
                />

                {/* Report Type Toggle - only show when report exists */}
                {report && (
                    <ReportToggle
                        reportType={reportType}
                        onReportTypeChange={handleReportTypeChange}
                        disabled={loading}
                    />
                )}

                {/* Show Generate Report Loading Spinner below export options */}
                {loading && <LoadingSpinner />}
                {error && <ErrorMessage error={error} onClose={() => {}} />}

                {/* Show Report Display only when report exists */}
                {report && (
                    <>
                        {reportType === 'standard' ? (
                            <StandardReport report={report} formData={formData} />
                        ) : (
                            <ReportDisplay
                                report={report}
                                currentPage={report.pagination?.currentPage || 1}
                                itemsPerPage={report.pagination?.itemsPerPage || 10}
                                onPageChange={newPage =>
                                    generateReport(
                                        formData,
                                        newPage,
                                        report.pagination?.itemsPerPage || 10
                                    )
                                }
                                onItemsPerPageChange={newLimit =>
                                    generateReport(formData, 1, newLimit)
                                }
                                paginationLoading={paginationLoading}
                            />
                        )}
                    </>
                )}

                {/* Email Export Modal */}
                <EmailExportModal
                    open={emailModalOpen}
                    onClose={() => setEmailModalOpen(false)}
                    onExport={handleEmailExportSubmit}
                    loading={exportLoading}
                    reportInfo={{
                        startDate: formData.startDate,
                        endDate: formData.endDate,
                        timezone: formData.timezone,
                        accountCount: formData.connectedAccountId.includes(',')
                            ? formData.connectedAccountId.split(',').length
                            : 1,
                    }}
                />
            </Container>
        </>
    );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { Container, Typography, AppBar, Toolbar, Button, Box, ToggleButton, ToggleButtonGroup, Chip, Paper } from '@mui/material';
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
import DetailedTransactionView from '../reports/DetailedTransactionView';
import SigmaQueryInterface from '../sigma/SigmaQueryInterface';

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
    const [emailExportType, setEmailExportType] = useState('regular'); // 'regular' or 'detailed'

    // Detailed transaction view state
    const [showDetailedView, setShowDetailedView] = useState(false);
    const [viewMode, setViewMode] = useState('report'); // 'report', 'details', or 'sigma'
    const [detailedViewLoading, setDetailedViewLoading] = useState(false);

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
        exportDetailedTransactions,
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

            // Set view mode to report when generating reports
            setViewMode('report');
            setShowDetailedView(false);

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
        setEmailExportType('regular'); // Set flag for regular export
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

    // Handle detailed transaction export
    const handleDetailedExport = async format => {
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

            await exportDetailedTransactions(exportFormData, format);
        } catch (error) {
            console.error('Failed to export detailed transactions:', error);
        }
    };

    // Handle detailed transaction email export
    const handleDetailedEmailExport = () => {
        setEmailModalOpen(true);
        setEmailExportType('detailed'); // Set flag for detailed export
    };

    // Handle detailed transaction email export submission
    const handleDetailedEmailExportSubmit = async email => {
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

            await exportDetailedTransactions(exportFormData, 'email', email);
            setEmailModalOpen(false);
            setEmailExportType('regular'); // Reset flag
        } catch (error) {
            console.error('Failed to export detailed transactions via email:', error);
        }
    };

    // Handle report type toggle
    const handleReportTypeChange = (event, newReportType) => {
        if (newReportType !== null) {
            setReportType(newReportType);
        }
    };

    // Handle View Details button from ReportForm
    const handleViewDetails = async () => {
        try {
            setDetailedViewLoading(true);
            setViewMode('details');
            setShowDetailedView(true);
            // Clear any existing report when switching to details view
            setReport(null);
        } catch (error) {
            console.error('Failed to load detailed view:', error);
        } finally {
            setDetailedViewLoading(false);
        }
    };

    // Handle Sigma button from ReportForm
    const handleSigmaView = () => {
        setViewMode('sigma');
        setShowDetailedView(false);
        setReport(null);
    };

    const handleCloseDetailedView = () => {
        setShowDetailedView(false);
        setViewMode('report');
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
                    Generate Standard Reports with charts and insights, or View Detailed Transactions with 
                    compliance data and IP information
                </Typography>

                <ReportForm
                    formData={formData}
                    onFormChange={handleFormChange}
                    onGenerateReport={handleSubmit}
                    onViewDetails={handleViewDetails}
                    onSigmaView={handleSigmaView}
                    loading={loading}
                    detailedViewLoading={detailedViewLoading}
                    timezones={timezones}
                    accounts={accounts}
                />

                {/* Export Section with Mode Toggle */}
                {(viewMode === 'report' || viewMode === 'details') && (
                    <Paper elevation={2.5} sx={{ p: 3, mb: 3 }}>
                        {/* Header with Export Options title and Mode Toggle */}
                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6">
                                Export Options
                            </Typography>
                            <ToggleButtonGroup
                                value={viewMode}
                                exclusive
                                onChange={(event, newMode) => {
                                    if (newMode !== null) {
                                        if (newMode === 'report') {
                                            handleSubmit();
                                        } else if (newMode === 'details') {
                                            handleViewDetails();
                                        } else if (newMode === 'sigma') {
                                            handleSigmaView();
                                        }
                                    }
                                }}
                                aria-label="view mode"
                                size="small"
                            >
                                <ToggleButton value="report" aria-label="generate report">
                                    📊 Report
                                </ToggleButton>
                                <ToggleButton value="details" aria-label="view details">
                                    🔍 Details
                                </ToggleButton>
                                <ToggleButton value="sigma" aria-label="sigma queries">
                                    📊 Sigma
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        {/* Export Buttons for report mode */}
                        {viewMode === 'report' && (
                            <ExportButtons
                                onExportCSV={() => handleExport('csv')}
                                onExportXLS={() => handleExport('xls')}
                                onExportPDF={() => handleExport('pdf')}
                                onEmailExport={handleEmailExport}
                                onExportGoogleSheets={() => handleExport('sheets')}
                                loading={exportLoading}
                                hasReport={!!report}
                                hasCredentials={!!formData.connectedAccountId}
                                hideHeader={true}
                            />
                        )}

                        {/* Export Buttons for detailed view mode */}
                        {viewMode === 'details' && (
                            <ExportButtons
                                onExportCSV={() => handleDetailedExport('csv')}
                                onExportXLS={() => handleDetailedExport('xls')}
                                onExportPDF={() => handleDetailedExport('pdf')}
                                onEmailExport={handleDetailedEmailExport}
                                onExportGoogleSheets={() => handleDetailedExport('sheets')}
                                loading={exportLoading}
                                hasReport={showDetailedView}
                                hasCredentials={!!formData.connectedAccountId}
                                hideHeader={true}
                            />
                        )}
                    </Paper>
                )}

                {/* Report Type Toggle - only show when report exists and in report mode */}
                {viewMode === 'report' && report && (
                    <ReportToggle
                        reportType={reportType}
                        onReportTypeChange={handleReportTypeChange}
                        disabled={loading}
                    />
                )}

                {/* Show Generate Report Loading Spinner below export options */}
                {loading && <LoadingSpinner />}
                {error && <ErrorMessage error={error} onClose={() => {}} />}

                {/* Show Report Display only when report exists and in report mode */}
                {viewMode === 'report' && report && (
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

                {/* Detailed Transaction View - show when in details mode */}
                {viewMode === 'details' && showDetailedView && (
                    <DetailedTransactionView
                        accountIds={formData.connectedAccountId}
                        startDate={formData.startDate}
                        endDate={formData.endDate}
                        timezone={formData.timezone}
                        onClose={handleCloseDetailedView}
                    />
                )}

                {/* Sigma Query Interface - show when in sigma mode */}
                {viewMode === 'sigma' && (
                    <SigmaQueryInterface />
                )}

                {/* Email Export Modal */}
                <EmailExportModal
                    open={emailModalOpen}
                    onClose={() => setEmailModalOpen(false)}
                    onExport={emailExportType === 'detailed' ? handleDetailedEmailExportSubmit : handleEmailExportSubmit}
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

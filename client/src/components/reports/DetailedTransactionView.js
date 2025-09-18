import React, { useState, useEffect, useCallback } from 'react';
import {
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    CircularProgress,
    Chip,
    Collapse,
    Button,
    Grid,
    Card,
    CardContent,
} from '@mui/material';
import {
    FirstPage as FirstPageIcon,
    KeyboardArrowLeft as KeyboardArrowLeftIcon,
    KeyboardArrowRight as KeyboardArrowRightIcon,
    LastPage as LastPageIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Security as SecurityIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import { apiService } from '../../services/api';
import { encryptSecretKey, encryptPublicKey } from '../../utils/encryption';

const DetailedTransactionView = ({ 
    accountIds, 
    startDate, 
    endDate, 
    timezone,
    onClose
}) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [paginationLoading, setPaginationLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        itemsPerPage: 50,
        totalItems: 0,
        totalPages: 0,
        hasPrevPage: false,
        hasNextPage: false,
    });
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRiskLevel, setFilterRiskLevel] = useState('all');

    // Fetch detailed transactions
    const fetchDetailedTransactions = useCallback(async (page = 1, limit = 50) => {
        try {
            console.log(`Fetching detailed transactions for accountIds: "${accountIds}"`);
            
            if (page === 1) {
                setLoading(true);
            } else {
                setPaginationLoading(true);
            }
            setError(null);

            // Get Stripe keys from localStorage
            const publicKey = localStorage.getItem('stripePublicKey');
            const secretKey = localStorage.getItem('stripeSecretKey');

            if (!publicKey || !secretKey) {
                setError('Stripe keys not found. Please re-enter your credentials.');
                return;
            }

            // Prepare encrypted headers
            const headers = {
                'x-secret-key': encryptSecretKey(secretKey),
                'x-public-key': encryptPublicKey(publicKey),
            };

            const response = await apiService.getDetailedTransactions(
                accountIds,
                startDate,
                endDate,
                timezone,
                page,
                limit,
                headers
            );

            if (response.success) {
                console.log(`Detailed Transactions Response - Page: ${page}, Limit: ${limit}, Total: ${response.pagination.totalItems}, Current: ${response.pagination.currentPage}`);
                setTransactions(response.data);
                setPagination(response.pagination);
            } else {
                setError(response.message || 'Failed to fetch detailed transactions');
            }
        } catch (err) {
            setError(err.message || 'An error occurred while fetching transactions');
        } finally {
            setLoading(false);
            setPaginationLoading(false);
        }
    }, [accountIds, startDate, endDate, timezone]);

    useEffect(() => {
        if (accountIds && startDate && endDate && timezone) {
            fetchDetailedTransactions();
        }
    }, [accountIds, startDate, endDate, timezone, fetchDetailedTransactions]);

    const handlePageChange = (newPage) => {
        fetchDetailedTransactions(newPage, pagination.itemsPerPage);
    };

    const handleItemsPerPageChange = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        fetchDetailedTransactions(1, newLimit);
    };

    const toggleRowExpansion = (transactionId) => {
        const newExpandedRows = new Set(expandedRows);
        if (newExpandedRows.has(transactionId)) {
            newExpandedRows.delete(transactionId);
        } else {
            newExpandedRows.add(transactionId);
        }
        setExpandedRows(newExpandedRows);
    };

    const getStatusChip = (status, paid, disputed) => {
        if (disputed) {
            return <Chip icon={<WarningIcon />} label="Disputed" color="error" size="small" />;
        }
        if (paid) {
            return <Chip icon={<CheckCircleIcon />} label="Paid" color="success" size="small" />;
        }
        return <Chip icon={<CancelIcon />} label="Failed" color="error" size="small" />;
    };

    const getRiskLevelChip = (riskLevel) => {
        if (!riskLevel || riskLevel === 'not_assessed') return null;
        
        const riskConfig = {
            normal: { color: 'success', label: 'Normal' },
            elevated: { color: 'warning', label: 'Elevated' },
            highest: { color: 'error', label: 'Highest' },
            unknown: { color: 'default', label: 'Unknown' },
        };

        const config = riskConfig[riskLevel] || riskConfig.unknown;
        return <Chip label={config.label} color={config.color} size="small" />;
    };

    const getNetworkStatusChip = (networkStatus) => {
        if (!networkStatus) return null;
        
        const statusConfig = {
            approved_by_network: { color: 'success', label: 'Approved' },
            declined_by_network: { color: 'error', label: 'Declined' },
            not_sent_to_network: { color: 'warning', label: 'Not Sent' },
            reversed_after_approval: { color: 'error', label: 'Reversed' },
        };

        const config = statusConfig[networkStatus] || { color: 'default', label: networkStatus };
        return <Chip label={config.label} color={config.color} size="small" />;
    };

    // Filter transactions based on selected filters
    const filteredTransactions = transactions.filter(transaction => {
        if (filterStatus !== 'all') {
            if (filterStatus === 'paid' && !transaction.paid) return false;
            if (filterStatus === 'failed' && transaction.paid) return false;
            if (filterStatus === 'disputed' && !transaction.disputed) return false;
        }
        
        if (filterRiskLevel !== 'all' && transaction.risk_level !== filterRiskLevel) {
            return false;
        }
        
        return true;
    });

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Typography color="error">{error}</Typography>
                <Button onClick={() => fetchDetailedTransactions()} sx={{ mt: 2 }}>
                    Retry
                </Button>
            </Paper>
        );
    }

    return (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                    Detailed Transaction View
                </Typography>
                <Button onClick={onClose} variant="outlined">
                    Close
                </Button>
            </Box>

            <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
                Date Range: {startDate} to {endDate} ({timezone})
            </Typography>


            {/* Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="paid">Paid</MenuItem>
                            <MenuItem value="failed">Failed</MenuItem>
                            <MenuItem value="disputed">Disputed</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Risk Level</InputLabel>
                        <Select
                            value={filterRiskLevel}
                            onChange={(e) => setFilterRiskLevel(e.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="normal">Normal</MenuItem>
                            <MenuItem value="elevated">Elevated</MenuItem>
                            <MenuItem value="highest">Highest</MenuItem>
                            <MenuItem value="unknown">Unknown</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            <Box sx={{ position: 'relative' }}>
                <TableContainer sx={{ 
                    maxWidth: '100%', 
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': {
                        height: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        backgroundColor: '#f1f1f1',
                        borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#c1c1c1',
                        borderRadius: '4px',
                        '&:hover': {
                            backgroundColor: '#a8a8a8',
                        },
                    },
                }}>
                    <Table sx={{ 
                        minWidth: 1200,
                        '& .MuiTableCell-root': {
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '200px',
                        }
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: '60px' }}>Expand</TableCell>
                                <TableCell sx={{ width: '100px' }}>Type</TableCell>
                                <TableCell sx={{ width: '200px' }}>ID</TableCell>
                                <TableCell sx={{ width: '100px' }} align="right">Amount</TableCell>
                                <TableCell sx={{ width: '120px' }}>Status</TableCell>
                                <TableCell sx={{ width: '120px' }}>Risk Level</TableCell>
                                <TableCell sx={{ width: '120px' }}>Network Status</TableCell>
                                <TableCell sx={{ width: '150px' }}>Created</TableCell>
                                <TableCell sx={{ width: '120px' }}>Customer IP</TableCell>
                                <TableCell sx={{ width: '200px' }}>Account</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredTransactions.map((transaction) => (
                                <React.Fragment key={transaction.id}>
                                    <TableRow hover>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() => toggleRowExpansion(transaction.id)}
                                            >
                                                {expandedRows.has(transaction.id) ? (
                                                    <ExpandLessIcon />
                                                ) : (
                                                    <ExpandMoreIcon />
                                                )}
                                            </IconButton>
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={transaction.transaction_type} 
                                                size="small" 
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={transaction.id} placement="top">
                                                <Typography 
                                                    variant="caption" 
                                                    fontFamily="monospace"
                                                    sx={{ 
                                                        wordBreak: 'break-all',
                                                        fontSize: '0.75rem',
                                                        lineHeight: 1.2,
                                                        cursor: 'help'
                                                    }}
                                                >
                                                    {transaction.id}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(transaction.amount)}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusChip(transaction.status, transaction.paid, transaction.disputed)}
                                        </TableCell>
                                        <TableCell>
                                            {getRiskLevelChip(transaction.risk_level)}
                                        </TableCell>
                                        <TableCell>
                                            {getNetworkStatusChip(transaction.network_status)}
                                        </TableCell>
                                        <TableCell>
                                            {transaction.created}
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={transaction.customer_ip || 'N/A'} placement="top">
                                                <Typography 
                                                    variant="caption" 
                                                    fontFamily="monospace"
                                                    sx={{ 
                                                        wordBreak: 'break-all',
                                                        fontSize: '0.75rem',
                                                        lineHeight: 1.2,
                                                        cursor: 'help'
                                                    }}
                                                >
                                                    {transaction.customer_ip || 'N/A'}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={transaction.account_id} placement="top">
                                                <Typography 
                                                    variant="caption" 
                                                    fontFamily="monospace"
                                                    sx={{ 
                                                        wordBreak: 'break-all',
                                                        fontSize: '0.75rem',
                                                        lineHeight: 1.2,
                                                        cursor: 'help'
                                                    }}
                                                >
                                                    {transaction.account_id}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                    
                                    {/* Expanded Row with Compliance Details */}
                                    <TableRow>
                                        <TableCell colSpan={10} sx={{ py: 0 }}>
                                            <Collapse in={expandedRows.has(transaction.id)} timeout="auto" unmountOnExit>
                                                <Box sx={{ margin: 1 }}>
                                                    <Grid container spacing={2}>
                                                        {/* Compliance Fields */}
                                                        <Grid item xs={12} md={6}>
                                                            <Card variant="outlined">
                                                                <CardContent>
                                                                    <Typography variant="h6" gutterBottom>
                                                                        <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                                        Compliance Details
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Failure Code:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.failure_code || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Failure Message:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.failure_message || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Outcome Type:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.outcome_type || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Outcome Reason:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.outcome_reason || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Seller Message:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.seller_message || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Customer IP Address:
                                                                            </Typography>
                                                                            <Typography variant="body2" fontFamily="monospace">
                                                                                {transaction.customer_ip || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Request IP:
                                                                            </Typography>
                                                                            <Typography variant="body2" fontFamily="monospace">
                                                                                {transaction.request_ip || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>

                                                        {/* Transaction Details */}
                                                        <Grid item xs={12} md={6}>
                                                            <Card variant="outlined">
                                                                <CardContent>
                                                                    <Typography variant="h6" gutterBottom>
                                                                        Transaction Details
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Customer ID:
                                                                            </Typography>
                                                                            <Typography variant="body2" fontFamily="monospace">
                                                                                {transaction.customer_id || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Payment Method:
                                                                            </Typography>
                                                                            <Typography variant="body2" fontFamily="monospace">
                                                                                {transaction.payment_method_id || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Receipt Email:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.receipt_email || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Authorization Code:
                                                                            </Typography>
                                                                            <Typography variant="body2" fontFamily="monospace">
                                                                                {transaction.authorization_code || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Description:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {transaction.description || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Pagination */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 2 }}>
                            Rows per page:
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 60 }}>
                            <Select
                                value={pagination.itemsPerPage}
                                onChange={handleItemsPerPageChange}
                                disabled={paginationLoading}
                            >
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={25}>25</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 2 }}>
                            {pagination.totalItems > 0 && (
                                <>
                                    {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}-
                                    {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                                    {pagination.totalItems}
                                </>
                            )}
                        </Typography>

                        <Tooltip title="First Page">
                            <IconButton
                                onClick={() => handlePageChange(1)}
                                disabled={pagination.currentPage === 1 || paginationLoading}
                            >
                                <FirstPageIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Previous Page">
                            <IconButton
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={!pagination.hasPrevPage || paginationLoading}
                            >
                                <KeyboardArrowLeftIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Next Page">
                            <IconButton
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={!pagination.hasNextPage || paginationLoading}
                            >
                                <KeyboardArrowRightIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Last Page">
                            <IconButton
                                onClick={() => handlePageChange(pagination.totalPages)}
                                disabled={pagination.currentPage === pagination.totalPages || paginationLoading}
                            >
                                <LastPageIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {paginationLoading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        }}
                    >
                        <CircularProgress />
                    </Box>
                )}
            </Box>
        </Paper>
    );
};

export default DetailedTransactionView;

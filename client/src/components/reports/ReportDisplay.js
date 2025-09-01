import React from 'react';
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
} from '@mui/material';
import {
    FirstPage as FirstPageIcon,
    KeyboardArrowLeft as KeyboardArrowLeftIcon,
    KeyboardArrowRight as KeyboardArrowRightIcon,
    LastPage as LastPageIcon,
} from '@mui/icons-material';
import { formatCurrency, formatDate } from '../../utils/formatters';

const ReportDisplay = ({
    report,
    currentPage,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    paginationLoading,
}) => {
    if (!report || !report.transactions) return null;

    const { transactions, pagination, dateRange, timezone } = report;

    return (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
                Detailed Report
            </Typography>

            <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
                Date Range: {dateRange?.start || 'N/A'} to {dateRange?.end || 'N/A'} (
                {timezone || 'N/A'})
            </Typography>

            <Box sx={{ position: 'relative' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Account ID</TableCell>
                                <TableCell align="right">Charges</TableCell>
                                <TableCell align="right">Charges Amount</TableCell>
                                <TableCell align="right">Refunds</TableCell>
                                <TableCell align="right">Refunds Amount</TableCell>
                                <TableCell align="right">Chargebacks</TableCell>
                                <TableCell align="right">Chargebacks Amount</TableCell>
                                <TableCell align="right">Declines</TableCell>
                                <TableCell align="right">Approval %</TableCell>
                                <TableCell align="right">Total Count</TableCell>
                                <TableCell align="right">Total Amount</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {transactions && transactions.length > 0 ? (
                                transactions.map((row, index) => (
                                    <TableRow key={index} hover>
                                        <TableCell>{formatDate(row.date)}</TableCell>
                                        <TableCell>
                                            <Typography variant="caption" fontFamily="monospace">
                                                {row.account_id || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.charges_count || 0}
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(row.charges_amount || 0)}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.refunds_count || 0}
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(row.refunds_amount || 0)}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.chargebacks_count || 0}
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(row.chargebacks_amount || 0)}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.declines_count || 0}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.aprvl_pct ? `${row.aprvl_pct.toFixed(2)}%` : 'N/A'}
                                        </TableCell>
                                        <TableCell align="right">{row.totals_count || 0}</TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(row.totals_amount || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={12} align="center">
                                        No transactions found for the selected date range
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Pagination Loading Overlay */}
                {paginationLoading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                        }}
                    >
                        <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress size={40} />
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                Loading...
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Pagination Controls */}
            {pagination && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2,
                        mt: 3,
                        pt: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                    }}
                >
                    {/* Pagination Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                            Showing {(pagination.currentPage - 1) * pagination.itemsPerPage + 1} to{' '}
                            {Math.min(
                                pagination.currentPage * pagination.itemsPerPage,
                                pagination.totalItems
                            )}{' '}
                            of {pagination.totalItems} entries
                        </Typography>
                        {paginationLoading && <CircularProgress size={14} />}
                    </Box>

                    {/* Items Per Page */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <InputLabel>Per Page</InputLabel>
                            <Select
                                value={pagination.itemsPerPage}
                                label="Per Page"
                                onChange={e => onItemsPerPageChange(e.target.value)}
                                disabled={paginationLoading}
                            >
                                <MenuItem value={5}>5</MenuItem>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={25}>25</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                            </Select>
                        </FormControl>
                        {paginationLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                    </Box>

                    {/* Pagination Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="First Page">
                            <IconButton
                                onClick={() => onPageChange(1)}
                                disabled={!pagination.hasPrevPage || paginationLoading}
                                size="small"
                            >
                                <FirstPageIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Previous Page">
                            <IconButton
                                onClick={() => onPageChange(pagination.currentPage - 1)}
                                disabled={!pagination.hasPrevPage || paginationLoading}
                                size="small"
                            >
                                <KeyboardArrowLeftIcon />
                            </IconButton>
                        </Tooltip>

                        <Typography variant="body2" sx={{ mx: 1 }}>
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </Typography>

                        <Tooltip title="Next Page">
                            <IconButton
                                onClick={() => onPageChange(pagination.currentPage + 1)}
                                disabled={!pagination.hasNextPage || paginationLoading}
                                size="small"
                            >
                                <KeyboardArrowRightIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Last Page">
                            <IconButton
                                onClick={() => onPageChange(pagination.totalPages)}
                                disabled={!pagination.hasNextPage || paginationLoading}
                                size="small"
                            >
                                <LastPageIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            )}
        </Paper>
    );
};

export default ReportDisplay;

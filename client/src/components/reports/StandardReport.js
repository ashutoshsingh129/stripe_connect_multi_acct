import React from 'react';
import { Paper, Grid, Typography, Box, Card, CardContent } from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

const StandardReport = ({ report, formData }) => {
    if (!report || !report.transactions) {
        return null;
    }

    if (report.transactions.length === 0) {
        return (
            <Box sx={{ mt: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
                    Standard Report
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    No transaction data available for the selected date range and accounts.
                </Typography>
            </Box>
        );
    }

    // Extract data for charts with safe fallbacks
    // Convert amounts from cents to dollars for chart display
    const chartData = report.transactions.map(item => ({
        date: item.date || 'Unknown Date',
        charges: (item.charges_amount || 0) / 100,
        refunds: (item.refunds_amount || 0) / 100,
        chargebacks: (item.chargebacks_amount || 0) / 100,
        declines: item.declines_count || 0,
        approvalRate: item.aprvl_pct || 0,
    }));

    // Calculate summary statistics with safe fallbacks
    const summary = {
        totalTransactions: report.transactions.reduce(
            (sum, item) => sum + (item.totals_count || 0),
            0
        ),
        totalAmount:
            report.transactions.reduce((sum, item) => sum + (item.totals_amount || 0), 0) / 100,
        totalCharges:
            report.transactions.reduce((sum, item) => sum + (item.charges_amount || 0), 0) / 100,
        totalRefunds:
            report.transactions.reduce((sum, item) => sum + (item.refunds_amount || 0), 0) / 100,
        totalChargebacks:
            report.transactions.reduce((sum, item) => sum + (item.chargebacks_amount || 0), 0) /
            100,
        avgApprovalRate:
            report.transactions.length > 0
                ? report.transactions.reduce((sum, item) => sum + (item.aprvl_pct || 0), 0) /
                  report.transactions.length
                : 0,
    };

    // Data for pie chart (transaction types)
    // Note: summary values are already converted to dollars
    // Filter out zero values to prevent overlapping in pie chart
    const pieData = [
        { name: 'Charges', value: summary.totalCharges, color: '#4caf50' },
        { name: 'Refunds', value: summary.totalRefunds, color: '#ff9800' },
        { name: 'Chargebacks', value: summary.totalChargebacks, color: '#f44336' },
    ].filter(item => item.value > 0); // Only show non-zero values

    // If all values are zero, show a message instead
    const hasTransactionData = pieData.length > 0;

    // Data for approval rate trend
    const approvalData = chartData.map(item => ({
        date: item.date,
        approvalRate: item.approvalRate,
    }));

    return (
        <Box sx={{ mt: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
                Standard Report
            </Typography>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Transactions (Sum)
                            </Typography>
                            <Typography variant="h4" component="div">
                                {summary.totalTransactions.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Sum of all transaction counts
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Amount
                            </Typography>
                            <Typography variant="h4" component="div">
                                {formatCurrency(summary.totalAmount * 100)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Charges
                            </Typography>
                            <Typography variant="h4" component="div">
                                {formatCurrency(summary.totalCharges * 100)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Avg Approval Rate
                            </Typography>
                            <Typography variant="h4" component="div">
                                {summary.avgApprovalRate.toFixed(1)}%
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Charts Section */}
            <Grid container spacing={3}>
                {/* Transaction Amounts Over Time */}
                <Grid item xs={12} lg={8}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Transaction Amounts Over Time
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip formatter={value => `$${value.toLocaleString()}`} />
                                <Legend />
                                <Bar dataKey="charges" fill="#4caf50" name="Charges" />
                                <Bar dataKey="refunds" fill="#ff9800" name="Refunds" />
                                <Bar dataKey="chargebacks" fill="#f44336" name="Chargebacks" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Transaction Type Distribution */}
                <Grid item xs={12} lg={4}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Transaction Type Distribution
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            {hasTransactionData ? (
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({
                                            name,
                                            percent,
                                            value,
                                            cx,
                                            cy,
                                            midAngle,
                                            innerRadius,
                                            outerRadius,
                                        }) => {
                                            // Calculate label position outside the slice for better visibility
                                            const RADIAN = Math.PI / 180;
                                            const radius = outerRadius + 20; // Position outside the slice
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                            // Show percentage and value for better readability
                                            if (percent < 0.05) {
                                                // For very small slices, show just the name and value
                                                return (
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        fill="#333"
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                        fontSize="12"
                                                    >
                                                        {`${name}\n$${value.toFixed(2)}`}
                                                    </text>
                                                );
                                            }
                                            // For single slices (100%), show compact format
                                            if (percent === 1) {
                                                return (
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        fill="#333"
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                        fontSize="12"
                                                    >
                                                        {`${name}\n100%`}
                                                    </text>
                                                );
                                            }
                                            // For other cases, show percentage with 1 decimal
                                            return (
                                                <text
                                                    x={x}
                                                    y={y}
                                                    fill="#333"
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    fontSize="12"
                                                >
                                                    {`${name}\n${(percent * 100).toFixed(1)}%`}
                                                </text>
                                            );
                                        }}
                                        outerRadius={90}
                                        innerRadius={25}
                                        fill="#8884d8"
                                        dataKey="value"
                                        minAngle={3} // Minimum angle to prevent tiny slices
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={value => `$${value.toLocaleString()}`}
                                        labelFormatter={name => `${name} (Amount)`}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value, entry) => (
                                            <span style={{ color: entry.color }}>
                                                {value}: ${entry.payload.value.toFixed(2)}
                                            </span>
                                        )}
                                    />
                                </PieChart>
                            ) : (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        flexDirection: 'column',
                                        gap: 2,
                                    }}
                                >
                                    <Typography variant="h6" color="textSecondary">
                                        No Transaction Data
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="textSecondary"
                                        align="center"
                                    >
                                        No transactions found for the selected period.
                                        <br />
                                        Try adjusting your date range or account selection.
                                    </Typography>
                                </Box>
                            )}
                        </ResponsiveContainer>

                        {/* Additional summary below chart for small values */}
                        {pieData.some(item => item.value === 0) && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="body2" color="textSecondary">
                                    <strong>Note:</strong> Some transaction types show 0% due to no
                                    activity in the selected period.
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* Approval Rate Trend */}
                <Grid item xs={12}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Approval Rate Trend
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={approvalData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip formatter={value => `${value}%`} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="approvalRate"
                                    stroke="#2196f3"
                                    strokeWidth={2}
                                    name="Approval Rate (%)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Additional Metrics */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Decline Analysis
                        </Typography>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="declines" fill="#9c27b0" name="Declines" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Summary Statistics
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Total Refunds:
                                    </Typography>
                                    <Typography variant="h6">
                                        {formatCurrency(summary.totalRefunds * 100)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Total Chargebacks:
                                    </Typography>
                                    <Typography variant="h6">
                                        {formatCurrency(summary.totalChargebacks * 100)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Date Range:
                                    </Typography>
                                    <Typography variant="body1">
                                        {formData.startDate} to {formData.endDate}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Timezone:
                                    </Typography>
                                    <Typography variant="body1">{formData.timezone}</Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default StandardReport;

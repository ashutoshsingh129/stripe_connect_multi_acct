import React, { useState, useEffect } from 'react';
import {
    Paper,
    Grid,
    TextField,
    FormControl,
    Select,
    MenuItem,
    Button,
    Box,
    Typography,
    FormControlLabel,
    Radio,
    RadioGroup,
    Chip,
    OutlinedInput,
    Checkbox,
    ListItemText,
    LinearProgress,
    Alert,
} from '@mui/material';
import { getDefaultDateRange } from '../../utils/dateUtils';

const ReportForm = ({
    formData,
    onFormChange,
    onGenerateReport,
    onViewDetails,
    onSigmaView,
    loading,
    detailedViewLoading,
    timezones,
    accounts = [],
}) => {
    const [selectedAccounts, setSelectedAccounts] = useState([]);

    // Initialize selected accounts when accounts are first loaded (but only if none are selected)
    useEffect(() => {
        console.log('ReportForm: accounts changed:', accounts);
        console.log('ReportForm: current selectedAccounts:', selectedAccounts);
        console.log('ReportForm: formData.connectedAccountId:', formData.connectedAccountId);

        if (accounts.length > 0 && selectedAccounts.length === 0 && formData.connectedAccountId) {
            // If we have a connectedAccountId in form data, parse it and set selected accounts
            const accountIds = formData.connectedAccountId.split(',').filter(id => id.trim());
            if (accountIds.length > 0) {
                setSelectedAccounts(accountIds);
            }
        }
    }, [accounts, formData.connectedAccountId, selectedAccounts.length]);

    const handleInputChange = (field, value) => {
        onFormChange(field, value);
    };

    const handlePeriodChange = period => {
        const { startDate, endDate } = getDefaultDateRange(period);
        onFormChange('period', period);
        onFormChange('startDate', startDate);
        onFormChange('endDate', endDate);
    };

    const handleAccountSelection = event => {
        const value = event.target.value;

        // Ensure we always have an array
        const newSelection = Array.isArray(value) ? value : [value];
        setSelectedAccounts(newSelection);

        // Update form data with comma-separated account IDs
        const accountIdsString = newSelection.join(',');

        onFormChange('connectedAccountId', accountIdsString);
    };

    const clearAccountSelection = () => {
        setSelectedAccounts([]);
        onFormChange('connectedAccountId', '');
    };

    // Helper function to calculate days difference between dates
    const getDaysDifference = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    };

    return (
        <Paper elevation={2} sx={{ p: 4, mb: 3, bgcolor: 'background.paper' }}>
            <Typography variant="h6" gutterBottom>
                Report Configuration
            </Typography>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Select the Stripe Connect accounts you want to include in your report. Large date
                ranges may take several minutes to process.
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>💡 Pro Tip:</strong> You can export data directly without generating a
                    report first, or generate a report to preview the data. For large datasets (2+
                    months), exports use extended timeouts (5 minutes) to ensure complete
                    processing.
                </Typography>
            </Alert>

            <Grid container spacing={3}>
                {/* Stripe Account Selection */}
                <Grid item xs={12}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControl fullWidth>
                            <Select
                                multiple
                                value={selectedAccounts}
                                onChange={handleAccountSelection}
                                input={<OutlinedInput />}
                                renderValue={selected => {
                                    if (selected.length === 0) {
                                        return (
                                            <Typography color="textSecondary">
                                                Select accounts...
                                            </Typography>
                                        );
                                    }
                                    return (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map(value => {
                                                const account = accounts.find(
                                                    acc => acc.id === value
                                                );
                                                const displayName =
                                                    account?.email || account?.id || value;
                                                return (
                                                    <Chip
                                                        key={value}
                                                        label={displayName}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                );
                                            })}
                                        </Box>
                                    );
                                }}
                                displayEmpty
                            >
                                {accounts.map(account => {
                                    // Create a display name for the account
                                    const displayName = account.email || account.id;
                                    const businessInfo = `${account.business_type} - ${account.country}`;

                                    return (
                                        <MenuItem key={account.id} value={account.id}>
                                            <Checkbox
                                                checked={selectedAccounts.indexOf(account.id) > -1}
                                            />
                                            <ListItemText
                                                primary={displayName}
                                                secondary={businessInfo}
                                            />
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                        {selectedAccounts.length > 0 && (
                            <Button
                                variant="outlined"
                                color="secondary"
                                onClick={clearAccountSelection}
                                sx={{ minWidth: 'auto', px: 2 }}
                            >
                                Clear
                            </Button>
                        )}
                        <Typography variant="caption" color="textSecondary">
                            Select the Stripe Connect accounts you want to include in your report
                        </Typography>
                    </Box>
                </Grid>

                {/* Period Selection and Timezone in one row */}
                <Grid item xs={12} md={6}>
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                        }}
                    >
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
                            Report Period
                        </Typography>
                        <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <RadioGroup
                                row
                                value={formData.period}
                                onChange={e => handlePeriodChange(e.target.value)}
                                sx={{
                                    justifyContent: 'space-between',
                                    '& .MuiFormControlLabel-root': {
                                        flex: 1,
                                        justifyContent: 'center',
                                        mx: 0.5,
                                    },
                                }}
                            >
                                <FormControlLabel value="daily" control={<Radio />} label="Daily" />
                                <FormControlLabel
                                    value="weekly"
                                    control={<Radio />}
                                    label="Weekly"
                                />
                                <FormControlLabel
                                    value="monthly"
                                    control={<Radio />}
                                    label="Monthly"
                                />
                                <FormControlLabel
                                    value="custom"
                                    control={<Radio />}
                                    label="Custom"
                                />
                            </RadioGroup>
                        </FormControl>
                    </Box>
                </Grid>

                {/* Timezone */}
                <Grid item xs={12} md={6}>
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                        }}
                    >
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
                            Timezone
                        </Typography>
                        <FormControl fullWidth>
                            <Select
                                value={formData.timezone}
                                onChange={e => handleInputChange('timezone', e.target.value)}
                                displayEmpty
                                sx={{ mt: 0 }}
                            >
                                {timezones.map(tz => (
                                    <MenuItem key={tz} value={tz}>
                                        {tz}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Grid>

                {/* Date Fields */}
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Start Date"
                        type="date"
                        value={formData.startDate}
                        onChange={e => handleInputChange('startDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={formData.period !== 'custom'}
                        required
                    />
                </Grid>

                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="End Date"
                        type="date"
                        value={formData.endDate}
                        onChange={e => handleInputChange('endDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={formData.period !== 'custom'}
                        required
                    />
                </Grid>

                {/* Warning for large date ranges */}
                {formData.period === 'custom' && formData.startDate && formData.endDate && (
                    <Grid item xs={12}>
                        {(() => {
                            const daysDiff = getDaysDifference(
                                formData.startDate,
                                formData.endDate
                            );

                            if (daysDiff > 60) {
                                return (
                                    <Alert severity="warning" sx={{ mt: 1 }}>
                                        <Typography variant="body2">
                                            <strong>⚠️ Large Date Range Detected</strong>
                                            <br />
                                            You've selected {daysDiff} days of data. This may take
                                            3-8 minutes to process and could timeout if the dataset
                                            is very large.
                                            <strong>Recommendation:</strong> For datasets over 60
                                            days, consider using the export options (CSV/Excel)
                                            directly, which are optimized for large datasets and
                                            have a 5-minute timeout.
                                        </Typography>
                                    </Alert>
                                );
                            } else if (daysDiff > 30) {
                                return (
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                        <Typography variant="body2">
                                            <strong>ℹ️ Medium Date Range</strong>
                                            <br />
                                            You've selected {daysDiff} days of data. This should
                                            process within 1-3 minutes.
                                        </Typography>
                                    </Alert>
                                );
                            }
                            return null;
                        })()}
                    </Grid>
                )}

                {/* Action Buttons */}
                <Grid item xs={12}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        {/* Progress indicator for large reports */}
                        {loading && (
                            <Box sx={{ width: '100%', mb: 2 }}>
                                <Alert severity="info" sx={{ mb: 1 }}>
                                    <Typography variant="body2">
                                        <strong>📊 Generating Report...</strong>
                                        <br />
                                        Large date ranges (like 2+ months) may take several minutes
                                        to process. Please wait while we fetch and aggregate your
                                        Stripe data.
                                    </Typography>
                                </Alert>
                                <LinearProgress />
                                <Typography
                                    variant="caption"
                                    color="info.main"
                                    sx={{ mt: 1, display: 'block' }}
                                >
                                    ⏱️ This operation has a 10-minute timeout. Please don't close
                                    this page.
                                </Typography>
                            </Box>
                        )}

                        <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={onGenerateReport}
                                disabled={
                                    loading ||
                                    selectedAccounts.length === 0 ||
                                    !formData.startDate ||
                                    !formData.endDate ||
                                    !formData.timezone ||
                                    !formData.secretKey ||
                                    !formData.publicKey
                                }
                                sx={{ minWidth: 200, py: 1.5 }}
                            >
                                {loading ? 'Generating...' : 'Generate Report'}
                            </Button>
                            
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={onViewDetails}
                                disabled={
                                    loading ||
                                    detailedViewLoading ||
                                    selectedAccounts.length === 0 ||
                                    !formData.startDate ||
                                    !formData.endDate ||
                                    !formData.timezone ||
                                    !formData.secretKey ||
                                    !formData.publicKey
                                }
                                sx={{ minWidth: 200, py: 1.5 }}
                            >
                                {detailedViewLoading ? 'Loading Details...' : 'View Details'}
                            </Button>
                            
                            <Button
                                variant="contained"
                                color="secondary"
                                size="large"
                                onClick={onSigmaView}
                                disabled={
                                    loading ||
                                    selectedAccounts.length === 0 ||
                                    !formData.secretKey ||
                                    !formData.publicKey
                                }
                                sx={{ minWidth: 200, py: 1.5 }}
                            >
                                📊 Sigma Queries
                            </Button>
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ReportForm;

import React from 'react';
import { Paper, Box, Button, Typography, Grid, LinearProgress, Alert } from '@mui/material';
import {
    Download as DownloadIcon,
    Email as EmailIcon,
    TableChart as TableChartIcon,
    PictureAsPdf as PdfIcon,
} from '@mui/icons-material';

const ExportButtons = ({
    onExportCSV,
    onExportXLS,
    onExportPDF,
    onEmailExport,
    onExportGoogleSheets,
    loading,
    hasReport,
    hasCredentials,
}) => {
    return (
        <Paper elevation={2.5} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
                Export Options
            </Typography>

            {/* Show different messaging based on whether report exists */}
            {!hasReport ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        <strong>💡 Direct Export:</strong> You can export data directly without
                        generating a report first, or generate a report to see the data before
                        exporting.
                    </Typography>
                </Alert>
            ) : (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Export your report data in various formats.
                </Typography>
            )}

            {/* Export Progress Indicator */}
            {loading && (
                <Box sx={{ mb: 2 }}>
                    <Alert severity="info" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                            <strong>📊 Processing Export...</strong>
                            <br />
                            Large datasets may take several minutes to process. Please wait while we
                            prepare your data.
                        </Typography>
                    </Alert>
                    <LinearProgress />
                </Box>
            )}

            <Grid container spacing={2.4}>
                <Grid item xs={12} md={2.4}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={onExportCSV}
                        disabled={loading || !hasCredentials}
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Processing...' : ' CSV'}
                    </Button>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={onExportXLS}
                        disabled={loading || !hasCredentials}
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Processing...' : ' Excel'}
                    </Button>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<PdfIcon />}
                        onClick={onExportPDF}
                        disabled={loading || !hasCredentials}
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Processing...' : ' PDF'}
                    </Button>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<EmailIcon />}
                        onClick={onEmailExport}
                        disabled={loading || !hasCredentials}
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Processing...' : ' Export'}
                    </Button>
                </Grid>

                <Grid item xs={12} md={2.4} display="flex" justifyContent="center">
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<TableChartIcon />}
                        onClick={onExportGoogleSheets}
                        disabled={loading || !hasCredentials}
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Processing...' : ' Google Sheets'}
                    </Button>
                </Grid>
            </Grid>

            <Box mt={2.5}>
                <Typography variant="caption" color="textSecondary">
                    Choose your preferred export format. CSV, Excel, and PDF files will be
                    downloaded directly, while email exports will be sent to your specified email
                    address.
                </Typography>

                {loading && (
                    <Typography
                        variant="caption"
                        color="info.main"
                        sx={{ display: 'block', mt: 1 }}
                    >
                        ⏱️ Large datasets may take 2-5 minutes to process. Please don't close this
                        page.
                    </Typography>
                )}

                {!hasCredentials && (
                    <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ display: 'block', mt: 1 }}
                    >
                        ⚠️ Please enter your Stripe credentials above to enable export functionality
                    </Typography>
                )}
            </Box>
        </Paper>
    );
};

export default ExportButtons;

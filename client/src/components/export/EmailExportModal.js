import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Box,
    Alert,
} from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';

const EmailExportModal = ({ open, onClose, onExport, loading, reportInfo }) => {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');

    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        setEmailError('');
    };

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = () => {
        if (!email.trim()) {
            setEmailError('Email address is required');
            return;
        }

        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        onExport(email);
    };

    const handleClose = () => {
        setEmail('');
        setEmailError('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box display="flex" alignItems="center" gap={1}>
                    <EmailIcon color="primary" />
                    Email Export
                </Box>
            </DialogTitle>
            
            <DialogContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                    Enter your email address to receive the Stripe Connect report.
                </Typography>

                {reportInfo && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            <strong>Report Summary:</strong><br />
                            • Date Range: {reportInfo.startDate} to {reportInfo.endDate}<br />
                            • Timezone: {reportInfo.timezone}<br />
                            • Accounts: {reportInfo.accountCount || 'Multiple'}
                        </Typography>
                    </Alert>
                )}

                <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    error={!!emailError}
                    helperText={emailError || 'We\'ll send the report to this email address'}
                    placeholder="your.email@example.com"
                    disabled={loading}
                    sx={{ mt: 1 }}
                />

                <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                    The report will be generated and sent to your email address. 
                    Please allow a few minutes for processing and delivery.
                </Typography>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    startIcon={<EmailIcon />}
                    disabled={loading || !email.trim()}
                >
                    {loading ? 'Sending...' : 'Send Report'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EmailExportModal;

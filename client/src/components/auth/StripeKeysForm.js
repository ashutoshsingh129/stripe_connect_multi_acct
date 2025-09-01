import React, { useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Box,
    Alert,
    CircularProgress,
} from '@mui/material';
import { encryptSecretKey, encryptPublicKey } from '../../utils/encryption';
import { API_ENDPOINTS } from '../../services/api';
import api from '../../services/api';

const StripeKeysForm = ({ onKeysValidated }) => {
    const [formData, setFormData] = useState({
        publicKey: '',
        secretKey: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(''); // Clear error when user types
    };

    const handleSubmit = async e => {
        e.preventDefault();

        // Basic required field validation
        if (!formData.publicKey || !formData.secretKey) {
            setError('Both public key and secret key are required');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Encrypt keys before sending
            const encryptedData = {
                publicKey: encryptPublicKey(formData.publicKey),
                secretKey: encryptSecretKey(formData.secretKey),
            };

            // Call backend to validate keys and import accounts
            const response = await api.post(API_ENDPOINTS.VALIDATE_KEYS, encryptedData);
            const result = response.data;

            if (result.success) {
                // Store keys in localStorage
                localStorage.setItem('stripePublicKey', formData.publicKey);
                localStorage.setItem('stripeSecretKey', formData.secretKey);

                // Call the callback to proceed to login
                onKeysValidated(formData.publicKey, formData.secretKey);
            } else {
                setError(result.error || 'Failed to validate Stripe keys');
            }
        } catch (err) {
            console.error('Error validating keys:', err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="sm">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
                    <Typography component="h1" variant="h4" align="center" gutterBottom>
                        Stripe Connect Setup
                    </Typography>
                    <Typography variant="body2" align="center" color="textSecondary" sx={{ mb: 3 }}>
                        Enter your Stripe Connect API keys to get started
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Public Key"
                            value={formData.publicKey}
                            onChange={e => handleInputChange('publicKey', e.target.value)}
                            placeholder="pk_test_51..."
                            helperText="Your Stripe public key"
                            type="password"
                            autoComplete="off"
                        />

                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Secret Key"
                            value={formData.secretKey}
                            onChange={e => handleInputChange('secretKey', e.target.value)}
                            placeholder="sk_test_51..."
                            helperText="Your Stripe secret key"
                            type="password"
                            autoComplete="off"
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={loading || !formData.publicKey || !formData.secretKey}
                        >
                            {loading ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                'Validate & Continue'
                            )}
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default StripeKeysForm;

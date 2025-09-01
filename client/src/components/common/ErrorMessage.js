import React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';

const ErrorMessage = ({ error, onClose }) => {
    if (!error) return null;

    return (
        <Box mb={2}>
            <Alert
                severity="error"
                onClose={onClose}
                sx={{
                    '& .MuiAlert-message': {
                        whiteSpace: 'pre-wrap',
                    },
                }}
            >
                <AlertTitle>Error</AlertTitle>
                {error}
            </Alert>
        </Box>
    );
};

export default ErrorMessage;

import React from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

const LoadingSpinner = ({ message = 'Loading...', size = 40 }) => {
    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            p={3}
        >
            <CircularProgress size={size} />
            {message && (
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                    {message}
                </Typography>
            )}
        </Box>
    );
};

export default LoadingSpinner;

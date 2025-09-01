import React from 'react';
import { ToggleButton, ToggleButtonGroup, Typography, Box } from '@mui/material';
import { BarChart, TableChart } from '@mui/icons-material';

const ReportToggle = ({ reportType, onReportTypeChange, disabled }) => {
    return (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" color="textSecondary">
                Report Type:
            </Typography>
            <ToggleButtonGroup
                value={reportType}
                exclusive
                onChange={onReportTypeChange}
                disabled={disabled}
                size="small"
            >
                <ToggleButton value="standard" aria-label="Standard Report">
                    <BarChart sx={{ mr: 1 }} />
                    Standard Report
                </ToggleButton>
                <ToggleButton value="detailed" aria-label="Detailed Report">
                    <TableChart sx={{ mr: 1 }} />
                    Detailed Report
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
};

export default ReportToggle;

import { format } from 'date-fns';

export const getDefaultDateRange = (period = 'custom') => {
    const now = new Date();

    switch (period) {
        case 'daily':
            return {
                startDate: format(new Date(now.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                endDate: format(now, 'yyyy-MM-dd'),
            };
        case 'weekly':
            return {
                startDate: format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                endDate: format(now, 'yyyy-MM-dd'),
            };
        case 'monthly':
            return {
                startDate: format(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                endDate: format(now, 'yyyy-MM-dd'),
            };
        default:
            return {
                startDate: format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                endDate: format(now, 'yyyy-MM-dd'),
            };
    }
};
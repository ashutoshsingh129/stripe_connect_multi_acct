import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export const useTimezones = () => {
    const [timezones, setTimezones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTimezones = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiService.getTimezones();
            setTimezones(response.timezones);
        } catch (error) {
            console.error('Failed to fetch timezones:', error);
            setError('Failed to fetch timezones');

            // Fallback to USA timezones if API fails
            const fallbackTimezones = [
                'UTC',
                'America/New_York',
                'America/Chicago',
                'America/Denver',
                'America/Los_Angeles',
                'America/Phoenix',
                'America/Anchorage',
                'Pacific/Honolulu',
            ];
            setTimezones(fallbackTimezones);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimezones();
    }, []);

    return {
        timezones,
        loading,
        error,
        refetch: fetchTimezones,
    };
};

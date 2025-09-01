export const formatCurrency = (amount, currency = 'USD') => {
    if (amount === null || amount === undefined) return '$0.00';

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount / 100); // Stripe amounts are in cents
};

export const formatDate = dateString => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch (error) {
        return dateString;
    }
};
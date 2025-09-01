// Simple encryption utility for Stripe API keys
// Frontend only encrypts - backend handles decryption
// Using a reliable character shift that preserves all characters

const ENCRYPTION_KEY = 'stripe-connect-2025'; // This should be stored securely in production

// Simple character shift - preserves all characters including special ones
function simpleEncrypt(text, key) {
    if (!text) return '';

    let result = '';
    for (let i = 0; i < text.length; i++) {
        const keyChar = key.charAt(i % key.length);
        const shift = keyChar.charCodeAt(0) % 10; // Use modulo 10 for smaller shifts

        // Shift all characters by the key value
        const charCode = text.charCodeAt(i);
        const shiftedCode = charCode + shift;
        result += String.fromCharCode(shiftedCode);
    }
    return btoa(result); // Base64 encode
}

// Encrypt secret key before sending
export const encryptSecretKey = secretKey => {
    if (!secretKey) return '';
    return simpleEncrypt(secretKey, ENCRYPTION_KEY);
};

// Encrypt public key
export const encryptPublicKey = publicKey => {
    if (!publicKey) return '';
    return simpleEncrypt(publicKey, ENCRYPTION_KEY);
};

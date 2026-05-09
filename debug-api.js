// Add this to browser console to diagnose the issue
console.log('=== EVANTRAHUB LOGIN DEBUG ===');
console.log('Current hostname:', location.hostname);
console.log('Current origin:', location.origin);
console.log('Is HTTPS:', location.protocol === 'https:');

// Show what the API_BASE is being set to
const isProd = location.hostname === "evantrahub.me" || 
    location.hostname.endsWith("onrender.com") || 
    location.protocol === "https:";
const API_BASE = isProd ? location.origin : "http://localhost:3000";
console.log('isProd flag:', isProd);
console.log('API_BASE being used:', API_BASE);

// Test the login endpoint
console.log('Full login URL that will be requested:', API_BASE + '/api/login');

// Show CORS headers
console.log('Request will include credentials:', true);

// Try a simple OPTIONS request to see if CORS is configured
fetch(API_BASE + '/api/login', { 
  method: 'OPTIONS',
  headers: { 'Accept': 'application/json' }
})
.then(res => {
  console.log('OPTIONS response status:', res.status);
  console.log('OPTIONS response headers:', {
    'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
    'access-control-allow-methods': res.headers.get('access-control-allow-methods'),
  });
})
.catch(err => console.error('OPTIONS request failed:', err));

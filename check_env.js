require('dotenv').config({ path: '.env.sandbox' });
console.log('HAS?', !!process.env.MP_ACCESS_TOKEN, (process.env.MP_ACCESS_TOKEN || '').slice(0, 18));

import dotenv from 'dotenv';
dotenv.config({ path: '.env.sandbox' });

const tok = process.env.MP_ACCESS_TOKEN || '';
console.log('HAS?', Boolean(tok), tok.slice(0, 18));

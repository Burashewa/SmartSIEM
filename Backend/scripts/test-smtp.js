/** Run: node scripts/test-smtp.js — verifies Gmail/SMTP credentials from .env */
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function loadEnv() {
  let config = {};
  for (const rel of ['.env', path.join('..', '.env')]) {
    const file = path.resolve(__dirname, '..', rel);
    if (fs.existsSync(file)) {
      config = Object.assign(dotenv.parse(fs.readFileSync(file)), config);
    }
  }
  return config;
}

function normalize(value) {
  if (!value) return '';
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim();
  }
  return next;
}

const env = loadEnv();
const transport = nodemailer.createTransport({
  host: normalize(env.SMTP_HOST),
  port: Number(normalize(env.SMTP_PORT) || 465),
  secure: normalize(env.SMTP_SECURE).toLowerCase() === 'true',
  auth: { user: normalize(env.SMTP_USER), pass: normalize(env.SMTP_PASS) },
});

transport
  .verify()
  .then(() => console.log('SMTP verify OK'))
  .catch((err) => {
    console.error('SMTP verify FAIL:', err.message);
    process.exit(1);
  });

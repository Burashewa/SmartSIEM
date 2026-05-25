/** Run: node scripts/test-smtp-send.js [to@email.com] */
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
const port = Number(normalize(env.SMTP_PORT) || 465);
const secure = normalize(env.SMTP_SECURE).toLowerCase() === 'true';
const to = process.argv[2] || normalize(env.SMTP_USER);

const host = normalize(env.SMTP_HOST);
const timeout = Number(normalize(env.SMTP_TIMEOUT_MS) || 60_000);
const auth = { user: normalize(env.SMTP_USER), pass: normalize(env.SMTP_PASS) };
const timeouts = {
  connectionTimeout: timeout,
  greetingTimeout: timeout,
  socketTimeout: timeout,
  dnsTimeout: timeout,
  family: 4,
};

const transport =
  host === 'smtp.gmail.com' || host === 'gmail'
    ? nodemailer.createTransport({ service: 'gmail', auth, ...timeouts })
    : nodemailer.createTransport({
        host,
        port,
        secure,
        auth,
        ...timeouts,
        ...(port === 587 && !secure ? { requireTLS: true } : {}),
      });

const from = normalize(env.SMTP_FROM) || normalize(env.SMTP_USER);

transport
  .sendMail({
    from,
    to,
    subject: 'SmartSIEM SMTP send test',
    text: 'If you receive this, SMTP send works.',
  })
  .then((info) => {
    console.log('Send OK:', info.messageId);
  })
  .catch((err) => {
    console.error('Send FAIL:', err.message);
    process.exit(1);
  });

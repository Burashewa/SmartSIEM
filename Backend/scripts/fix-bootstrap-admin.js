/** One-off: sync admin password/unlock in Mongo. Run: node scripts/fix-bootstrap-admin.js */
const { randomBytes, scryptSync } = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

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

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

const env = loadEnv();
const uri = normalize(env.Mongo_URI || env.MONGODB_URI);
const dbName = normalize(env.DB_NAME) || 'SIEM';
const username = (normalize(env.BOOTSTRAP_ADMIN_USERNAME) || 'admin').toLowerCase();
const password = normalize(env.BOOTSTRAP_ADMIN_PASSWORD) || 'Admin@pass1';

async function fixDb(client, name) {
  const db = client.db(name);
  const col = db.collection('authusers');
  const result = await col.findOneAndUpdate(
    { username },
    {
      $set: {
        role: 'admin',
        isActive: true,
        authProvider: 'local',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword(password),
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`[${name}] admin ready:`, result?.username ?? username, result?.role);
}

mongoose.connect(uri).then(async () => {
  const client = mongoose.connection.client;
  await fixDb(client, dbName);
  if (dbName !== 'test') await fixDb(client, 'test');
  await mongoose.disconnect();
  console.log('Done. Login with', username, '/', password);
});

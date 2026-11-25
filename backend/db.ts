import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('database');
fs.mkdirSync(dir, { recursive: true });
export const db = new Database(path.join(dir, 'bankshield.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, account_number TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), balance REAL NOT NULL, original_balance REAL NOT NULL, account_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), transaction_type TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, transaction_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Completed');
CREATE TABLE IF NOT EXISTS attack_logs (id INTEGER PRIMARY KEY, attack_type TEXT NOT NULL, security_mode TEXT NOT NULL, outcome TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS phishing_campaigns (id INTEGER PRIMARY KEY, recipient_email TEXT NOT NULL, campaign_status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS phishing_events (id INTEGER PRIMARY KEY, campaign_id INTEGER NOT NULL REFERENCES phishing_campaigns(id), event_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);

const user = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@bankshield.local') as {id:number}|undefined;
if (!user) {
  const result = db.prepare('INSERT INTO users (name,email,account_number,password_hash) VALUES (?,?,?,?)').run('Alex Morgan','demo@bankshield.local','•••• 4829',bcrypt.hashSync('BankShield!2026', 10));
  const account = db.prepare('INSERT INTO accounts (user_id,balance,original_balance,account_type) VALUES (?,?,?,?)').run(result.lastInsertRowid, 24850.75, 24850.75, 'Everyday Checking');
  const rows = [
    ['credit','Northstar Studios · Salary',3850.00,'2026-11-21'],['debit','Rent · Parkview Residences',-1420.00,'2026-11-19'],['debit','Whole Foods Market',-86.42,'2026-11-18'],['debit','Metro Transit',-24.50,'2026-11-16'],['credit','Freelance payment · Acme',620.00,'2026-11-14'],['debit','Blue Bottle Coffee',-12.80,'2026-11-12'],['debit','Electricity · City Power',-78.16,'2026-11-10'],['debit','Online purchase · Field Notes',-34.99,'2026-11-08']];
  const add = db.prepare('INSERT INTO transactions (account_id,transaction_type,description,amount,transaction_date) VALUES (?,?,?,?,?)');
  for (const row of rows) add.run(account.lastInsertRowid, ...row);
}

export function account() { return db.prepare('SELECT a.id,a.balance,a.original_balance,a.account_type,u.name,u.email,u.account_number FROM accounts a JOIN users u ON u.id=a.user_id WHERE u.email=?').get('demo@bankshield.local') as any; }

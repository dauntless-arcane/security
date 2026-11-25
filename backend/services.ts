import nodemailer from 'nodemailer';
import { db, account } from './db.js';

export function logEvent(io: any, attackType: string, mode: string, outcome: string, description: string) {
  const info = db.prepare('INSERT INTO attack_logs (attack_type,security_mode,outcome,description) VALUES (?,?,?,?)').run(attackType, mode, outcome, description);
  const row = db.prepare('SELECT * FROM attack_logs WHERE id=?').get(info.lastInsertRowid);
  io.emit('security:event', row);
  return row;
}

export async function sendAwarenessEmail(io: any, recipient: string, campaignId: number) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, BASE_URL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) throw new Error('SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM to .env.');
  const transport = nodemailer.createTransport({host:SMTP_HOST,port:Number(SMTP_PORT||587),secure:SMTP_SECURE==='true',auth:{user:SMTP_USER,pass:SMTP_PASS}});
  await transport.sendMail({from:SMTP_FROM,to:recipient,subject:'BankShield Security Awareness Simulation',text:`This is an authorized BankShield security awareness exercise. No real banking credentials are requested or collected. Visit the simulation: ${BASE_URL}/awareness?campaign=${campaignId}`,html:`<h2>BankShield Security Awareness</h2><p>This is an authorized security awareness exercise.</p><p>No real banking credentials are requested or collected.</p><p><a href="${BASE_URL}/awareness?campaign=${campaignId}">Open the training simulation</a></p>`});
}

export function currentBalance() { return account().balance as number; }

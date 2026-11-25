import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { db, account } from './db.js';
import { logEvent, sendAwarenessEmail } from './services.js';

const app=express(), server=createServer(app), io=new Server(server,{cors:{origin:true,credentials:true}});
const port=Number(process.env.PORT||4000), recipient=(process.env.PHISHING_RECIPIENT||'tharun.jeevakanth@btech.christuniversity.in').toLowerCase();
app.set('trust proxy',1);
app.use(cors({origin:true,credentials:true})); app.use(express.json({limit:'20kb'}));
app.use(session({secret:process.env.SESSION_SECRET||'local-only-change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*4}}));
let mode:'secure'|'insecure'='secure';
const loginSchema=z.object({email:z.string().email().max(200),password:z.string().min(1).max(120)});
const auth=(req:any,res:any,next:any)=>req.session.userId?next():res.status(401).json({error:'Sign in to continue.'});
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.get('/api/mode',(_req,res)=>res.json({mode}));
app.post('/api/mode',(req,res)=>{const parsed=z.object({mode:z.enum(['secure','insecure'])}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid mode'});mode=parsed.data.mode;io.emit('security:mode',{mode});res.json({mode});});
app.post('/api/auth/login',async(req:any,res)=>{const parsed=loginSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a valid email and password.'});const row=db.prepare('SELECT id,password_hash FROM users WHERE email=?').get(parsed.data.email) as any;if(!row||!await bcrypt.compare(parsed.data.password,row.password_hash))return res.status(401).json({error:'Email or password is incorrect.'});req.session.userId=row.id;res.json({user:{name:account().name,email:account().email}});});
app.post('/api/auth/logout',(req:any,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/auth/me',(req:any,res)=>{if(!req.session.userId)return res.status(401).json({error:'Sign in required'});const a=account();res.json({user:{name:a.name,email:a.email}});});
app.get('/api/dashboard',auth,(_req,res)=>{const a=account();const transactions=db.prepare('SELECT id,transaction_type AS type,description,amount,transaction_date AS date,status FROM transactions WHERE account_id=? ORDER BY transaction_date DESC').all(a.id);res.json({account:a,transactions});});
app.post('/api/attacks/sql',auth,(req,res)=>{logEvent(io,'sql_injection',mode,'initiated','Predefined demo payload submitted');const a=account();const payload="' OR 1=1 --";if(mode==='insecure'){
    // Deliberately unsafe concatenation is confined to the demo account and a single fixed balance update scenario.
    const row=db.prepare(`SELECT id FROM users WHERE email = '${payload}'`).get() as any;
    if(row){db.prepare('UPDATE accounts SET balance=balance+1000 WHERE user_id=?').run(a.id);const event=logEvent(io,'sql_injection',mode,'successful','Unsafe query path altered the seeded demo account by $1,000');return res.json({outcome:'successful',balance:account().balance,event});}
  } else {
    // Secure mode binds the same untrusted payload as a literal value.
    db.prepare('SELECT id FROM users WHERE email = ?').get(payload);
  }
  const event=logEvent(io,'sql_injection',mode,'blocked','Parameterized handling preserved the account balance');res.json({outcome:'blocked',balance:account().balance,event});});
app.post('/api/attacks/reset',auth,(_req,res)=>{db.prepare('UPDATE accounts SET balance=original_balance').run();db.prepare('DELETE FROM attack_logs').run();db.prepare('DELETE FROM phishing_events').run();db.prepare('DELETE FROM phishing_campaigns').run();io.emit('security:reset',{});res.json({ok:true,balance:account().balance});});
app.get('/api/attacks/history',auth,(_req,res)=>res.json(db.prepare('SELECT * FROM attack_logs ORDER BY id DESC LIMIT 100').all()));
app.post('/api/phishing/launch',auth,async(req,res)=>{const parsed=z.object({recipient:z.string().email()}).safeParse(req.body);if(!parsed.success||parsed.data.recipient.toLowerCase()!==recipient)return res.status(400).json({error:'Recipient must match the configured training recipient.'});const result=db.prepare('INSERT INTO phishing_campaigns(recipient_email,campaign_status) VALUES(?,?)').run(recipient,'preparing');const id=Number(result.lastInsertRowid);const base=(process.env.BASE_URL||'http://localhost:5173').replace(/\/$/,'');const link=`${base}/awareness?campaign=${id}`;const composeUrl=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent('BankShield security awareness simulation')}&body=${encodeURIComponent(`This is an authorized BankShield security awareness exercise. No real banking credentials are requested or collected.\n\nOpen the training simulation: ${link}`)}`;if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS||!process.env.SMTP_FROM){db.prepare('UPDATE phishing_campaigns SET campaign_status=? WHERE id=?').run('prepared',id);const event=logEvent(io,'phishing','awareness','prepared',`Gmail compose prepared for ${recipient} · campaign ${id}; user must press Send`);return res.json({ok:true,campaignId:id,composeUrl,manualSend:true,event});}try{await sendAwarenessEmail(io,recipient,id);db.prepare('UPDATE phishing_campaigns SET campaign_status=? WHERE id=?').run('sent',id);const event=logEvent(io,'phishing','awareness','sent',`Awareness email delivered to configured recipient · campaign ${id}`);res.json({ok:true,campaignId:id,event});}catch{db.prepare('UPDATE phishing_campaigns SET campaign_status=? WHERE id=?').run('prepared',id);const event=logEvent(io,'phishing','awareness','prepared',`SMTP delivery unavailable; Gmail compose prepared for ${recipient} · campaign ${id}`);res.json({ok:true,campaignId:id,composeUrl,manualSend:true,smtpFallback:true,event});}});
app.get('/api/awareness/validate',(req,res)=>{const id=Number(req.query.campaign);const row=db.prepare('SELECT id,campaign_status FROM phishing_campaigns WHERE id=? AND recipient_email=?').get(id,recipient) as any;if(!row||!['sent','prepared'].includes(row.campaign_status))return res.status(404).json({error:'This training link is unavailable.'});db.prepare('INSERT INTO phishing_events(campaign_id,event_type) VALUES(?,?)').run(id,'landing_opened');logEvent(io,'phishing','awareness','opened',`Simulation page opened · campaign ${id}`);res.json({campaignId:id});});
app.post('/api/awareness/submit',(req,res)=>{const parsed=z.object({campaignId:z.number().int().positive(),trainingToken:z.literal('DEMO_CREDENTIAL_ACCEPTED')}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Only the seeded demo credential can be used in this simulation.'});const row=db.prepare("SELECT id FROM phishing_campaigns WHERE id=? AND recipient_email=? AND campaign_status IN ('sent','prepared')").get(parsed.data.campaignId,recipient);if(!row)return res.status(404).json({error:'Campaign not found.'});db.prepare('INSERT INTO phishing_events(campaign_id,event_type) VALUES(?,?)').run(parsed.data.campaignId,'mock_submission');const event=logEvent(io,'phishing','awareness','submission','Seeded demo credential simulation submitted; raw field content was never received');res.json({ok:true,event});});
app.get('/api/attacks/stats',auth,(_req,res)=>res.json(db.prepare(`SELECT COUNT(*) total, SUM(outcome='successful') successful, SUM(outcome='blocked') blocked, (SELECT COUNT(*) FROM phishing_campaigns WHERE campaign_status='sent') emailsSent, (SELECT COUNT(*) FROM phishing_events WHERE event_type='mock_submission') submissions FROM attack_logs`).get()));
server.listen(port,()=>console.log(`BankShield API listening on http://localhost:${port}`));

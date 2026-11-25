# BankShield

BankShield is a local, synthetic banking application for demonstrating the difference between secure and deliberately unsafe handling of one predefined SQL injection scenario. It includes a live event console and an explicitly labeled email awareness exercise.

## Architecture

- `src/`: React + TypeScript screens, Lucide icons, and responsive CSS with Tailwind CSS available through the Vite plugin.
- `backend/index.ts`: Express API, session login, backend security mode, request validation, and Socket.IO server.
- `backend/db.ts`: SQLite schema and first-run seeding.
- `backend/services.ts`: event logging and SMTP delivery.
- `database/bankshield.sqlite`: created automatically on first launch; ignored by git.

## Requirements and startup

Install Node.js 20 or newer. From the project directory:

```sh
copy .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. The API listens on port 4000. For a production-like static frontend build, run `npm run build`; serve the built `dist/` files with a static web server and run `npm start` for the API. Configure your reverse proxy to direct `/api` and `/socket.io` to port 4000.

## Demo login

- Email: `demo@bankshield.local`
- Password: `BankShield!2026`

The database seeds a fictional account holder, synthetic account number, $24,850.75 opening balance, and eight transactions on first startup.

## Environment configuration

Copy `.env.example` to `.env`. Set a long random `SESSION_SECRET`. SMTP delivery is optional for banking and SQL demonstrations. If SMTP is not configured or delivery fails, the console opens a prefilled Gmail compose window addressed to the configured recipient; review it and press **Send** in Gmail. The app cannot detect whether you sent the manually composed email. If you prefer automatic SMTP delivery, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for an account you control. No SMTP password is included in the frontend. `BASE_URL` must be the browser-reachable app URL; for a public classroom demo, use the HTTPS tunnel's public URL. The configured recipient defaults to the address in the project brief and can be changed with `PHISHING_RECIPIENT`.

The mail is deliberately transparent: its subject and body identify a security awareness simulation. The separate `/awareness` page uses BankShield styling and accepts only the seeded demo password `BankShield!2026`. The browser checks that fixed value locally, then sends a constant event marker; arbitrary typed text is never sent to the backend. A dialog displays only the known demo password as the simulated capture. The campaign link is usable only for a campaign associated with the configured recipient.

## Presentation guide

1. Sign in and show the balance and seeded transaction history.
2. In Security console, switch to Insecure mode and execute the SQL demo. The fixed payload changes only the seeded account balance by $1,000. The live log records the outcome.
3. Switch to Secure mode and repeat. The parameterized query treats the same input as literal text and leaves the balance unchanged.
4. Use **Reset database** to restore the opening balance and clear attack/campaign event history.
5. Click **Send notice** to open a prefilled Gmail composer when SMTP is unavailable, then press **Send**. Open its link and enter the seeded demo password `BankShield!2026`. The page shows the simulated capture alert and the console receives the event. Use a reachable `BASE_URL` if opening the link from a different device.

## Security boundaries and limitations

- Insecure mode is intentionally unsafe for teaching and should remain isolated. Its only unsafe SQL path uses a fixed demonstration payload and only modifies the seeded demo account balance. No arbitrary SQL runner or shell execution exists.
- The demo session store is Express's in-memory store. It is suitable for a local presentation, not multi-instance or production deployment. Use a persistent session store, HTTPS, and a same-origin reverse proxy for longer hosted exercises.
- CORS is permissive to make local Vite development straightforward; restrict it to the app origin when hosting.
- SMTP delivery requires valid operator-provided configuration and network access. No email is sent on startup.
- The awareness login accepts only the known seeded demo password. Other field values are not sent to the server or displayed in the capture alert.
- The interface uses synthetic data only. No real bank integrations or customer credentials are used.

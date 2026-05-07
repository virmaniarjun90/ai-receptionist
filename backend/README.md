# AI Receptionist — Backend

NestJS backend for an AI-powered WhatsApp receptionist for short-term rental hosts.

## Quick links (when running locally)

| What | URL |
|---|---|
| **Admin UI** | http://localhost:5174 |
| **API health** | http://localhost:3000/health |
| **Swagger / API docs** | http://localhost:3000/api |
| **Guest registration form** | http://localhost:3000/guest/register?p=00000000-0000-0000-0000-000000000101 |

---

## Guest Onboarding — three modes

Guests need a **Reservation** in the database before the AI can greet them by name. There are three ways to get reservations in:

---

### Mode 1 — Manual registration form (pilot default)

The host shares a link with each incoming guest. The guest fills in their name, WhatsApp number, and check-in/out dates. The system creates the reservation and sends a WhatsApp welcome message automatically.

**How to get the link:**
```
http://<YOUR_APP_URL>/guest/register?p=<PROPERTY_ID>
```

Find your property ID in the Admin UI under Properties, or from the API:
```bash
curl http://localhost:3000/admin/properties -H "x-admin-key: <ADMIN_API_KEY>"
# copy the "id" field
```

**What the form does:**
1. Guest submits name + WhatsApp number + dates
2. System creates a `Reservation` record
3. System creates a `GuestToken` (a one-time-use link, expires at checkout)
4. System sends the guest a WhatsApp welcome message with their welcome kit link
5. From that point the AI receptionist is active for that guest on WhatsApp

**Required env var:**
```env
APP_URL="https://your-backend-url.com"   # used to build the welcome kit link in the WhatsApp message
```

---

### Mode 2 — Manual admin entry

The host (or you) creates the reservation directly — no form involved. Two ways to do it:

**Via Admin UI:**
Admin UI → Properties → select property → Reservations tab → (coming soon: Add Reservation button)

**Via API:**
```bash
curl -X POST http://localhost:3000/admin/properties/<PROPERTY_ID>/reservations \
  -H "Content-Type: application/json" \
  -H "x-admin-key: <ADMIN_API_KEY>" \
  -d '{
    "guestName": "Arjun Virmani",
    "guestPhone": "whatsapp:+918802078873",
    "checkIn": "2026-05-07T15:00:00Z",
    "checkOut": "2026-05-12T11:00:00Z",
    "guestCount": 1
  }'
```

Once the reservation exists, the AI automatically greets the guest by name when they first message the property WhatsApp. No welcome message is sent proactively in this mode — the guest has to initiate.

**No extra env vars required.**

---

### Mode 3 — Channel manager sync (Airbnb / future integrations)

Reservations are pulled automatically from your channel manager (Airbnb, Booking.com, etc.) on an hourly cron. No manual input needed once configured.

**Switch to Airbnb:**
```env
CHANNEL_MANAGER_PROVIDER="airbnb"

# Option A — access token (simplest, works if you already have partner access)
AIRBNB_ACCESS_TOKEN="your-airbnb-access-token"

# Option B — OAuth client credentials (for server-to-server apps)
AIRBNB_CLIENT_ID="your-airbnb-client-id"
AIRBNB_CLIENT_SECRET="your-airbnb-client-secret"

# Optional: change sync frequency (default: hourly)
SYNC_CRON="0 * * * *"
```

**Important:** Airbnb Partner API access requires approval from Airbnb before you can use it in production. Apply at https://www.airbnb.com/partner. Until approved, keep `CHANNEL_MANAGER_PROVIDER=mock`.

**Trigger sync manually:**
```bash
# Sync all properties
curl -X POST http://localhost:3000/admin/sync -H "x-admin-key: <ADMIN_API_KEY>"

# Sync one property
curl -X POST http://localhost:3000/admin/properties/<ID>/sync -H "x-admin-key: <ADMIN_API_KEY>"
```

**Adding a new channel manager** (Booking.com, Hostaway, Guesty, etc.):
1. Create `backend/src/modules/channel-manager/providers/<name>.provider.ts`
2. Implement the `ChannelManagerProvider` interface (two methods: `getListingDetails`, `getReservations`)
3. Register it in `channel-manager.module.ts`
4. Add the provider name to `ChannelManagerProviderName` in `app.config.ts`

---

## LLM Provider

The AI brain behind the receptionist. Switch via `LLM_PROVIDER` env var.

| Provider | Env var value | Required keys |
|----------|--------------|---------------|
| Mock (demo, no API key) | `mock` | none |
| Claude (Anthropic) | `claude` | `ANTHROPIC_API_KEY` |
| GPT-4o (OpenAI) | `openai` | `OPENAI_API_KEY` |
| Kimi (Moonshot) | `kimi` | `KIMI_API_KEY` |

The mock provider reads from the property's knowledge base and supports the full handoff flow — useful for demos and development without API costs.

If a provider is selected but its API key is missing, the system automatically falls back to mock and logs a warning.

**Switch to Claude for production:**
```env
LLM_PROVIDER="claude"
ANTHROPIC_API_KEY="sk-ant-..."
CLAUDE_MODEL="claude-sonnet-4-6"   # optional — this is the default
```

---

## WhatsApp / Twilio setup

```env
TWILIO_ACCOUNT_SID="ACxxx"
TWILIO_AUTH_TOKEN="xxx"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"   # your Twilio sandbox or production number
HOST_WHATSAPP_NUMBER="whatsapp:+91XXXXXXXXXX"    # host's personal WhatsApp (receives handoff alerts)
TWILIO_VALIDATE_WEBHOOK="false"                  # set true in production
```

**Twilio webhook URL** (set this in your Twilio console for the WhatsApp number):
```
https://your-backend-url.com/webhook/whatsapp
```
Method: `POST`

For local dev use [ngrok](https://ngrok.com) to expose port 3000:
```bash
ngrok http 3000
# paste the https URL + /webhook/whatsapp into Twilio console
```

---

## Host takeover (WhatsApp-native, no app required)

When the AI can't answer, it:
1. Sends the guest a warm message: *"Let me connect you with the host."*
2. Sends the host a WhatsApp alert with the guest's question
3. Host replies `JOIN` → directly relays with guest through the property number
4. Host replies `DONE` → AI takes back over

| Host command | Effect |
|---|---|
| `join` / `yes` | Accept takeover, connect with guest |
| `skip` / `no` | Decline, AI retries with fallback |
| `done` / `back` / `/ai` | Hand conversation back to AI |

The host works entirely from their own WhatsApp. No app, no login.

---

## Quick start

```bash
# 1. Start dependencies
docker run -d -p 5432:5432 -e POSTGRES_DB=ai_receptionist -e POSTGRES_PASSWORD=postgres postgres:15
docker run -d -p 6379:6379 redis:7

# 2. Configure
cd backend
npm install
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and TWILIO_* vars

# 3. Database
npx prisma migrate deploy
npx prisma generate
npx ts-node -r tsconfig-paths/register prisma/seed.ts

# 4. Run
npm run start:dev
```

---

## Environment variables — full reference

```env
# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_receptionist"

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_HOST="localhost"
REDIS_PORT="6379"

# ─── LLM — pick one: mock | claude | openai | kimi ───────────────────────────
LLM_PROVIDER="mock"
ANTHROPIC_API_KEY=""        # required when LLM_PROVIDER=claude
CLAUDE_MODEL="claude-sonnet-4-6"
OPENAI_API_KEY=""           # required when LLM_PROVIDER=openai
OPENAI_MODEL="gpt-4o-mini"
KIMI_API_KEY=""             # required when LLM_PROVIDER=kimi
KIMI_MODEL="moonshot-v1-8k"

# ─── Twilio ───────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
HOST_WHATSAPP_NUMBER="whatsapp:+91XXXXXXXXXX"   # host's personal number
TWILIO_VALIDATE_WEBHOOK="false"                 # set true in production

# ─── Guest onboarding ─────────────────────────────────────────────────────────
# APP_URL is used to build the welcome kit link sent to guests via WhatsApp
APP_URL="http://localhost:3000"

# ─── Channel manager — pick one: mock | airbnb ───────────────────────────────
CHANNEL_MANAGER_PROVIDER="mock"
AIRBNB_ACCESS_TOKEN=""      # use this OR client credentials below
AIRBNB_CLIENT_ID=""
AIRBNB_CLIENT_SECRET=""
SYNC_CRON="0 * * * *"       # how often to auto-sync (default: every hour)

# ─── Admin API ────────────────────────────────────────────────────────────────
# Leave empty = open access in local dev. Set a strong secret in production.
ADMIN_API_KEY=""

# ─── Misc ─────────────────────────────────────────────────────────────────────
PORT="3000"
PII_MASKING_ENABLED="true"  # never sends guest phone/email to the LLM
```

---

## Module overview

| Module | What it does |
|---|---|
| `WebhookModule` | Receives inbound Twilio webhooks, validates signature |
| `QueueModule` | BullMQ producer + worker — processes all messages async |
| `AiModule` | LLM abstraction (Claude / OpenAI / Kimi / Mock) + prompt builder |
| `CommunicationModule` | Outbound WhatsApp sends via Twilio |
| `ChannelManagerModule` | Airbnb / Mock sync + hourly cron |
| `GuestModule` | Registration form, welcome kit page, guest token management |
| `ReservationModule` | Reservation CRUD, active-stay lookup by phone |
| `PropertyModule` | Multi-property CRUD, phone-based routing |
| `KnowledgeModule` | Per-property FAQ key-value store |
| `ConversationModule` | Message history, status management |
| `AdminModule` | Protected REST API for all admin operations |
| `CommonModule` | PrismaService, AppConfig, health check (global) |

---

## Admin API — key endpoints

Requires `x-admin-key: <ADMIN_API_KEY>` header (when key is set).

Full interactive docs: http://localhost:3000/api

```
# Properties
GET    /admin/properties
POST   /admin/properties
PATCH  /admin/properties/:id
DELETE /admin/properties/:id
POST   /admin/properties/:id/sync        trigger channel manager sync

# Knowledge base
GET    /admin/properties/:id/knowledge
POST   /admin/properties/:id/knowledge   { key, value }
DELETE /admin/properties/:id/knowledge/:key

# Reservations
GET    /admin/properties/:id/reservations
POST   /admin/properties/:id/reservations
PATCH  /admin/reservations/:id
POST   /admin/reservations/:id/cancel

# Conversations
GET    /admin/conversations
GET    /admin/conversations/:id
POST   /admin/conversations/:id/takeover   admin-triggered host mode
POST   /admin/conversations/:id/handback   return to AI

# GDPR
DELETE /admin/guests/:phone              anonymise all data for a phone number

# Sync
POST   /admin/sync                       sync all properties

# Health
GET    /health
```

---

## Production checklist

- [ ] `TWILIO_VALIDATE_WEBHOOK=true`
- [ ] `ADMIN_API_KEY` set to a strong random string
- [ ] `LLM_PROVIDER=claude` (or openai) with real API key
- [ ] `APP_URL` set to your deployed backend URL
- [ ] `HOST_WHATSAPP_NUMBER` set to the host's real number
- [ ] `CHANNEL_MANAGER_PROVIDER=airbnb` once partner access is approved
- [ ] Use managed Redis (Upstash / Redis Cloud / AWS ElastiCache)
- [ ] Run `npx prisma migrate deploy` on each deploy (not `migrate dev`)

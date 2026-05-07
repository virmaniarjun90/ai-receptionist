# AI Receptionist — Backend

NestJS backend for an AI-powered WhatsApp receptionist for Airbnb hosts and short-term rental properties.

## Running locally — quick links

Once the stack is running (see [Quick start](#quick-start) below), open these in your browser:

| What | URL |
|---|---|
| **Admin UI** | http://localhost:5173 |
| **API health** | http://localhost:3000/health |
| **Swagger / API docs** | http://localhost:3000/api |

---

## Demo — try it in 30 seconds

> Assumes the stack is already running (`npm run dev` from workspace root).

**1. Send a simulated guest WhatsApp message:**
```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"Body":"What is the wifi password?","From":"whatsapp:+911234567890","To":"whatsapp:+14155238886"}'
# → {"status":"queued"}
```

**2. See the AI reply in the Admin UI:**
Open http://localhost:5173 → click **Conversations** in the sidebar → select the conversation from `+911234567890`.

The seeded guest has an active reservation, so the AI greets them by name.

**3. Browse properties and knowledge:**
Click **Properties** → select *Development Hotel* → **FAQs** tab to see/edit the knowledge the AI uses.

**4. Hit the API directly (Swagger):**
Open http://localhost:3000/api — all `/admin/*` endpoints are listed with request/response schemas.

---

## How it works

```
Guest (WhatsApp)
  → Twilio webhook  POST /webhook/whatsapp
  → BullMQ job queue (Redis)
  → QueueProcessor worker
      ├── Routes to correct Property by incoming WhatsApp number
      ├── Looks up active Reservation for the guest's phone
      ├── Loads Property knowledge (FAQs)
      ├── Builds personalised system prompt (guest name, check-in/out, amenities…)
      └── Calls LLM → saves reply → sends via Twilio
```

The webhook returns immediately; all AI and Twilio work is async.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | NestJS + TypeScript |
| Database | PostgreSQL via Prisma |
| Queue | BullMQ + Redis |
| LLM | OpenAI / Claude (Anthropic) / Kimi (Moonshot) / Mock |
| Messaging | Twilio WhatsApp |
| Channel manager | Airbnb API (or Mock for dev) |
| Admin UI | React + Vite (in `../admin/`) |

---

## Quick start

```bash
# 1. Start dependencies
docker run -d -p 5432:5432 -e POSTGRES_DB=ai_receptionist -e POSTGRES_PASSWORD=postgres postgres:15
docker run -d -p 6379:6379 redis:7

# 2. Install and configure
cd backend
npm install
cp .env.example .env        # fill in your keys
# For local dev: set TWILIO_VALIDATE_WEBHOOK=false in .env so curl commands work without a real Twilio signature

# 3. Database
npx prisma migrate deploy
npx prisma generate
npx ts-node prisma/seed.ts  # creates default property + knowledge + sample reservation

# 4. Run (from workspace root — starts backend + admin UI together)
cd ..
npm install
npm run dev
```

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/api |
| Admin UI | http://localhost:5173 |

---

## Environment variables

```env
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_receptionist?schema=public"
REDIS_HOST="localhost"
REDIS_PORT="6379"

# LLM — pick one: mock | openai | claude | kimi
LLM_PROVIDER="mock"
OPENAI_API_KEY=""           # required when LLM_PROVIDER=openai
ANTHROPIC_API_KEY=""        # required when LLM_PROVIDER=claude
KIMI_API_KEY=""             # required when LLM_PROVIDER=kimi

# Twilio
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
TWILIO_VALIDATE_WEBHOOK="false"   # set true in production

# Channel manager — mock | airbnb
CHANNEL_MANAGER_PROVIDER="mock"
AIRBNB_ACCESS_TOKEN=""      # quickest option for Airbnb
AIRBNB_CLIENT_ID=""         # alternative: client credentials OAuth
AIRBNB_CLIENT_SECRET=""
SYNC_CRON="0 * * * *"       # how often to auto-sync (default: hourly)

# Admin UI
ADMIN_API_KEY=""             # leave empty = open in dev; set to protect /admin/* in prod
CORS_ORIGIN="http://localhost:5173"
```

---

## Modules

| Module | Responsibility |
|---|---|
| `WebhookModule` | Inbound Twilio webhook + signature validation |
| `QueueModule` | BullMQ job producer + worker processor |
| `AiModule` | LLM abstraction: OpenAI, Claude, Kimi, Mock |
| `CommunicationModule` | Outbound Twilio WhatsApp send |
| `ChannelManagerModule` | Sync from Airbnb / Mock + hourly cron |
| `ReservationModule` | Guest reservation CRUD + phone lookup |
| `PropertyModule` | Multi-property CRUD + phone-based routing |
| `KnowledgeModule` | Per-property FAQ key-value store |
| `ConversationModule` | Message history persistence |
| `AdminModule` | Protected admin REST API (`/admin/*`) |
| `CommonModule` | PrismaService, AppConfig, health check (global) |

---

## Multi-property routing

Each property has a `phoneNumber` column (e.g. `whatsapp:+14155238886`). When a guest messages, the `To` field from Twilio is matched to a property. If no match is found, the system falls back to the default property seeded by `prisma/seed.ts`.

To add a second property: create it via `POST /admin/properties` with its own `phoneNumber`, then configure a second Twilio number pointing at the same webhook.

---

## Swappable providers

Everything external is behind an interface:

| What | Interface | How to switch |
|---|---|---|
| LLM | `LlmProvider` | `LLM_PROVIDER=openai\|claude\|kimi\|mock` |
| Messaging | `MessagingProvider` | Wire new class in `CommunicationModule` |
| Channel manager | `ChannelManagerProvider` | `CHANNEL_MANAGER_PROVIDER=mock\|airbnb` |

Adding a new LLM: implement `LlmProvider`, register in `AiModule`, add a case to `LlmFactory`.

---

## Channel manager sync

`POST /admin/properties/:id/sync` — manual trigger for one property.
`POST /admin/sync` — trigger all properties.
Automatic: cron runs every hour (configurable via `SYNC_CRON`).

The `AirbnbProvider` requires either `AIRBNB_ACCESS_TOKEN` (simplest) or `AIRBNB_CLIENT_ID` + `AIRBNB_CLIENT_SECRET`. Airbnb Partner API access must be approved at https://www.airbnb.com/partner before using it.

---

## Admin API

All endpoints under `/admin/*`. Protected by `X-Admin-Key` header when `ADMIN_API_KEY` is set (open in dev if unset).

Full interactive docs at `http://localhost:3000/api`.

Key endpoints:

```
GET    /admin/properties
POST   /admin/properties
PATCH  /admin/properties/:id
DELETE /admin/properties/:id
POST   /admin/properties/:id/sync

GET    /admin/properties/:id/knowledge
POST   /admin/properties/:id/knowledge       { key, value }
DELETE /admin/properties/:id/knowledge/:key

GET    /admin/properties/:id/reservations
POST   /admin/properties/:id/reservations
PATCH  /admin/reservations/:id
POST   /admin/reservations/:id/cancel

GET    /admin/conversations
GET    /admin/conversations/:id
POST   /admin/sync                           triggers full sync for all properties

GET    /health
```

---

## Production checklist

- [ ] Set `TWILIO_VALIDATE_WEBHOOK=true`
- [ ] Set `ADMIN_API_KEY` to a strong secret
- [ ] Set `CORS_ORIGIN` to your deployed admin UI domain
- [ ] Use managed Redis (Upstash, Redis Cloud, AWS ElastiCache)
- [ ] Run `npx prisma migrate deploy` as part of deployment (not `migrate dev`)
- [ ] Set `LLM_PROVIDER` to your chosen production provider and add the API key
- [ ] Set `CHANNEL_MANAGER_PROVIDER=airbnb` once Airbnb Partner access is approved

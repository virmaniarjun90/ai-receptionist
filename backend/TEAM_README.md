# AI Receptionist — Team Guide

Quick reference for engineers working on this backend.

---

## Request flow (every WhatsApp message)

```
POST /webhook/whatsapp
  WebhookController
    validates Twilio signature (prod) → QueueService.addMessageJob()

BullMQ worker: QueueProcessor.process()
  PropertyService.getPropertyByPhone(To)       → find which property
  ConversationService.getOrCreate(from, propId) → conversation record
  ConversationService.addMessage(…, 'user')     → persist inbound
  ReservationService.getActiveByPhone(from)     → guest lookup
  KnowledgeService.getKnowledgeByProperty()     → FAQs
  ConversationService.getRecentMessages(10)     → history window
  AiService.generateReply(msgs, prop, know, res) → LLM call
  ConversationService.addMessage(…, 'assistant') → persist reply
  CommunicationService.sendWhatsAppMessage()    → Twilio send
```

Jobs retry 3× with exponential backoff. Failures land in BullMQ's failed set (Redis).

---

## Adding a new LLM provider

1. Create `src/modules/ai/llm/myprovider.provider.ts` implementing `LlmProvider`.
2. Add it to the providers array in `AiModule`.
3. Inject it into `LlmFactory` and add a `case` in `resolveProvider()`.
4. Add a new value to `LlmProviderName` in `app.config.ts`.
5. Add the API key env var to `.env.example` and `validateConfig()`.

---

## Adding a new messaging channel (e.g. SMS, email)

1. Create a provider implementing `MessagingProvider`.
2. Wire it in `CommunicationModule` behind `MESSAGING_PROVIDER` (or a new token).
3. Add a new `Channel` value to the Prisma schema.
4. Add an inbound webhook controller in `WebhookModule`.

---

## Adding a new channel manager

1. Create `src/modules/channel-manager/providers/myprovider.provider.ts` implementing `ChannelManagerProvider`.
2. Add it to `ChannelManagerModule` providers and the factory `useFactory`.
3. Add a new value to `ChannelManagerProviderName` in `app.config.ts`.

---

## Config

`src/config/app.config.ts` is the single source of truth. `buildAppConfig()` reads env vars once at startup. `validateConfig()` throws immediately if required keys are missing. The `APP_CONFIG` token is provided globally by `CommonModule`.

To add a new config value: add the field to `AppConfig`, read it in `buildAppConfig()`, add validation in `validateConfig()` if required.

---

## Database

Prisma schema: `prisma/schema.prisma`

Key models:
- `Tenant` → `Property` (1:N) — multi-tenant foundation
- `Property` → `Conversation` (1:N) — routed by `phoneNumber`
- `Conversation` → `Message` (1:N) — full history
- `Property` → `Knowledge` (1:N) — per-property FAQ facts
- `Property` → `Reservation` (1:N) — synced from channel manager

`Property.phoneNumber` is unique. It's the routing key for inbound messages.
`Reservation.guestPhone` is matched at message-time to personalise AI replies.

Migrations:
```bash
npx prisma migrate dev --name your_change  # dev only
npx prisma migrate deploy                   # production
```

---

## Channel manager sync

`SyncService.syncProperty(id)` pulls from the active `ChannelManagerProvider`, updates the `Property` row, upserts `Knowledge` entries, and upserts `Reservations`.

`SyncScheduler.syncAllProperties()` runs this for every property with a non-null `externalId`. It runs automatically on the `SYNC_CRON` schedule (default: hourly) and can be triggered manually via `POST /admin/sync`.

---

## PII masking

`PiiService.sanitizeMessages()` runs before every LLM call. It masks phone numbers, emails, names, and booking IDs. Controlled by `PII_MASKING_ENABLED` env var. Never bypass this for production LLM calls.

---

## Admin API security

`AdminGuard` checks the `X-Admin-Key` header. If `ADMIN_API_KEY` is empty, the guard passes (dev mode). Always set `ADMIN_API_KEY` in production.

---

## Local dev shortcuts

```bash
# Start everything (backend + admin UI)
npm run dev                     # from workspace root

# Backend only
cd backend && npm run start:dev

# Admin UI only
cd admin && npm run dev

# Seed the database
cd backend && npx ts-node prisma/seed.ts
```

Once running, open:
- Admin UI → http://localhost:5173
- Swagger → http://localhost:3000/api
- Health → http://localhost:3000/health

```bash
# Test the webhook locally (no Twilio needed)
# Requires TWILIO_VALIDATE_WEBHOOK=false in .env
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"Body":"What is the wifi password?","From":"whatsapp:+911234567890","To":"whatsapp:+14155238886"}'
# Then open http://localhost:5173 → Conversations to see the AI reply

# Trigger a sync manually
curl -X POST http://localhost:3000/admin/properties/<id>/sync
```

The seeded guest (`whatsapp:+911234567890`) has an active reservation, so the AI will greet them by name.

---

## Environment quick reference

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `mock` | `mock\|openai\|claude\|kimi` |
| `CHANNEL_MANAGER_PROVIDER` | `mock` | `mock\|airbnb` |
| `TWILIO_VALIDATE_WEBHOOK` | `true` | Set `false` for local dev/curl testing |
| `ADMIN_API_KEY` | (empty) | Empty = open in dev |
| `SYNC_CRON` | `0 * * * *` | Cron for auto-sync |
| `CORS_ORIGIN` | `http://localhost:5173` | Admin UI origin |

Full list in `backend/.env.example`.

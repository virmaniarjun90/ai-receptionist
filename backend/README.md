# AI Receptionist Backend

Production-ready NestJS backend for a focused WhatsApp -> queue -> AI -> reply flow. The system receives inbound WhatsApp messages from Twilio, enqueues them with BullMQ, generates a hotel receptionist response with OpenAI in a background worker, stores conversation history in PostgreSQL through Prisma, and sends the reply back through Twilio.

## Features

- Modular monolith structure using NestJS modules
- Twilio WhatsApp webhook at `POST /webhook/whatsapp`
- Async message processing with BullMQ and Redis
- OpenAI-backed receptionist replies
- Conversation-scoped PostgreSQL persistence with Prisma
- Small, explicit services with clear dependency injection
- Environment-driven configuration with `dotenv`
- Health endpoint at `GET /health`

## Tech Stack

- Node.js
- NestJS
- TypeScript
- Prisma
- PostgreSQL
- BullMQ
- Redis
- OpenAI SDK
- Axios
- dotenv

## Project Structure

```text
backend/
  prisma/
    schema.prisma
  src/
    app.module.ts
    main.ts
    modules/
      ai/
        llm/
          llm.interface.ts
          openai.provider.ts
        ai.controller.ts
        ai.module.ts
        ai.service.ts
        pii.service.ts
        prompt.service.ts
      common/
        common.controller.ts
        common.module.ts
        common.service.ts
        feature-flags.service.ts
        prisma.service.ts
      communication/
        providers/
          messaging.interface.ts
          twilio.provider.ts
        communication.controller.ts
        communication.module.ts
        communication.service.ts
      conversation/
        conversation.controller.ts
        conversation.module.ts
        conversation.service.ts
      queue/
        queue.module.ts
        queue.processor.ts
        queue.service.ts
  .env
  .env.example
  package.json
  tsconfig.json
```

## Environment Variables

Create `backend/.env` and fill in:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_receptionist?schema=public"
OPENAI_API_KEY="sk-your-openai-key"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
REDIS_HOST="localhost"
REDIS_PORT="6379"
LLM_PROVIDER="mock"
PII_MASKING_ENABLED="true"
FEATURE_QUEUE_ENABLED="true"
FEATURE_AI_ENABLED="true"
```

`TWILIO_WHATSAPP_NUMBER` must include the `whatsapp:` prefix because Twilio expects WhatsApp addresses in that format.

## Setup

Start PostgreSQL and Redis first. A simple local Redis option is:

```bash
docker run --name ai-receptionist-redis -p 6379:6379 redis:7
```

Then install and run the backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name add_conversation
npm run dev:all
```

The app runs on `http://localhost:3000` by default. Set `PORT=4000` or another value if needed.

`npm run dev:all` checks Redis and PostgreSQL first, logs any local dependency warnings, and then starts NestJS in watch mode.

## Database

The Prisma schema defines a `Conversation` model and a `Message` model. A conversation groups all messages for one WhatsApp user.

`Conversation`:

- `id`: UUID primary key
- `userPhone`: WhatsApp sender address
- `createdAt`: creation timestamp
- `messages`: related message history

`Message`:

- `id`: UUID primary key
- `conversationId`: parent conversation ID
- `from`: sender phone/address
- `to`: recipient phone/address
- `content`: message body
- `role`: `user` or `assistant`
- `createdAt`: creation timestamp

Run migrations after setting `DATABASE_URL`:

```bash
npm run prisma:migrate -- --name add_conversation
```

## Queue Flow

BullMQ uses Redis and the queue name `message-processing`. The webhook creates a `process-message` job with:

```json
{
  "userPhone": "whatsapp:+15551234567",
  "message": "Hello, I need a room"
}
```

Async flow:

```text
Twilio WhatsApp
  -> POST /webhook/whatsapp
  -> QueueService adds process-message job
  -> QueueProcessor stores user message
  -> QueueProcessor fetches last 10 conversation messages
  -> AiService generates reply
  -> QueueProcessor stores assistant reply
  -> CommunicationService sends Twilio WhatsApp reply
```

Jobs retry up to 3 times with exponential backoff. The controller returns immediately after enqueueing, so slow AI or Twilio calls do not hold the webhook open.

## Provider Boundaries

External services are wrapped behind internal interfaces:

- AI providers implement `LlmProvider`.
- Messaging providers implement `MessagingProvider`.

Current implementations use OpenAI, mock LLM responses, and Twilio. Future providers such as Claude, Kimi, or a direct WhatsApp API can be swapped behind those interfaces without changing queue or controller flow.

## Running Without OpenAI

Use the mock LLM provider when you want full local testing without OpenAI credits:

```env
LLM_PROVIDER="mock"
PII_MASKING_ENABLED="true"
```

Then start the server:

```bash
npm run start:dev
```

The system will process messages through the queue and return predictable mock replies. If `LLM_PROVIDER="openai"` but `OPENAI_API_KEY` is missing, the backend logs a warning and falls back to the mock provider.

## Feature Flags

Feature flags are environment-based:

```env
FEATURE_QUEUE_ENABLED="true"
FEATURE_AI_ENABLED="true"
```

Disabling queue processing returns a clear `QUEUE_ERROR`. Disabling AI avoids LLM calls and sends a fallback receptionist message.

## Local Webhook With ngrok

Start the backend:

```bash
npm run start:dev
```

Expose it:

```bash
ngrok http 3000
```

In the Twilio Console, configure your WhatsApp sandbox or sender webhook:

```text
POST https://your-ngrok-domain.ngrok-free.app/webhook/whatsapp
```

## Test Flow

1. Start the backend:

```bash
cd backend
npm run start:dev
```

2. Start ngrok:

```bash
ngrok http 3000
```

3. Configure the Twilio webhook:

```text
https://<ngrok-url>/webhook/whatsapp
```

4. Send a WhatsApp message:

```text
Hi
```

Expected mock reply:

```text
[MOCK RESPONSE] You said: Hi
```

Alternative without WhatsApp:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"Body":"Hello","From":"whatsapp:+911234567890"}'
```

## API Endpoints

### `POST /webhook/whatsapp`

Twilio calls this endpoint with a form-encoded body.

Expected Twilio fields:

```text
Body=Hello, I need a room
From=whatsapp:+15551234567
To=whatsapp:+14155238886
```

Flow:

1. Extract Twilio `Body` and `From`.
2. Enqueue a `process-message` job.
3. Return immediately.

Response:

```json
{
  "status": "queued"
}
```

### `POST /ai/reply`

Developer helper endpoint for direct AI testing.

```json
{
  "message": "Can I check in early?"
}
```

### `GET /conversations/:phoneNumber/messages`

Lists stored messages for a participant. When using WhatsApp addresses, URL-encode the phone number.

### `GET /health`

Checks PostgreSQL, Redis, OpenAI configuration, and Twilio configuration.

```json
{
  "status": "ok",
  "dependencies": {
    "db": { "status": "ok" },
    "redis": { "status": "ok" },
    "openai": { "status": "ok" },
    "twilio": { "status": "ok" }
  }
}
```

## Production Notes

- Keep `.env` out of source control.
- Run Prisma migrations as part of deployment.
- Use HTTPS for Twilio webhooks.
- Run Redis as managed infrastructure in production.
- Add authentication, rate limiting, and richer retry/dead-letter handling later as the product grows.
- This version intentionally focuses only on the WhatsApp -> AI -> reply path.

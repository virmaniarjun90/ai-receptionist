# AI Receptionist Backend Team Guide

## Architecture

This backend is a modular NestJS monolith. Each module owns one clear part of the system:

- `communication`: Twilio WhatsApp webhook and outbound Twilio messaging.
- `queue`: BullMQ producer and worker for async message processing.
- `conversation`: conversation and message persistence APIs.
- `property`: hotel/property dashboard APIs and property facts.
- `ai`: PII masking, prompt building, and provider-agnostic LLM calls.
- `common`: shared infrastructure such as Prisma.

Controllers stay thin. Business flow lives in services and workers.

## Queue Flow

```text
Twilio WhatsApp
  -> POST /webhook/whatsapp
  -> QueueService adds process-message job
  -> QueueProcessor starts job
  -> PropertyService fetches property context
  -> ConversationService stores user message
  -> ConversationService fetches last 10 messages
  -> PiiService masks sensitive values
  -> AiService builds prompt and calls LLM wrapper
  -> ConversationService stores assistant reply
  -> CommunicationService sends WhatsApp reply
```

Queue name: `message-processing`

Job name: `process-message`

Jobs retry 3 times with exponential backoff. The producer and processor log enqueue, start, completion, and failures with attempt counts.

## AI Wrapper

All LLM calls must go through `AiService`.

`AiService` flow:

```text
messages
  -> PiiService.sanitizeMessages
  -> PromptService.buildSystemPrompt(property)
  -> LlmFactory.getProvider()
  -> provider.generateReply(messages, systemPrompt)
```

The provider interface is:

```ts
generateReply(messages, systemPrompt): Promise<string>
```

Implemented providers:

- `openai`: active implementation using the OpenAI SDK.
- `claude`: stub, returns a service-unavailable error until implemented.
- `kimi`: stub, returns a service-unavailable error until implemented.

## Switching LLM Providers

Set:

```env
LLM_PROVIDER=openai
```

Allowed values:

```text
openai | claude | kimi
```

Only `openai` is production-ready today. The other providers exist so the app boundary is ready for future integrations without changing queue or controller code.

## PII Protection

`PiiService` masks sensitive user data before messages reach the LLM provider.

Masked values include:

- Phone numbers: `[PHONE]`
- Email addresses: `[EMAIL]`
- Names from simple self-identification patterns: `[NAME]`
- Booking IDs and numeric identifiers: `[BOOKING_ID]`, `[IDENTIFIER]`

Example:

```text
Call me at 9876543210, my name is Arjun
```

becomes:

```text
Call me at [PHONE], my name is [NAME]
```

Set masking with:

```env
PII_MASKING_ENABLED=true
```

Do not bypass this service for LLM calls.

## Property Prompt System

The `Property` model stores hotel facts used in the system prompt:

- name
- description
- address
- phone
- check-in/check-out times
- amenities
- policies

`PromptService` builds a receptionist prompt with property context. If no property exists, the AI falls back to a generic helpful hotel receptionist prompt.

## Dashboard APIs

Properties:

```text
GET /properties
POST /properties
```

Conversations:

```text
GET /conversations
GET /conversations/:id
GET /conversations/:phoneNumber/messages
```

## Environment Variables

```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
REDIS_HOST="localhost"
REDIS_PORT="6379"
LLM_PROVIDER="openai"
PII_MASKING_ENABLED="true"
```

## Local Runtime

Start PostgreSQL and Redis before running the backend.

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

For WhatsApp testing, expose the backend with ngrok and configure Twilio to call:

```text
POST https://your-ngrok-domain/webhook/whatsapp
```

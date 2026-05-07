# AI Receptionist — Demo Walkthrough

This document shows the full end-to-end demo using `curl` commands against the local backend.
The demo runs in **mock mode** (no real Twilio or OpenAI credentials required).

## Prerequisites

```bash
# Terminal 1 — start backend
cd backend && npm run start:dev

# Terminal 2 — run demo commands below
```

Verify everything is healthy:

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","dependencies":{"db":{"status":"ok"},"redis":{"status":"ok"},...}}`

---

## Setup

The seed data includes:
- **Property**: Development Hotel (`id: 00000000-0000-0000-0000-000000000101`)
- **Host phone**: `whatsapp:+15550000001`
- **Guest**: Sarah Johnson (`whatsapp:+911234567890`), checked in today
- **Knowledge**: WiFi password, parking, check-in, pool hours, and more

```bash
cd backend && npx ts-node -r tsconfig-paths/register prisma/seed.ts
```

Helper variables used in the commands below:

```bash
PROPERTY_PHONE="whatsapp:+14155238886"   # property's WhatsApp number (Twilio sandbox)
GUEST_PHONE="whatsapp:+911234567890"      # Sarah Johnson's phone
HOST_PHONE="whatsapp:+15550000001"        # host's personal WhatsApp
CONV_ID="<paste conversation ID from step 1>"
ADMIN="x-admin-key: dev-admin-key-change-me"
```

---

## Step 1 — Guest Greeting (personalized)

Sarah messages the property WhatsApp:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$GUEST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=Hi!"
```

**What happens**: AI looks up Sarah's reservation, personalizes the reply.

Check the reply:

```bash
curl -s http://localhost:3000/admin/conversations \
  -H "$ADMIN" | python3 -m json.tool | grep -A5 '"userPhone": "whatsapp:+911234567890"'
```

**Expected AI reply**: `"Hi Sarah! Great to have you at Development Hotel. How can I help you today?"`

Save the conversation ID for subsequent steps:

```bash
# Copy the "id" field from the response above and set:
CONV_ID="1d68b19a-3587-49a3-8ca7-508ca20a3570"   # replace with actual
```

---

## Step 2 — Guest Asks About WiFi (knowledge lookup)

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$GUEST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=What is the WiFi password?"
```

**Expected AI reply**: `"Welcome2024!"` (pulled from property knowledge base)

---

## Step 3 — Guest Asks About Parking

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$GUEST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=Where can I park my car?"
```

---

## Step 4 — Guest Asks Something AI Can't Answer (triggers host handoff)

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$GUEST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=Can you book a taxi to the airport for me?"
```

**What happens**:
1. AI replies to Sarah: *"That's something I'd need the host's personal help with. Let me connect you with them right away!"*
2. Host gets a WhatsApp notification (would appear on `+15550000001`): *"[Development Hotel] Sarah Johnson asked something the AI can't answer: 'Can you book a taxi...' Reply JOIN to assist directly, or SKIP to let the AI try again."*

Check conversation status:

```bash
curl -s http://localhost:3000/admin/conversations/$CONV_ID \
  -H "$ADMIN" | python3 -c "import json,sys; c=json.load(sys.stdin); print('Status:', c['status'])"
```

**Expected status**: `awaiting_host`

---

## Step 5 — Host Accepts (JOIN)

The host replies on their own WhatsApp (simulated here via the same webhook):

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=join"
```

**What happens**:
- Host gets: *"You're now connected with whatsapp:+911234567890. Reply here and your messages will be forwarded to the guest. Send DONE when you're finished."*
- Sarah gets: *"You're now connected with the host. They'll reply to you shortly."*

Status becomes: `host`

---

## Step 6 — Host Relays a Message to the Guest

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=Hi Sarah! I can arrange a taxi for you. What time do you need it?"
```

**What happens**: The message is forwarded verbatim to Sarah via the property WhatsApp number.

---

## Step 7 — Host Hands Back to AI (DONE)

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=done"
```

**What happens**:
- Host gets: *"Conversation handed back to the AI assistant. Thanks for helping!"*
- Sarah gets: *"The host has stepped away. You're back with the AI assistant — how can I help?"*

Status returns to: `ai`

---

## Step 8 — View Full Conversation in Admin UI

```bash
# Start admin UI
cd admin && npm run dev
# Open http://localhost:5173
```

Navigate to Conversations → click Sarah's row to see the full chat history, status timeline, and available actions (Take over / Hand back to AI / Erase data).

---

## Step 9 — Host Declines (SKIP flow, optional)

Reset the conversation to `awaiting_host` first (send another taxi request), then:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST_PHONE" \
  --data-urlencode "To=$PROPERTY_PHONE" \
  --data-urlencode "Body=skip"
```

Sarah gets: *"I wasn't able to reach the host right now, but I'll do my best to help. What else can I assist with?"*
Status returns to: `ai`

---

## Step 10 — GDPR: Erase Guest Data

```bash
curl -X DELETE \
  "http://localhost:3000/admin/guests/whatsapp%3A%2B911234567890" \
  -H "$ADMIN"
```

**Expected response**:
```json
{
  "phone": "whatsapp:+911234567890",
  "anonymised": { "conversations": 1, "messages": 6, "reservations": 1 }
}
```

All phone numbers, message participants, and guest names are replaced with `[deleted]`.

---

## Summary of Flows Demonstrated

| Flow | Trigger | AI response | Status change |
|------|---------|-------------|---------------|
| Greeting | "Hi!" | Personalised with guest name | stays `ai` |
| FAQ (WiFi, parking) | Known topic | Knowledge base lookup | stays `ai` |
| Out-of-scope request | Taxi/restaurant/complaint | Warm handoff message + host notified | → `awaiting_host` |
| Host accepts | `join` | Both parties notified | → `host` |
| Host relays | Any message | Forwarded verbatim to guest | stays `host` |
| Host hands back | `done` | Both parties notified | → `ai` |
| Host declines | `skip` | Guest gets graceful fallback | → `ai` |
| GDPR erasure | DELETE /admin/guests/:phone | PII anonymised | — |

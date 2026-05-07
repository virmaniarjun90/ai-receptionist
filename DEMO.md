# AI Receptionist — Demo Script

Two real guests, both checked in today at Sunset Villa. Conversations are already live.

| Guest | Phone | Check-in | Check-out |
|-------|-------|----------|-----------|
| Arjun Virmani | +91 88020 78873 | 7 May 2026 | 12 May 2026 |
| Kunal | +91 85708 46127 | 7 May 2026 | 12 May 2026 |

**Property WhatsApp**: `whatsapp:+14155238886`
**Admin UI**: http://localhost:5174
**Backend**: http://localhost:3000

---

## Setup (one time)

```bash
# Seed guests
cd backend && npx ts-node -r tsconfig-paths/register prisma/seed.ts

# Start backend (if not running)
npm run start:dev

# Start admin UI (if not running)
cd ../admin && npm run dev
```

Helper for curl commands below:
```bash
PROP="whatsapp:+14155238886"
ARJUN="whatsapp:+918802078873"
KUNAL="whatsapp:+918570846127"
HOST="whatsapp:+15550000001"
ADMIN="x-admin-key: dev-admin-key-change-me"
```

---

## Act 1 — Arjun checks in and asks about the property

Already seeded. Arjun texted "Hi" and got:
> *"Hi Arjun! Great to have you at Development Hotel. How can I help you today?"*

Now he asks about WiFi:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$ARJUN" \
  --data-urlencode "To=$PROP" \
  --data-urlencode "Body=What's the WiFi password?"
```
> *"Welcome2024!"*

Pool hours:
```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$ARJUN" \
  --data-urlencode "To=$PROP" \
  --data-urlencode "Body=What time does the pool open?"
```
> *"Pool is available 8 AM to 10 PM. No lifeguard on duty."*

---

## Act 2 — Kunal asks something out of scope → host handoff

Kunal asks for a taxi:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$KUNAL" \
  --data-urlencode "To=$PROP" \
  --data-urlencode "Body=Can you book a cab to the airport for me?"
```

**Kunal sees**: *"That's something I'd need the host's personal help with. Let me connect you with them right away!"*

**Host gets on WhatsApp**: *"[Development Hotel] Kunal asked something the AI can't answer: 'Can you book a cab...' — Reply JOIN to assist directly, or SKIP to let the AI try again."*

Conversation status → `awaiting_host`

---

## Act 3 — Host joins and relays on WhatsApp

Host replies JOIN:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST" \
  --data-urlencode "To=$PROP" \
  --data-urlencode "Body=join"
```

**Kunal sees**: *"You're now connected with the host. They'll reply to you shortly."*

Host types a reply directly to Kunal:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST" \
  --data-urlencode "To=$PROP" \
  --data-urlencode "Body=Hi Kunal! Sure, I can arrange a cab. What time do you need it and which terminal?"
```

**Kunal sees that message verbatim**, sent from the property number.

---

## Act 4 — Host hands back to AI

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=$HOST" \
  --data-urlencode "To=$PROP" \
  --data-urlencode "Body=done"
```

**Kunal sees**: *"The host has stepped away. You're back with the AI assistant — how can I help?"*

Status → `ai`. Kunal can now ask FAQ questions again and the AI answers.

---

## Act 5 — View everything in the Admin UI

Open http://localhost:5174 → **Conversations**

- See both Arjun and Kunal's threads with full message history
- Status badges show `AI handling` / `Awaiting host` / `Host active`
- Use **Take over** / **Hand back to AI** buttons directly from the UI
- Use **Erase data** to GDPR-delete a guest's personal data

---

## Quick checks

```bash
# Health
curl http://localhost:3000/health

# All conversations
curl http://localhost:3000/admin/conversations -H "$ADMIN" | python3 -m json.tool

# Arjun's full thread
curl http://localhost:3000/admin/conversations \
  -H "$ADMIN" | python3 -c "
import json,sys
convs=json.load(sys.stdin)
c=next(c for c in convs if '8802078873' in c['userPhone'])
print('Status:', c['status'])
for m in c['messages']: print(f'  [{m[\"role\"]}]', m['content'])
"
```

---

## Flows at a glance

| Guest message | AI response | Status |
|---------------|-------------|--------|
| "Hi" | Personalised greeting with first name | `ai` |
| "WiFi password?" | Looks up knowledge base | `ai` |
| "Book a cab" | Warm handoff + host notified | `awaiting_host` |
| Host: `join` | Both parties connected | `host` |
| Host: any message | Forwarded verbatim to guest | `host` |
| Host: `done` | Both notified, AI resumes | `ai` |
| Host: `skip` | Guest gets graceful fallback | `ai` |

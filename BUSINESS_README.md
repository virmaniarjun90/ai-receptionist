# AI Receptionist for Short-Term Rentals

**An always-on AI assistant that handles guest questions on WhatsApp — and loops in the host when it needs to.**

---

## The Problem

Guests staying at Airbnb properties, homestays, and boutique hotels have questions at all hours:
- *"What's the WiFi password?"*
- *"Where can I park?"*
- *"What time is check-out?"*
- *"Can I get an early check-in?"*

Today, hosts answer these manually — often while sleeping, at dinner, or mid-conversation. Missing a message makes guests feel neglected. Answering every trivial question is exhausting.

---

## The Solution

An AI receptionist that sits on the property's WhatsApp number and handles the routine questions instantly — 24/7, in any language — while staying smart enough to know when a human is needed.

**The guest experience**: They message the property number. They get a fast, friendly, accurate reply. They never know (or care) if it was AI or human.

**The host experience**: They set it up once. They only get a message when the AI genuinely can't help — and they handle it directly on their own WhatsApp, in the same app they already use.

---

## How It Works

### 1. Guest Registration & Welcome Kit

Before arrival, the host (or a channel manager integration) creates a reservation. The system sends the guest a personalised welcome message on WhatsApp with a link to their welcome kit — a mobile-friendly page containing:

- Check-in and check-out dates and times
- House rules and amenities
- WiFi details, parking, nearest supermarket, emergency contacts
- Any custom notes from the host

The link expires after checkout. No app download required for the guest.

### 2. AI Handles Day-to-Day Questions

Once the guest arrives, they can message the property WhatsApp at any time. The AI:

- Knows the property inside and out (everything in the knowledge base)
- Knows who the guest is (name, check-in / check-out dates)
- Replies instantly, without waking the host

Examples the AI answers confidently:
> "What's the WiFi?" → *"Network: SunsetVilla_5G, Password: Welcome2024!"*
> "Is there parking?" → *"Two spots in the driveway. Street parking also available."*
> "Can I check out late?" → *"Late checkout until 1 PM is available for $50, subject to availability."*

### 3. Smooth Handoff When AI Reaches Its Limit

Some requests need a human:
- *"Can you book a taxi for me?"*
- *"I have a complaint about the room."*
- *"Can I arrange airport pickup?"*
- *"Can we get extra towels?"*

When the AI detects something it can't reliably answer, it:

1. Tells the guest warmly: *"That's something I'd need the host's help with — let me connect you right away."*
2. Sends the host a WhatsApp message: *"[Sunset Villa] Sarah asked: 'Can you book a taxi?' — Reply JOIN to assist, or SKIP to let the AI try again."*

**The host replies "JOIN" from their own phone.** From that point, anything they type is relayed to the guest via the property number. The guest gets a seamless experience — it still feels like one conversation.

When the host is done, they send **"DONE"** and the AI takes back over automatically.

### 4. No New Apps Required

For the host: **it all happens in WhatsApp**. They receive the alert, they reply, they assist, they hand back. No admin panel, no second phone, no new software.

For the guest: **it's just WhatsApp**. They message a number — same as messaging a person.

---

## What the Host Controls

A simple web admin panel lets the host:

- Set up the property and manage the knowledge base (WiFi, rules, local tips)
- Create and manage reservations
- View the full message history for any guest conversation
- Manually take over or hand back any conversation
- Delete a guest's personal data on request (GDPR / privacy compliance)

---

## Privacy & Data Handling

- Guest phone numbers are **never sent to the AI model**. Only first name and stay dates are shared.
- All conversation history is stored in the host's own database.
- Any guest can request full data deletion — one button erases all messages, names, and phone numbers from the system.

---

## Pilot Setup

For the pilot phase, hosts onboard manually:

1. Host receives login to the admin panel
2. Host enters their property details and knowledge base
3. Guests register via a simple online form (name, phone, check-in/out dates)
4. System sends the welcome kit link and activates the AI receptionist

No Airbnb integration required for the pilot — everything is form-driven.

---

## Technology

- Runs on WhatsApp via Twilio (same number guests are already messaging)
- AI powered by Claude (Anthropic) — can switch to any AI model
- Processes messages in a background queue — no dropped messages under load
- Hosted on any cloud server; database is PostgreSQL

---

## Ideal First Customers

- Independent Airbnb hosts with 1–5 properties who are tired of answering the same questions
- Boutique hotel operators who want to offer instant guest support without hiring night staff
- Property managers handling multiple units who need to triage which conversations need human attention

---

## What's Not Included (Yet)

- Direct integration with Airbnb, Booking.com, or channel managers (planned)
- Multi-language auto-detection (the AI handles it naturally, but no explicit language routing)
- Voice support (WhatsApp only for now)
- Payments or booking modifications (query-only, no transactional actions)

---

## Contact

To set up a pilot property or discuss a partnership, reach out directly.

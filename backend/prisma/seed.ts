import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_PROPERTY_ID,
  DEFAULT_TENANT_ID,
} from '../src/modules/property/property.constants';

const prisma = new PrismaClient();

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

async function main(): Promise<void> {
  // Clean up existing data
  console.log('🧹 Cleaning up existing data...');
  await prisma.guestToken.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.knowledge.deleteMany({});
  await prisma.propertyHost.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.setting.deleteMany({});
  console.log('✓ Data cleaned successfully\n');

  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Development Tenant',
      type: 'airbnb',
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 1: Daniel - Private room with Terrace (Dwarka)
  // Owner: Rohit & Kanishka
  // ─────────────────────────────────────────────────────────────
  const danielPrivateTerraceRoom = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Daniel - Private room with Terrace',
      type: 'airbnb',
      description: 'There are 2 separate private bedrooms on terrace. This luxury Room is located in a rise building in Dwarka.',
      address: 'Dwarka, New Delhi',
      phone: '+1 (305) 555-0100',
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'Air-conditioned',
        'Smart TV',
        'Wi-Fi',
        'Free parking',
        'Outdoor Terrace',
        'King-sized bed',
        'Modern Bathroom',
      ],
      policies: [
        'No Smoking',
        'Quiet hours 11PM-6AM',
        'Unmarried couples welcome',
        'Government ID required',
      ],
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 2: Daniel - 1BR with Terrace (Dwarka)
  // Owner: Rohit & Kanishka
  // ─────────────────────────────────────────────────────────────
  const daniel1BRTerrace = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Daniel - 1BR with Terrace',
      type: 'airbnb',
      description: 'Private Bedroom with attached washroom & outdoor Terrace in a rise building in Dwarka.',
      address: 'Dwarka, New Delhi',
      phone: '+1 (305) 555-0101',
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'Air-conditioned',
        'Smart TV',
        'Wi-Fi',
        'Free parking',
        'Outdoor Terrace',
        'King-sized bed',
        'Modern Bathroom',
      ],
      policies: [
        'No Smoking',
        'Quiet hours 11PM-6AM',
        'Couples welcome',
        'Government ID required',
      ],
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 3: Daniel - 1BHK Apartment (Dwarka)
  // Owner: Rohit & Kanishka
  // ─────────────────────────────────────────────────────────────
  const daniel1BHKApartment = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Daniel - 1BHK Apartment',
      type: 'airbnb',
      description: 'Calm, stylish space with complete privacy. Flat on 4th Floor with no lift facility.',
      address: 'Dwarka, New Delhi',
      phone: '+1 (305) 555-0102',
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'Air-conditioned',
        'Amazon Fire Stick TV',
        'Wi-Fi',
        'Free parking',
        'Balcony',
        'King-sized bed',
        'Living Room',
      ],
      policies: [
        'No Smoking',
        'Quiet hours 11PM-6AM',
        'Unmarried couples welcome',
        'Government ID required',
      ],
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 4: Sukoon Villa R1 (Ghaziabad)
  // Owner: Arjun, Morisha, Sunita
  // ─────────────────────────────────────────────────────────────
  const sukoonVillaR1 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Sukoon Villa R1',
      type: 'airbnb',
      description: 'Private room in a spacious duplex 4BHK family house. Real hosts, real warmth with home-cooked meals available.',
      address: 'Ghaziabad, Uttarpradesh',
      phone: '+1 (305) 555-0103',
      checkInTime: '2:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'Private room with attached bathroom',
        'Workstation',
        'Tea maker',
        'High-speed Wi-Fi',
        'Balcony & terrace access',
        'Home-cooked meals available',
        'Golden Retriever (Caesar)',
      ],
      policies: [
        'No parties or loud music',
        'Smoking allowed on balcony/terrace only',
        'Basic housekeeping for long stays',
        'Keep shared areas tidy',
        'Early check-in/late check-out subject to availability',
      ],
    },
  });

  // ─────────────────────────────────────────────────────────────
  // HOSTS WITH CREDENTIALS
  // ─────────────────────────────────────────────────────────────

  const rohitPin = await hashPin('1234');
  const kanishkaPin = await hashPin('5678');
  const arjunPin = await hashPin('1111');
  const morishaPin = await hashPin('2222');
  const sunitaPin = await hashPin('3333');

  // Rohit and Kanishka own 3 Daniel properties
  const rohitPhone = '+918802047517';
  const kanishkaPhone = '+918802047518';

  // Daniel Properties - Rohit and Kanishka
  for (const prop of [danielPrivateTerraceRoom, daniel1BRTerrace, daniel1BHKApartment]) {
    await prisma.propertyHost.create({
      data: {
        propertyId: prop.id,
        name: 'Rohit',
        phone: rohitPhone,
        pinHash: rohitPin,
      },
    });

    await prisma.propertyHost.create({
      data: {
        propertyId: prop.id,
        name: 'Kanishka',
        phone: kanishkaPhone,
        pinHash: kanishkaPin,
      },
    });
  }

  // Sukoon Villa - Arjun, Morisha, Sunita
  const sukoonHosts = [
    { name: 'Arjun', phone: '+918802078873', pin: arjunPin },
    { name: 'Morisha', phone: '+918802178873', pin: morishaPin },
    { name: 'Sunita', phone: '+919873778006', pin: sunitaPin },
  ];

  for (const host of sukoonHosts) {
    await prisma.propertyHost.create({
      data: {
        propertyId: sukoonVillaR1.id,
        name: host.name,
        phone: host.phone,
        pinHash: host.pin,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // KNOWLEDGE ENTRIES FOR EACH PROPERTY
  // ─────────────────────────────────────────────────────────────

  // Property 1: Daniel - Private room with Terrace
  const danielPrivateTerraceRoomKnowledge = [
    { key: 'check_in_time', value: '3:00 PM - please arrive between 3 PM and 11 PM' },
    { key: 'check_out_time', value: '11:00 AM' },
    { key: 'wifi_name', value: 'Daniel_WiFi_2.4GHz' },
    { key: 'wifi_password', value: 'DanielTerrace2024' },
    { key: 'parking', value: 'Free parking available in the building. Building has lift facility.' },
    { key: 'terrace_access', value: 'Private terrace access right outside your room. Enjoy morning chai or evening breeze.' },
    { key: 'floor_info', value: 'Property is on 5th floor with lift facility - easy access.' },
    { key: 'metro_nearby', value: '5 minutes walk from Dwarka Sector-10 Metro Station' },
    { key: 'airport_distance', value: '30 minutes from International Airport (T3/T2/T1)' },
    { key: 'nearby_attractions', value: 'Yashobhoomi Convention Center (10 min), NSUT Dwarka (20 min), GGSIPU (10 min)' },
    { key: 'food_delivery', value: 'Zomato and Swiggy available 24/7. Many restaurants nearby.' },
    { key: 'transportation', value: 'Uber and Ola available 24/7 at the metro station' },
    { key: 'quiet_hours', value: 'Quiet hours from 11 PM to 6 AM - please keep noise to minimum' },
    { key: 'guests_policy', value: 'Unmarried couples are welcome. Valid government ID required at check-in (except PAN card)' },
    { key: 'smoking_policy', value: 'No smoking inside the room. Smoking allowed only on terrace.' },
  ];

  for (const entry of danielPrivateTerraceRoomKnowledge) {
    await prisma.knowledge.create({
      data: { propertyId: danielPrivateTerraceRoom.id, ...entry },
    });
  }

  // Property 2: Daniel - 1BR with Terrace
  const daniel1BRTerraceKnowledge = [
    { key: 'check_in_time', value: '3:00 PM - please arrive between 3 PM and 11 PM' },
    { key: 'check_out_time', value: '11:00 AM' },
    { key: 'wifi_name', value: 'Daniel_1BR_WiFi' },
    { key: 'wifi_password', value: 'Daniel1BR2024' },
    { key: 'room_type', value: '1 Bedroom + 1 Bathroom + Terrace. Complete privacy, no shared spaces.' },
    { key: 'parking', value: 'Free parking available. Lift facility available in building.' },
    { key: 'bedroom_features', value: 'King-sized bed with fresh linens, spacious wardrobe, modern bathroom with hot water.' },
    { key: 'terrace_info', value: 'Private & shared terrace with stunning views. Perfect for morning chai or evening relaxation.' },
    { key: 'floor_info', value: '5th Floor with lift facility.' },
    { key: 'metro_nearby', value: '5 minutes from Dwarka Sector-10 Metro Station' },
    { key: 'airport_distance', value: '30 minutes from International Airport' },
    { key: 'nearby_venues', value: 'Yashobhoomi Convention Center (10 min), NSUT Dwarka (20 min)' },
    { key: 'food_options', value: 'Order from Zomato/Swiggy. Many dining options nearby.' },
    { key: 'transport', value: 'Uber/Ola 24/7. Great connectivity.' },
    { key: 'couples_welcome', value: 'Yes! Both guests must be 18+ years old. Valid ID required.' },
    { key: 'quiet_hours', value: '11 PM to 6 AM - keep noise minimal' },
    { key: 'smoking', value: 'No smoking inside. Smoking allowed only on terrace.' },
  ];

  for (const entry of daniel1BRTerraceKnowledge) {
    await prisma.knowledge.create({
      data: { propertyId: daniel1BRTerrace.id, ...entry },
    });
  }

  // Property 3: Daniel - 1BHK Apartment
  const daniel1BHKApartmentKnowledge = [
    { key: 'check_in_time', value: '3:00 PM' },
    { key: 'check_out_time', value: '11:00 AM' },
    { key: 'wifi_name', value: 'Daniel_1BHK_WiFi' },
    { key: 'wifi_password', value: 'Daniel1BHK2024' },
    { key: 'room_type', value: '1 BHK - 1 Bedroom with Living Room + Bathroom + Balcony' },
    { key: 'balcony_info', value: 'Private balcony where you can enjoy, chill, and relax with a view.' },
    { key: 'tv_info', value: 'Amazon Fire Stick TV with streaming access' },
    { key: 'parking', value: 'Free parking available in the building area.' },
    { key: 'lift_info', value: 'No lift facility - property is on 4th floor (stairs only)' },
    { key: 'bedroom_features', value: 'King-sized bed, spacious wardrobe, modern bathroom with hot water.' },
    { key: 'living_space', value: 'Separate living room for relaxation and work.' },
    { key: 'metro_nearby', value: '5 minutes from Dwarka Sector-12/13 Metro Station' },
    { key: 'airport_distance', value: '30 minutes from International Airport' },
    { key: 'nearby_attractions', value: 'Yashobhoomi Convention Center, NSUT Dwarka, GGSIPU nearby' },
    { key: 'food_delivery', value: 'Zomato & Swiggy available. Many restaurants in area.' },
    { key: 'transportation', value: 'Uber/Ola easily available 24/7' },
    { key: 'quiet_hours', value: 'Quiet hours 11 PM - 6 AM. Keep noise levels low.' },
    { key: 'couples_welcome', value: 'Unmarried couples welcome. Valid ID required.' },
    { key: 'smoking_policy', value: 'No smoking inside. Balcony smoking only.' },
  ];

  for (const entry of daniel1BHKApartmentKnowledge) {
    await prisma.knowledge.create({
      data: { propertyId: daniel1BHKApartment.id, ...entry },
    });
  }

  // Property 4: Sukoon Villa R1
  const sukoonVillaR1Knowledge = [
    { key: 'check_in_time', value: '2:00 PM' },
    { key: 'check_out_time', value: '11:00 AM' },
    { key: 'wifi_name', value: 'Sukoon_Villa_5G' },
    { key: 'wifi_password', value: 'SukoonWiFi2024' },
    { key: 'room_type', value: 'Private room with attached bathroom. Part of a lived-in family home.' },
    { key: 'room_features', value: 'Cozy double bed with fresh linens, spacious wardrobe, AC, warm ambient lighting.' },
    { key: 'workstation', value: 'Dedicated workstation with rotating chair - perfect for remote work and studying.' },
    { key: 'tea_coffee', value: 'Kettle, tea/coffee essentials, cutlery, sugar, milk available in room. Refillable anytime.' },
    { key: 'water', value: 'Clean drinking water available - refillable anytime from the filtered water station.' },
    { key: 'balcony_terrace', value: 'Access to shared balcony and terrace - great for morning chai, reading, or quiet time.' },
    { key: 'caesar_dog', value: 'Caesar is our Golden Retriever - gentle, loving, and clingy! He loves guests. He\'s never allowed in guest rooms.' },
    { key: 'home_cooked_meals', value: 'Home-cooked meals available on request at reasonable charge - authentic Indian food.' },
    { key: 'shared_spaces', value: 'Dining area, kitchen (light use - microwave & fridge), patio with furniture, filtered water station.' },
    { key: 'location_ghaziabad', value: 'Property in peaceful gated green society in Ghaziabad, Uttar Pradesh.' },
    { key: 'atmosphere', value: 'Warm, homely family environment - not a hotel setup. Complete privacy with nearby host support.' },
    { key: 'housekeeping', value: 'Basic housekeeping available for long stays. Shared areas should be kept tidy.' },
    { key: 'early_checkin', value: 'Early check-in may be possible depending on availability - contact host.' },
    { key: 'late_checkout', value: 'Late check-out may be possible - discuss with host based on their availability.' },
    { key: 'parties_policy', value: 'No parties, loud music, or outside visitors unless discussed beforehand with hosts.' },
    { key: 'smoking_policy', value: 'Smoking allowed only on balcony/terrace - not inside the room.' },
    { key: 'host_availability', value: 'Hosts live in the same property and are usually available to help quickly while giving complete privacy.' },
    { key: 'pet_friendly', value: 'If you\'re a pet lover, you\'ll enjoy Caesar\'s company. If not, he keeps his distance.' },
  ];

  for (const entry of sukoonVillaR1Knowledge) {
    await prisma.knowledge.create({
      data: { propertyId: sukoonVillaR1.id, ...entry },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // RESERVATIONS & CONVERSATIONS — 8 SCENARIOS DEMONSTRATED
  //
  //   Scenario 1 — Pure AI          : Raj Kumar     (Prop 1) All AI, no handoff
  //   Scenario 2 — AI + Demo Handoff : Priya Sharma  (Prop 1) Light bulb reported — take over to demo
  //   Scenario 3 — Awaiting (live)  : Karan Nair    (Prop 4) 3-min window just started, button disabled
  //   Scenario 4 — Awaiting (old)   : Anupam Das    (Prop 3) handoff 10 min ago, Take Over button enabled
  //   Scenario 5 — Multi-day stay   : Neha Gupta    (Prop 2) 4-day stay, day separators, Kanishka via WhatsApp
  //   Scenario 6 — AI Fallback      : Deepak Singh  (Prop 2) handoff → no response → AI fallback
  //   Scenario 7 — Full round-trip  : Sanjana Verma (Prop 3) handoff → Kanishka → DONE → AI resumes
  //   Scenario 8 — Multi-host relay : Rahul Verma   (Prop 4) 3 hosts notified, Arjun first to JOIN
  // ─────────────────────────────────────────────────────────────

  async function createConversationWithMessages(
    propertyId: string,
    guestPhone: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string; from?: string; createdAt?: Date }>,
    status: 'ai' | 'host' | 'pending' | 'awaiting_host' = 'ai',
    activeHostPhone?: string,
    activeHostName?: string,
    handoffTriggeredAt?: Date,
  ) {
    const conv = await prisma.conversation.create({
      data: {
        userPhone: guestPhone,
        propertyId,
        status,
        activeHostPhone,
        activeHostName,
        ...(handoffTriggeredAt ? { handoffTriggeredAt } : {}),
      },
    });

    for (const msg of messages) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          content: msg.content,
          role: msg.role,
          from: msg.from || (msg.role === 'user' ? guestPhone : 'assistant'),
          to: msg.role === 'user' ? 'assistant' : guestPhone,
          createdAt: msg.createdAt || new Date(),
        },
      });
    }

    return conv;
  }

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 1: Daniel - Private room with Terrace
  // ─────────────────────────────────────────────────────────────

  // Scenario 1 — Pure AI: Raj Kumar (past guest, Jun 1-5)
  // Guest asks check-in, WiFi, parking, metro questions — all answered by AI, no handoff needed
  await prisma.reservation.create({
    data: {
      propertyId: danielPrivateTerraceRoom.id,
      externalId: 'PROP1-PAST-001',
      guestName: 'Raj Kumar',
      guestPhone: '+918765432101',
      checkIn: new Date('2026-06-01T15:00:00Z'),
      checkOut: new Date('2026-06-05T11:00:00Z'),
      status: 'completed',
      guestCount: 2,
    },
  });

  await createConversationWithMessages(
    danielPrivateTerraceRoom.id,
    '+918765432101',
    [
      { role: 'user', content: 'Hi, what is the check-in time?', createdAt: new Date('2026-06-01T13:00:00Z') },
      { role: 'assistant', content: 'Check-in time is 3:00 PM. Please arrive between 3 PM and 11 PM.', createdAt: new Date('2026-06-01T13:00:30Z') },
      { role: 'user', content: 'Is there Wi-Fi available?', createdAt: new Date('2026-06-01T13:01:00Z') },
      { role: 'assistant', content: 'Yes! High-speed Wi-Fi is available. Network: Daniel_WiFi_2.4GHz, Password: DanielTerrace2024', createdAt: new Date('2026-06-01T13:01:30Z') },
      { role: 'user', content: 'Is parking free?', createdAt: new Date('2026-06-02T09:00:00Z') },
      { role: 'assistant', content: 'Yes, free parking is available in the building. The building has lift access too.', createdAt: new Date('2026-06-02T09:00:30Z') },
      { role: 'user', content: 'How far is the metro?', createdAt: new Date('2026-06-02T09:01:00Z') },
      { role: 'assistant', content: 'Dwarka Sector-10 Metro Station is just a 5-minute walk from the property. Very convenient!', createdAt: new Date('2026-06-02T09:01:30Z') },
    ],
  );

  // Scenario 2 — Handoff + Host Takeover: Priya Sharma (current guest, Jun 10-14)
  // Light bulb fused → AI hands off → Rohit takes over via dashboard → messages resolved
  // Starts as ai so you can demo taking over live; set to host + activeHostPhone to show post-takeover state
  // STATUS: ai (start fresh — take over in the dashboard to demo scenario 2)
  await prisma.reservation.create({
    data: {
      propertyId: danielPrivateTerraceRoom.id,
      externalId: 'PROP1-CURR-001',
      guestName: 'Priya Sharma',
      guestPhone: '+918765432102',
      checkIn: new Date('2026-06-10T15:00:00Z'),
      checkOut: new Date('2026-06-14T11:00:00Z'),
      status: 'confirmed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    danielPrivateTerraceRoom.id,
    '+918765432102',
    [
      { role: 'user', content: 'Hi! The light bulb in my bedroom is fused. Can someone fix it?', createdAt: new Date('2026-06-12T15:00:00Z') },
      { role: 'assistant', content: "I'm sorry about that! I've notified the hosts and someone will get back to you shortly.", createdAt: new Date('2026-06-12T15:00:30Z') },
    ],
  );

  // Upcoming guest — Amit Patel (Jun 20-23): pre-arrival amenity questions
  await prisma.reservation.create({
    data: {
      propertyId: danielPrivateTerraceRoom.id,
      externalId: 'PROP1-UPC-001',
      guestName: 'Amit Patel',
      guestPhone: '+918765432103',
      checkIn: new Date('2026-06-20T15:00:00Z'),
      checkOut: new Date('2026-06-23T11:00:00Z'),
      status: 'confirmed',
      guestCount: 2,
    },
  });

  await createConversationWithMessages(
    danielPrivateTerraceRoom.id,
    '+918765432103',
    [
      { role: 'user', content: 'Hi! What items are provided in the room?', createdAt: new Date('2026-06-10T10:00:00Z') },
      { role: 'assistant', content: 'The room includes a king-sized bed with fresh linens, modern bathroom with hot water, AC, Smart TV, and access to the private outdoor terrace.', createdAt: new Date('2026-06-10T10:00:30Z') },
      { role: 'user', content: 'Is breakfast included?', createdAt: new Date('2026-06-10T10:01:00Z') },
      { role: 'assistant', content: 'Breakfast is not included in the stay. However, Zomato and Swiggy deliver 24/7 and there are many restaurants nearby.', createdAt: new Date('2026-06-10T10:01:30Z') },
    ],
  );

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 2: Daniel - 1BR with Terrace
  // ─────────────────────────────────────────────────────────────

  // Scenario 6 — AI Fallback: Deepak Singh (past guest, May 28 - Jun 2)
  // WiFi down → AI triggers handoff → no host responds in 3 min → AI sends troubleshooting fallback → resolved
  await prisma.reservation.create({
    data: {
      propertyId: daniel1BRTerrace.id,
      externalId: 'PROP2-PAST-001',
      guestName: 'Deepak Singh',
      guestPhone: '+918765432104',
      checkIn: new Date('2026-05-28T15:00:00Z'),
      checkOut: new Date('2026-06-02T11:00:00Z'),
      status: 'completed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    daniel1BRTerrace.id,
    '+918765432104',
    [
      { role: 'user', content: 'The WiFi is completely down. Can someone fix it?', createdAt: new Date('2026-06-01T18:00:00Z') },
      { role: 'assistant', content: "I'm reaching out to the hosts right now.", createdAt: new Date('2026-06-01T18:00:30Z') },
      // 3-min window passed, no host responded — AI sends fallback
      { role: 'assistant', content: "I wasn't able to reach the hosts right now. In the meantime, try restarting the router — it's usually near the TV unit. WiFi: Daniel_1BR_WiFi | Password: Daniel1BR2024.", createdAt: new Date('2026-06-01T18:04:00Z') },
      { role: 'user', content: 'Trying now...', createdAt: new Date('2026-06-01T18:05:00Z') },
      { role: 'user', content: 'It worked! Thank you.', createdAt: new Date('2026-06-01T18:08:00Z') },
      { role: 'assistant', content: "Glad that worked! Let me know if you need anything else during your stay.", createdAt: new Date('2026-06-01T18:08:30Z') },
    ],
  );

  // Scenario 5 — Multi-day Stay + Kanishka via WhatsApp: Neha Gupta (current guest, Jun 9-14)
  // 4-day stay. Shows day separators (3 days ago / 2 days ago / yesterday / today).
  // Day 2 heater issue: AI hands off → Kanishka replies via WhatsApp → sends DONE → AI resumes.
  await prisma.reservation.create({
    data: {
      propertyId: daniel1BRTerrace.id,
      externalId: 'PROP2-CURR-001',
      guestName: 'Neha Gupta',
      guestPhone: '+918765432105',
      checkIn: new Date('2026-06-09T15:00:00Z'),
      checkOut: new Date('2026-06-14T11:00:00Z'),
      status: 'confirmed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    daniel1BRTerrace.id,
    '+918765432105',
    [
      // Day 1 — Jun 9 (3 days ago)
      { role: 'user', content: 'What time can I check in?', createdAt: new Date('2026-06-09T10:00:00Z') },
      { role: 'assistant', content: 'Check-in is at 3:00 PM. You can arrive anytime from 3 PM onwards.', createdAt: new Date('2026-06-09T10:00:30Z') },
      { role: 'user', content: 'Is there free parking?', createdAt: new Date('2026-06-09T10:01:00Z') },
      { role: 'assistant', content: 'Yes! Free parking is available in the building. Lift facility is also available.', createdAt: new Date('2026-06-09T10:01:30Z') },
      // Day 2 — Jun 10 (2 days ago): heater issue → Kanishka via WhatsApp
      { role: 'user', content: 'The room heater is not working properly.', createdAt: new Date('2026-06-10T09:00:00Z') },
      { role: 'assistant', content: "I'm sorry about that! Let me reach out to the host immediately.", createdAt: new Date('2026-06-10T09:00:30Z') },
      { role: 'assistant', content: "Hi Neha! I'll check the heater right away. Give me 10 minutes.", from: '+918802047518', createdAt: new Date('2026-06-10T09:04:00Z') },
      { role: 'user', content: 'Thank you! No rush.', createdAt: new Date('2026-06-10T09:05:00Z') },
      { role: 'assistant', content: 'Heater fixed! There was a loose connection. Should be warming up now.', from: '+918802047518', createdAt: new Date('2026-06-10T09:20:00Z') },
      { role: 'user', content: "It's warming up now! Thank you so much.", createdAt: new Date('2026-06-10T09:21:00Z') },
      { role: 'assistant', content: "You're back with the AI assistant. Enjoy your stay! Let me know if you need anything.", createdAt: new Date('2026-06-10T09:22:00Z') },
      // Day 3 — Jun 11 (yesterday): mid-stay question
      { role: 'user', content: 'What is the WiFi password?', createdAt: new Date('2026-06-11T14:00:00Z') },
      { role: 'assistant', content: 'WiFi Name: Daniel_1BR_WiFi | Password: Daniel1BR2024', createdAt: new Date('2026-06-11T14:00:30Z') },
      // Day 4 — Jun 12 (today): checkout question
      { role: 'user', content: 'What time is checkout tomorrow?', createdAt: new Date('2026-06-12T08:00:00Z') },
      { role: 'assistant', content: 'Checkout is at 11:00 AM. Please ensure keys are returned before you leave.', createdAt: new Date('2026-06-12T08:00:30Z') },
    ],
  );

  // Upcoming guest — Vikram Reddy (Jun 21-25): simple booking confirmation
  await prisma.reservation.create({
    data: {
      propertyId: daniel1BRTerrace.id,
      externalId: 'PROP2-UPC-001',
      guestName: 'Vikram Reddy',
      guestPhone: '+918765432106',
      checkIn: new Date('2026-06-21T15:00:00Z'),
      checkOut: new Date('2026-06-25T11:00:00Z'),
      status: 'confirmed',
      guestCount: 2,
    },
  });

  await createConversationWithMessages(
    daniel1BRTerrace.id,
    '+918765432106',
    [
      { role: 'user', content: 'Hi! Just confirming my booking for June 21-25.', createdAt: new Date('2026-06-10T09:00:00Z') },
      { role: 'assistant', content: 'Hi Vikram! Your booking is confirmed for June 21-25. Check-in is at 3:00 PM and check-out at 11:00 AM. Looking forward to hosting you!', createdAt: new Date('2026-06-10T09:00:30Z') },
    ],
  );

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 3: Daniel - 1BHK Apartment
  // ─────────────────────────────────────────────────────────────

  // Scenario 7 — Full Round-Trip: Sanjana Verma (past guest, Jun 3-8)
  // Late checkout request → AI hands off → Kanishka approves via WhatsApp → sends DONE → AI resumes
  await prisma.reservation.create({
    data: {
      propertyId: daniel1BHKApartment.id,
      externalId: 'PROP3-PAST-001',
      guestName: 'Sanjana Verma',
      guestPhone: '+918765432107',
      checkIn: new Date('2026-06-03T15:00:00Z'),
      checkOut: new Date('2026-06-08T11:00:00Z'),
      status: 'completed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    daniel1BHKApartment.id,
    '+918765432107',
    [
      { role: 'user', content: 'Hi! Can I get a late checkout? My flight is at 2 PM tomorrow.', createdAt: new Date('2026-06-07T22:00:00Z') },
      { role: 'assistant', content: 'Late checkout until 1 PM is available for a fee. For 2 PM, let me check with the host.', createdAt: new Date('2026-06-07T22:00:30Z') },
      { role: 'user', content: 'Yes please, 2 PM would really help.', createdAt: new Date('2026-06-07T22:01:00Z') },
      { role: 'assistant', content: 'Connecting you with the host now.', createdAt: new Date('2026-06-07T22:01:30Z') },
      // Kanishka responds via WhatsApp after the 3-min window
      { role: 'assistant', content: 'Hi Sanjana! Late checkout at 2 PM is absolutely fine — no new guest arriving that day. Enjoy your morning!', from: '+918802047518', createdAt: new Date('2026-06-07T22:06:00Z') },
      { role: 'user', content: 'Thank you so much! That is really kind.', createdAt: new Date('2026-06-07T22:07:00Z') },
      // Kanishka sends DONE via WhatsApp → AI takes back
      { role: 'assistant', content: "You're back with the AI assistant. Is there anything else I can help with?", createdAt: new Date('2026-06-07T22:10:00Z') },
      { role: 'user', content: 'What are the quiet hours?', createdAt: new Date('2026-06-07T22:11:00Z') },
      { role: 'assistant', content: 'Quiet hours are from 11 PM to 6 AM. Please keep noise minimal during these hours.', createdAt: new Date('2026-06-07T22:11:30Z') },
    ],
  );

  // Scenario 4 — Awaiting Host (Take Over button ENABLED): Anupam Das (current guest, Jun 10-14)
  // AC not cooling → AI triggers handoff → handoffTriggeredAt = 10 min ago → past the 3-min window
  // Host dashboard shows: Take Over button is ACTIVE (not disabled)
  await prisma.reservation.create({
    data: {
      propertyId: daniel1BHKApartment.id,
      externalId: 'PROP3-CURR-001',
      guestName: 'Anupam Das',
      guestPhone: '+918765432108',
      checkIn: new Date('2026-06-10T15:00:00Z'),
      checkOut: new Date('2026-06-14T11:00:00Z'),
      status: 'confirmed',
      guestCount: 2,
    },
  });

  await createConversationWithMessages(
    daniel1BHKApartment.id,
    '+918765432108',
    [
      { role: 'user', content: 'The AC in my room is running but not cooling at all.', createdAt: new Date('2026-06-12T11:00:00Z') },
      { role: 'assistant', content: "I'm sorry to hear that! Let me reach out to the hosts immediately. They'll get this sorted.", createdAt: new Date('2026-06-12T11:00:30Z') },
    ],
    'awaiting_host',
    undefined,
    undefined,
    new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago — past the 3-min window, Take Over button is ENABLED
  );

  // Upcoming guest — Pooja Singh (Jun 22-26): business traveler questions
  await prisma.reservation.create({
    data: {
      propertyId: daniel1BHKApartment.id,
      externalId: 'PROP3-UPC-001',
      guestName: 'Pooja Singh',
      guestPhone: '+918765432109',
      checkIn: new Date('2026-06-22T15:00:00Z'),
      checkOut: new Date('2026-06-26T11:00:00Z'),
      status: 'confirmed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    daniel1BHKApartment.id,
    '+918765432109',
    [
      { role: 'user', content: "Hi, I'm coming for a conference. Is the WiFi reliable for video calls?", createdAt: new Date('2026-06-10T15:00:00Z') },
      { role: 'assistant', content: 'Yes! High-speed WiFi throughout the property, reliable for video calls and streaming. Network: Daniel_1BHK_WiFi | Password: Daniel1BHK2024.', createdAt: new Date('2026-06-10T15:00:30Z') },
      { role: 'user', content: 'What is the nearest metro station?', createdAt: new Date('2026-06-10T15:01:00Z') },
      { role: 'assistant', content: 'Dwarka Sector-12/13 Metro Station is just 5 minutes away — great for commuting to conference venues.', createdAt: new Date('2026-06-10T15:01:30Z') },
    ],
  );

  // ─────────────────────────────────────────────────────────────
  // PROPERTY 4: Sukoon Villa R1
  // ─────────────────────────────────────────────────────────────

  // Scenario 8 — Multi-host Relay: Rahul Verma (past guest, May 30 - Jun 4)
  // Meal arrangement → AI hands off → all 3 hosts (Arjun, Morisha, Sunita) notified simultaneously
  // Arjun is first to JOIN via WhatsApp and takes over → handles meal preferences → sends DONE
  await prisma.reservation.create({
    data: {
      propertyId: sukoonVillaR1.id,
      externalId: 'PROP4-PAST-001',
      guestName: 'Rahul Verma',
      guestPhone: '+918765432110',
      checkIn: new Date('2026-05-30T14:00:00Z'),
      checkOut: new Date('2026-06-04T11:00:00Z'),
      status: 'completed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    sukoonVillaR1.id,
    '+918765432110',
    [
      { role: 'user', content: 'Hi! Can I arrange home-cooked meals during my stay?', createdAt: new Date('2026-05-30T12:00:00Z') },
      { role: 'assistant', content: 'Absolutely! Home-cooked meals are available at a reasonable charge. Let me connect you with the host to arrange preferences and timing.', createdAt: new Date('2026-05-30T12:00:30Z') },
      // All 3 hosts (Arjun, Morisha, Sunita) are notified. Arjun responds first via WhatsApp.
      { role: 'assistant', content: 'Hi Rahul! Welcome to Sukoon Villa! I can arrange breakfast and dinner. Any dietary preferences or allergies?', from: '+918802078873', createdAt: new Date('2026-05-30T12:04:00Z') },
      { role: 'user', content: "I'm vegetarian. Breakfast at 8 AM and dinner at 7 PM would be great!", createdAt: new Date('2026-05-30T12:05:00Z') },
      { role: 'assistant', content: 'Vegetarian meals noted! Breakfast at 8 AM and dinner at 7 PM. Caesar is excited to meet you too!', from: '+918802078873', createdAt: new Date('2026-05-30T12:07:00Z') },
      { role: 'user', content: 'Wonderful! Looking forward to it.', createdAt: new Date('2026-05-30T12:08:00Z') },
      // Arjun sends DONE via WhatsApp → AI resumes
      { role: 'assistant', content: "You're back with the AI assistant. Enjoy your stay at Sukoon Villa!", createdAt: new Date('2026-05-30T12:10:00Z') },
    ],
  );

  // Scenario 3 — Awaiting Host (3-min window LIVE): Karan Nair (current guest, Jun 11-16)
  // Pool dirty → AI hands off → handoffTriggeredAt = NOW (seeded at this moment)
  // Host dashboard shows: button says "Contacting hosts..." and is DISABLED for ~3 minutes after seed
  await prisma.reservation.create({
    data: {
      propertyId: sukoonVillaR1.id,
      externalId: 'PROP4-CURR-001',
      guestName: 'Karan Nair',
      guestPhone: '+918765432111',
      checkIn: new Date('2026-06-11T14:00:00Z'),
      checkOut: new Date('2026-06-16T11:00:00Z'),
      status: 'confirmed',
      guestCount: 1,
    },
  });

  await createConversationWithMessages(
    sukoonVillaR1.id,
    '+918765432111',
    [
      { role: 'user', content: 'The pool looks really dirty. Can someone clean it before I use it?', createdAt: new Date('2026-06-12T16:00:00Z') },
      { role: 'assistant', content: "I'm alerting all hosts at Sukoon Villa right now. Someone will get back to you shortly.", createdAt: new Date('2026-06-12T16:00:30Z') },
    ],
    'awaiting_host',
    undefined,
    undefined,
    new Date(), // Handoff triggered RIGHT NOW — 3-min window is LIVE
  );

  // Upcoming couple — Meena Srivastava (Jun 18-21): relaxation inquiry
  await prisma.reservation.create({
    data: {
      propertyId: sukoonVillaR1.id,
      externalId: 'PROP4-UPC-001',
      guestName: 'Meena Srivastava',
      guestPhone: '+918765432112',
      checkIn: new Date('2026-06-18T14:00:00Z'),
      checkOut: new Date('2026-06-21T11:00:00Z'),
      status: 'confirmed',
      guestCount: 2,
    },
  });

  await createConversationWithMessages(
    sukoonVillaR1.id,
    '+918765432112',
    [
      { role: 'user', content: 'Hi! My partner and I are looking for a relaxing getaway. Is it a homely atmosphere?', createdAt: new Date('2026-06-10T16:00:00Z') },
      { role: 'assistant', content: "Yes! Sukoon Villa is a warm, family home with real hosts living here — genuine hospitality, not a hotel. You'll have balcony and terrace access too, perfect for couples.", createdAt: new Date('2026-06-10T16:00:30Z') },
      { role: 'user', content: 'That sounds perfect! Can we meet Caesar?', createdAt: new Date('2026-06-10T16:01:00Z') },
      { role: 'assistant', content: "Absolutely! Caesar is our friendly Golden Retriever who loves guests. He's gentle and never enters guest rooms, but you'll enjoy his company in shared areas.", createdAt: new Date('2026-06-10T16:01:30Z') },
    ],
  );

  // ─────────────────────────────────────────────────────────────
  // DEFAULT PROPERTY (Sunset Villa — backward compatibility)
  // ─────────────────────────────────────────────────────────────
  const defaultProperty = await prisma.property.upsert({
    where: { id: DEFAULT_PROPERTY_ID },
    update: {
      phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER ?? null,
    },
    create: {
      id: DEFAULT_PROPERTY_ID,
      tenantId: tenant.id,
      name: 'Sunset Villa',
      type: 'airbnb',
      description: 'A beautiful 3-bedroom villa with ocean views. Perfect for families and groups.',
      address: '123 Ocean Drive, Miami Beach, FL 33139',
      phone: '+1 (305) 555-0100',
      phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER ?? null,
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'High-speed Wi-Fi',
        'Heated pool',
        'Full kitchen',
        'BBQ grill',
        'Beach access',
        'Free parking',
        'Air conditioning',
        'Smart TV',
      ],
      policies: [
        'No smoking on premises',
        'No parties or events',
        'Pets allowed with prior approval',
        'Valid ID required at check-in',
        'Quiet hours: 10 PM – 8 AM',
      ],
    },
  });

  const demoHosts = [
    { name: 'Sunita', phone: 'whatsapp:+919089786756' },
    { name: 'Manju', phone: 'whatsapp:+919234545345' },
    { name: 'Morisha', phone: 'whatsapp:+919755634536' },
  ];

  for (const host of demoHosts) {
    await prisma.propertyHost.upsert({
      where: { propertyId_phone: { propertyId: defaultProperty.id, phone: host.phone } },
      update: { name: host.name },
      create: { propertyId: defaultProperty.id, name: host.name, phone: host.phone },
    });
  }

  const knowledgeEntries = [
    { key: 'wifi_name', value: 'SunsetVilla_5G' },
    { key: 'wifi_password', value: 'Welcome2024!' },
    { key: 'parking', value: 'Two parking spots in the driveway. Street parking also available.' },
    { key: 'pool_hours', value: 'Pool is available 8 AM to 10 PM. No lifeguard on duty.' },
    { key: 'check_in_process', value: 'Self check-in with keypad code. Code sent 24h before arrival via Airbnb message.' },
    { key: 'emergency_contact', value: 'For emergencies: +1 (305) 555-0199 (available 24/7).' },
  ];

  for (const entry of knowledgeEntries) {
    await prisma.knowledge.upsert({
      where: { propertyId_key: { propertyId: defaultProperty.id, key: entry.key } },
      update: { value: entry.value },
      create: { propertyId: defaultProperty.id, ...entry },
    });
  }

  // Summary
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    SEED COMPLETED SUCCESSFULLY                 ║
╚════════════════════════════════════════════════════════════════╝

📍 PROPERTIES CREATED:
  1. Daniel - Private room with Terrace (Dwarka)
  2. Daniel - 1BR with Terrace (Dwarka)
  3. Daniel - 1BHK Apartment (Dwarka)
  4. Sukoon Villa R1 (Ghaziabad)
  5. Sunset Villa (Default - Miami Beach)

👥 HOST CREDENTIALS:

  ROHIT & KANISHKA (Own all 3 Daniel properties):
    • Rohit
      Phone: +918802047517
      PIN: 1234
    • Kanishka
      Phone: +918802047518
      PIN: 5678

  SUKOON VILLA R1 HOSTS:
    • Arjun
      Phone: +918802078873
      PIN: 1111
    • Morisha
      Phone: +918802178873
      PIN: 2222
    • Sunita
      Phone: +919873778006
      PIN: 3333

📅 8 SCENARIOS SEEDED (4 properties × 3 conversations = 12 total):

  ✅ Scenario 1 — Pure AI         : Raj Kumar     (Prop 1) All AI, no handoff
  🤖 Scenario 2 — AI (take over)  : Priya Sharma  (Prop 1) Light bulb issue — status: ai (take over to demo)
  ⏳ Scenario 3 — Awaiting (live) : Karan Nair    (Prop 4) 3-min window NOW — button disabled
  🔔 Scenario 4 — Awaiting (old)  : Anupam Das    (Prop 3) 10 min ago — Take Over button ENABLED
  📅 Scenario 5 — Multi-day       : Neha Gupta    (Prop 2) 4-day stay with day separators + Kanishka via WhatsApp
  🔄 Scenario 6 — AI Fallback     : Deepak Singh  (Prop 2) handoff → no response → AI fallback
  ↩️  Scenario 7 — Full Round-trip : Sanjana Verma (Prop 3) handoff → Kanishka → DONE → AI resumes
  👥 Scenario 8 — Multi-host relay: Rahul Verma   (Prop 4) all 3 hosts notified, Arjun first to JOIN

🔑 Host Login (at /host/login):
   Enter phone number (with or without +91) + PIN
   Example: +918802047517 with PIN 1234

═══════════════════════════════════════════════════════════════════
  `);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

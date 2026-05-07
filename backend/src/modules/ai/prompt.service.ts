import { Injectable } from '@nestjs/common';
import { Knowledge, Property, Reservation } from '@prisma/client';

@Injectable()
export class PromptService {
  buildSystemPrompt(
    property: Property | null,
    knowledge: Knowledge[] = [],
    reservation: Reservation | null = null,
  ): string {
    const basePrompt =
      'You are a helpful, friendly AI receptionist for a short-term rental property. ' +
      'Answer guest questions clearly and politely using only the property information you have been given. ' +
      'Never invent or guess information.\n\n' +
      'HANDOFF RULE: If you cannot confidently answer — the information is not in your knowledge base, ' +
      'the request requires a human decision, or involves something outside your capability — ' +
      'start your ENTIRE response with the token [HANDOFF] followed by a warm message to the guest. ' +
      'Example: [HANDOFF] Great question! Let me connect you with the host who can help you with that directly. ' +
      'Only use [HANDOFF] when truly needed. For anything you can answer from the provided information, answer directly.';

    if (!property) {
      return basePrompt;
    }

    const sections: string[] = [basePrompt];

    // Property facts
    const propertyFacts = [
      `Property: ${property.name}`,
      property.description ? `Description: ${property.description}` : null,
      property.address ? `Address: ${property.address}` : null,
      property.phone ? `Contact: ${property.phone}` : null,
      property.checkInTime ? `Check-in time: ${property.checkInTime}` : null,
      property.checkOutTime ? `Check-out time: ${property.checkOutTime}` : null,
      property.amenities.length > 0 ? `Amenities: ${property.amenities.join(', ')}` : null,
      property.policies.length > 0 ? `House rules: ${property.policies.join('; ')}` : null,
    ].filter(Boolean);

    sections.push(`Property details:\n${propertyFacts.join('\n')}`);

    // Dynamic knowledge (FAQs, custom Q&A)
    if (knowledge.length > 0) {
      const facts = knowledge.map((k) => `${k.key}: ${k.value}`).join('\n');
      sections.push(`Property knowledge:\n${facts}`);
    }

    // Active guest reservation — personalisation layer.
    // Intentionally excludes guestPhone and any other PII beyond name and dates.
    // Conversation messages are sanitised separately by PiiService before LLM calls.
    if (reservation) {
      const checkIn = this.formatDate(reservation.checkIn);
      const checkOut = this.formatDate(reservation.checkOut);
      const guestFacts = [
        `Guest name: ${reservation.guestName}`,
        `Check-in: ${checkIn}`,
        `Check-out: ${checkOut}`,
        reservation.guestCount > 1 ? `Number of guests: ${reservation.guestCount}` : null,
        reservation.notes ? `Notes: ${reservation.notes}` : null,
        // guestPhone deliberately omitted — never send contact details to the LLM
      ].filter(Boolean);

      sections.push(
        `Current guest reservation:\n${guestFacts.join('\n')}\n` +
        `Greet the guest by their first name when appropriate.`,
      );
    }

    return sections.join('\n\n');
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date));
  }
}

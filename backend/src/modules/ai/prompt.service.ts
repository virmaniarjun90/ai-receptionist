import { Injectable } from '@nestjs/common';
import { Knowledge, Property } from '@prisma/client';

@Injectable()
export class PromptService {
  buildSystemPrompt(
    property: Property | null,
    knowledge: Knowledge[] = [],
  ): string {
    const basePrompt =
      'You are a helpful hotel receptionist. Answer clearly, politely, and only using known property details when specific facts are requested.';

    if (!property) {
      return basePrompt;
    }

    const propertyFacts = [
      `Property: ${property.name}`,
      property.description ? `Description: ${property.description}` : null,
      property.address ? `Address: ${property.address}` : null,
      property.phone ? `Phone: ${property.phone}` : null,
      property.checkInTime ? `Check-in: ${property.checkInTime}` : null,
      property.checkOutTime ? `Check-out: ${property.checkOutTime}` : null,
      property.amenities.length > 0
        ? `Amenities: ${property.amenities.join(', ')}`
        : null,
      property.policies.length > 0
        ? `Policies: ${property.policies.join('; ')}`
        : null,
      knowledge.length > 0
        ? `Knowledge: ${knowledge
            .map((item) => `${item.key}: ${item.value}`)
            .join('; ')}`
        : null,
    ].filter(Boolean);

    return `${basePrompt}\n\nProperty context:\n${propertyFacts.join('\n')}`;
  }
}

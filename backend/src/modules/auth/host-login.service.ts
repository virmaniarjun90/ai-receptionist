import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HostLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(phone: string, pin: string): Promise<{ token: string; host: any } | null> {
    // Normalize: strip spaces/dashes, keep leading +
    const trimmed = phone.trim().replace(/[\s\-()]/g, '');
    const digits = trimmed.replace(/[^0-9]/g, '');
    // If user entered exactly 10 digits (no country code) assume +91 (India)
    // If they entered more digits or included a + prefix, use as-is
    const normalizedPhone = trimmed.startsWith('+')
      ? trimmed
      : digits.length === 10
        ? `+91${digits}`
        : `+${digits}`;

    // Some hosts stored with whatsapp: prefix, some without — match both
    const phoneVariants = [normalizedPhone, `whatsapp:${normalizedPhone}`];

    const host = await this.prisma.propertyHost.findFirst({
      where: { phone: { in: phoneVariants } },
      include: { property: true },
    });

    if (!host || !host.pinHash) return null;

    const pinMatch = await bcrypt.compare(pin, host.pinHash);
    if (!pinMatch) return null;

    // Get all properties for this host (by phone, since multiple properties possible)
    const properties = await this.prisma.propertyHost.findMany({
      where: { phone: { in: phoneVariants } },
      include: { property: true },
    });

    const token = this.jwt.sign(
      {
        phone: normalizedPhone,
        name: host.name,
        properties: properties.map((p) => ({ id: p.propertyId, name: p.property.name })),
      },
      { expiresIn: '24h' },
    );

    return {
      token,
      host: {
        phone: normalizedPhone,
        name: host.name,
        properties: properties.map((p) => ({ id: p.propertyId, name: p.property.name })),
      },
    };
  }
}

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
    // Normalize phone: strip spaces/slashes, extract digits, add +91
    const digits = phone.replace(/[^0-9]/g, '');
    const last10 = digits.slice(-10); // Get last 10 digits (in case user included country code)
    const normalizedPhone = `+91${last10}`;

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

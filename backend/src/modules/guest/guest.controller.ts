import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PropertyService } from '../property/property.service';
import { GuestService } from './guest.service';

@ApiTags('Guest')
@Controller('guest')
export class GuestController {
  constructor(
    private readonly guestService: GuestService,
    private readonly propertyService: PropertyService,
  ) {}

  @Get('register')
  @ApiOperation({ summary: 'Guest registration form (share this link with guests)' })
  async registrationForm(
    @Query('p') propertyId: string,
    @Res() res: Response,
  ): Promise<void> {
    let propertyName = 'the property';
    if (propertyId) {
      try {
        const prop = await this.propertyService.getById(propertyId);
        propertyName = prop.name;
      } catch {
        // unknown property — show generic form
      }
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(this.renderRegistrationForm(propertyId, propertyName));
  }

  @Post('register')
  @ApiOperation({ summary: 'Submit guest registration — returns JSON' })
  async register(
    @Body() body: {
      propertyId: string;
      guestName: string;
      guestPhone: string;
      checkIn: string;
      checkOut: string;
      guestCount?: string | number;
    },
    @Res() res: Response,
  ): Promise<void> {
    if (!body.propertyId || !body.guestName || !body.guestPhone || !body.checkIn || !body.checkOut) {
      throw new BadRequestException('propertyId, guestName, guestPhone, checkIn and checkOut are required');
    }

    const checkIn = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new BadRequestException('Invalid checkIn or checkOut date');
    }

    const { reservation, welcomeUrl } = await this.guestService.register({
      propertyId: body.propertyId,
      guestName: body.guestName,
      guestPhone: body.guestPhone.startsWith('whatsapp:') ? body.guestPhone : `whatsapp:${body.guestPhone}`,
      checkIn,
      checkOut,
      guestCount: body.guestCount ? Number(body.guestCount) : 1,
    });

    res.status(201).json({ reservationId: reservation.id, welcomeUrl });
  }

  @Get('welcome/:token')
  @ApiOperation({ summary: 'Guest welcome kit (expires at checkout)' })
  async welcomeKit(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.guestService.getWelcomeKit(token);
    res.setHeader('Content-Type', 'text/html');
    res.send(this.renderWelcomeKit(data));
  }

  // ─── HTML Templates ─────────────────────────────────────────────────────────

  private renderRegistrationForm(propertyId: string, propertyName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guest Registration — ${propertyName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Welcome to ${propertyName}</h1>
      <p class="mt-1 text-sm text-gray-500">Fill in your details and we'll send your welcome guide to WhatsApp.</p>
    </div>
    <form id="form" class="space-y-4">
      <input type="hidden" name="propertyId" value="${propertyId}" />
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input name="guestName" required placeholder="Jane Smith"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
        <input name="guestPhone" required placeholder="+1 234 567 8900" type="tel"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <p class="mt-1 text-xs text-gray-400">Include country code, e.g. +91 98765 43210</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
          <input name="checkIn" required type="datetime-local"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
          <input name="checkOut" required type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Number of guests</label>
        <input name="guestCount" type="number" min="1" max="20" value="1"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div id="error" class="hidden text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2"></div>
      <button type="submit" id="btn"
        class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors text-sm">
        Get my welcome guide →
      </button>
    </form>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      const err = document.getElementById('error');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      err.classList.add('hidden');
      const data = Object.fromEntries(new FormData(e.target));
      try {
        const res = await fetch('/guest/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || 'Registration failed');
        }
        const { welcomeUrl } = await res.json();
        const firstName = data.guestName.split(' ')[0];
        document.getElementById('form').outerHTML = \`
          <div class="text-center space-y-4">
            <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg class="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-900">You're all set, \${firstName}!</h2>
            <p class="text-sm text-gray-500">Your welcome guide has been sent to <strong>\${data.guestPhone}</strong> on WhatsApp.</p>
            <div class="p-4 bg-gray-50 rounded-xl text-left">
              <p class="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Your welcome guide link</p>
              <a href="\${welcomeUrl}" class="text-sm text-indigo-600 break-all hover:underline">\${welcomeUrl}</a>
            </div>
          </div>\`;
      } catch (ex) {
        err.textContent = ex.message || 'Something went wrong. Please try again.';
        err.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Get my welcome guide →';
      }
    });
  </script>
</body>
</html>`;
  }

  private renderWelcomeKit(data: Awaited<ReturnType<GuestService['getWelcomeKit']>>): string {
    const { property, reservation, knowledge, expired } = data;

    if (expired) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Link expired</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div class="text-center">
    <p class="text-5xl mb-4">🔒</p>
    <h1 class="text-xl font-bold text-gray-900">This link has expired</h1>
    <p class="mt-2 text-sm text-gray-500">Your welcome guide was only valid during your stay. Thank you for visiting!</p>
  </div>
</body>
</html>`;
    }

    const firstName = reservation.guestName.split(' ')[0];
    const checkIn = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date(reservation.checkIn));
    const checkOut = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date(reservation.checkOut));

    const knowledgeHtml = knowledge.map((k) => `
      <div class="border-b border-gray-100 py-3 last:border-0">
        <p class="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">${k.key.replace(/_/g, ' ')}</p>
        <p class="text-sm text-gray-700">${k.value}</p>
      </div>`).join('');

    const amenities = property.amenities?.length
      ? property.amenities.map((a) => `<span class="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">${a}</span>`).join(' ')
      : '';

    const policies = property.policies?.length
      ? `<ul class="list-disc list-inside space-y-1">${property.policies.map((p) => `<li class="text-sm text-gray-600">${p}</li>`).join('')}</ul>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${property.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
  <div class="max-w-lg mx-auto p-4 pb-12 space-y-4">
    <div class="bg-indigo-600 text-white rounded-2xl p-6 mt-4">
      <p class="text-indigo-200 text-sm">Welcome guide</p>
      <h1 class="text-2xl font-bold mt-1">${property.name}</h1>
      <p class="text-indigo-100 text-sm mt-1">Hi ${firstName}! Great to have you here.</p>
    </div>

    <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
      <h2 class="font-semibold text-gray-900">Your stay</h2>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="bg-gray-50 rounded-xl p-3">
          <p class="text-xs text-gray-400 mb-0.5">Check-in</p>
          <p class="font-medium text-gray-800">${checkIn}</p>
          ${property.checkInTime ? `<p class="text-xs text-indigo-600 mt-0.5">From ${property.checkInTime}</p>` : ''}
        </div>
        <div class="bg-gray-50 rounded-xl p-3">
          <p class="text-xs text-gray-400 mb-0.5">Check-out</p>
          <p class="font-medium text-gray-800">${checkOut}</p>
          ${property.checkOutTime ? `<p class="text-xs text-indigo-600 mt-0.5">By ${property.checkOutTime}</p>` : ''}
        </div>
      </div>
    </div>

    ${property.address ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 class="font-semibold text-gray-900 mb-1">Address</h2>
      <p class="text-sm text-gray-600">${property.address}</p>
    </div>` : ''}

    ${amenities ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 class="font-semibold text-gray-900 mb-2">Amenities</h2>
      <div class="flex flex-wrap gap-2">${amenities}</div>
    </div>` : ''}

    ${policies ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 class="font-semibold text-gray-900 mb-2">House rules</h2>
      ${policies}
    </div>` : ''}

    ${knowledge.length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 class="font-semibold text-gray-900 mb-1">Property guide</h2>
      ${knowledgeHtml}
    </div>` : ''}

    ${property.phoneNumber ? `
    <div class="bg-indigo-50 rounded-2xl p-5 text-center">
      <p class="text-sm font-medium text-indigo-800">Got a question?</p>
      <p class="text-sm text-indigo-600 mt-1">WhatsApp your AI assistant anytime:</p>
      <a href="https://wa.me/${property.phoneNumber.replace('whatsapp:+', '')}"
        class="inline-block mt-3 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
        Open WhatsApp
      </a>
    </div>` : ''}
  </div>
</body>
</html>`;
  }
}

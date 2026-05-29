/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WhatsAppConfig {
  enabled: boolean;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  templateText: string;
}

export interface WhatsAppReservationPayload {
  residentName: string;
  residentPhone: string;
  amenity: string;
  date: string;
  timeSlot: string;
  apartment: string;
  block: string;
}

const AMENITY_NAMES: Record<string, string> = {
  quadra: 'Quadra de Esportes',
  churrasqueira: 'Churrasqueira Coberta',
  salao: 'Salão de Festas',
};

function fillTemplate(template: string, data: WhatsAppReservationPayload): string {
  const dateFormatted = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const amenityName = AMENITY_NAMES[data.amenity] || data.amenity;
  const blockStr = data.block && data.block !== 'Único' ? ` / Bloco ${data.block}` : '';

  return template
    .replace(/\{morador\}/g, data.residentName)
    .replace(/\{local\}/g, amenityName)
    .replace(/\{data\}/g, dateFormatted)
    .replace(/\{hora\}/g, data.timeSlot)
    .replace(/\{apartamento\}/g, data.apartment)
    .replace(/\{bloco\}/g, data.block || 'Único')
    .replace(/\{unidade\}/g, `Apto ${data.apartment}${blockStr}`);
}

function normalizePhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');
  // Se não tem código de país, adiciona 55 (Brasil)
  if (digits.length <= 11) {
    return '55' + digits;
  }
  return digits;
}

export async function sendWhatsAppReservationNotification(
  config: WhatsAppConfig,
  payload: WhatsAppReservationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!config.enabled) {
    return { success: false, error: 'WhatsApp notifications are disabled' };
  }

  if (!payload.residentPhone) {
    return { success: false, error: 'Resident has no phone number registered' };
  }

  const message = fillTemplate(config.templateText, payload);
  const phone = normalizePhone(payload.residentPhone);

  try {
    const url = `${config.evolutionApiUrl.replace(/\/$/, '')}/message/sendText/${config.instanceName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolutionApiKey,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Evolution API error ${response.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error sending WhatsApp' };
  }
}

export const DEFAULT_TEMPLATE =
  `🏠 *Reserva Confirmada!*\n\nOlá, {morador}! Sua reserva no *{local}* foi confirmada com sucesso.\n\n📅 *Data:* {data}\n⏰ *Horário:* {hora}\n🏢 *Unidade:* {unidade}\n\nEm caso de dúvidas, entre em contato com a administração do condomínio.`;

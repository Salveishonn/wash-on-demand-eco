/**
 * WhatsApp Cloud API utilities
 * Shared across all Edge Functions
 */

import { normalizePhoneForMeta, validatePhoneForWhatsApp } from './phoneUtils.ts';

// Known templates with their expected parameter counts
// CRITICAL: These must match EXACTLY what's registered in Meta WhatsApp Manager
export const TEMPLATE_CONFIG: Record<string, { 
  paramCount: number; 
  description: string;
}> = {
  // Booking-related templates
  'washero_on_the_way_u01': { paramCount: 2, description: 'name, datetime+address' },
  'washero_booking_confirmed_u01': { paramCount: 3, description: 'name, datetime, address' },
  'washero_reschedule_request': { paramCount: 1, description: 'name' },
  
  // Subscription templates  
  'washero_subscription_active': { paramCount: 3, description: 'name, plan, washes' },
  
  // General templates
  'washero_on_the_way': { paramCount: 2, description: 'name, info' },
  'washero_arriving_10_min': { paramCount: 2, description: 'name, info' },
  'washero_arrived': { paramCount: 1, description: 'name' },
  'washero_booking_confirmed': { paramCount: 3, description: 'name, date, time' },
  'washero_payment_instructions': { paramCount: 2, description: 'name, link' },
};

/**
 * Sanitize template parameters - ensure no null/undefined/empty values
 * Replace with safe fallback if needed
 */
export function sanitizeTemplateParams(
  params: (string | null | undefined)[],
  expectedCount: number
): string[] {
  const result: string[] = [];
  
  for (let i = 0; i < expectedCount; i++) {
    const value = params[i];
    if (value === null || value === undefined || value === '') {
      // Use safe fallback
      result.push('N/D');
    } else {
      result.push(String(value).trim());
    }
  }
  
  return result;
}

export interface SendTemplateResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number;
  debugInfo: {
    phone: string;
    phoneForMeta: string;
    templateName: string;
    languageCode: string;
    paramCount: number;
    params: string[];
    rawResponse?: unknown;
  };
}

/**
 * Send a WhatsApp template message via Meta Cloud API
 */
export async function sendWhatsAppTemplate(options: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  params: (string | null | undefined)[];
  languageCode?: string;
}): Promise<SendTemplateResult> {
  const { accessToken, phoneNumberId, to, templateName, params, languageCode = 'es_AR' } = options;
  
  // Validate phone
  const phoneValidation = validatePhoneForWhatsApp(to);
  if (!phoneValidation.valid) {
    return {
      success: false,
      error: `Invalid phone: ${phoneValidation.error}`,
      debugInfo: {
        phone: to,
        phoneForMeta: phoneValidation.forMeta,
        templateName,
        languageCode,
        paramCount: params.length,
        params: params.map(p => p ?? 'null'),
      },
    };
  }
  
  // Get expected param count from config, fallback to provided count
  const templateConfig = TEMPLATE_CONFIG[templateName];
  const expectedParamCount = templateConfig?.paramCount ?? params.length;
  
  // Sanitize parameters
  const sanitizedParams = sanitizeTemplateParams(params, expectedParamCount);
  
  // Build request body
  const components = sanitizedParams.length > 0 ? [
    {
      type: 'body',
      parameters: sanitizedParams.map(text => ({ type: 'text', text })),
    },
  ] : undefined;
  
  const requestBody = {
    messaging_product: 'whatsapp',
    to: phoneValidation.forMeta,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };
  
  const debugInfo: SendTemplateResult['debugInfo'] = {
    phone: to,
    phoneForMeta: phoneValidation.forMeta,
    templateName,
    languageCode,
    paramCount: sanitizedParams.length,
    params: sanitizedParams,
  };
  
  console.log('[whatsapp-utils] Sending template:', JSON.stringify({
    to: phoneValidation.forMeta,
    template: templateName,
    language: languageCode,
    params: sanitizedParams,
  }));
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    const result = await response.json();
    debugInfo.rawResponse = result;
    
    if (response.ok && result.messages?.[0]?.id) {
      console.log('[whatsapp-utils] SUCCESS - Message ID:', result.messages[0].id);
      return {
        success: true,
        messageId: result.messages[0].id,
        debugInfo,
      };
    }
    
    // Handle error
    const errorCode = result.error?.code || response.status;
    const errorMessage = result.error?.message || 'Unknown Meta API error';
    const errorData = result.error?.error_data;
    
    console.error('[whatsapp-utils] FAILED:', JSON.stringify({
      code: errorCode,
      message: errorMessage,
      error_data: errorData,
      request: { to: phoneValidation.forMeta, template: templateName, params: sanitizedParams },
    }));
    
    return {
      success: false,
      error: `META ${errorCode}: ${errorMessage}`,
      errorCode,
      debugInfo,
    };
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[whatsapp-utils] Exception:', errorMessage);
    return {
      success: false,
      error: `Network error: ${errorMessage}`,
      debugInfo,
    };
  }
}

/**
 * Send a free-form text message via Meta Cloud API
 * Only works within 24h of customer's last message
 */
export async function sendWhatsAppText(options: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}): Promise<SendTemplateResult> {
  const { accessToken, phoneNumberId, to, text } = options;
  
  // Validate phone
  const phoneValidation = validatePhoneForWhatsApp(to);
  if (!phoneValidation.valid) {
    return {
      success: false,
      error: `Invalid phone: ${phoneValidation.error}`,
      debugInfo: {
        phone: to,
        phoneForMeta: phoneValidation.forMeta,
        templateName: '[text]',
        languageCode: 'n/a',
        paramCount: 0,
        params: [],
      },
    };
  }
  
  const requestBody = {
    messaging_product: 'whatsapp',
    to: phoneValidation.forMeta,
    type: 'text',
    text: { body: text },
  };
  
  const debugInfo: SendTemplateResult['debugInfo'] = {
    phone: to,
    phoneForMeta: phoneValidation.forMeta,
    templateName: '[text]',
    languageCode: 'n/a',
    paramCount: 0,
    params: [text.substring(0, 50)],
  };
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    const result = await response.json();
    debugInfo.rawResponse = result;
    
    if (response.ok && result.messages?.[0]?.id) {
      return {
        success: true,
        messageId: result.messages[0].id,
        debugInfo,
      };
    }
    
    const errorCode = result.error?.code || response.status;
    const errorMessage = result.error?.message || 'Unknown Meta API error';
    
    return {
      success: false,
      error: `META ${errorCode}: ${errorMessage}`,
      errorCode,
      debugInfo,
    };
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Network error: ${errorMessage}`,
      debugInfo,
    };
  }
}

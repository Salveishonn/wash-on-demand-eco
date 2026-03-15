/**
 * WhatsApp Template Automation - Queue & Log
 * Inserts template send into whatsapp_outbox and logs to whatsapp_template_logs.
 */

import { resolveTemplate } from './templateMap.ts';
import type { TemplateContext } from './templateMap.ts';

interface QueueResult {
  queued: boolean;
  outboxId?: string;
  logId?: string;
  templateName?: string;
  error?: string;
}

/**
 * Normalize phone to E.164 for Argentina
 */
function normalizePhoneE164(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) cleaned = cleaned.substring(1);

  if (cleaned.startsWith('549') && cleaned.length >= 12) return '+' + cleaned;
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    if (rest.startsWith('11') || rest.startsWith('15') || rest.length === 10) {
      let mobile = rest;
      if (mobile.startsWith('15')) mobile = mobile.substring(2);
      return '+549' + mobile;
    }
    return '+54' + rest;
  }
  if (cleaned.startsWith('15') && cleaned.length >= 8) return '+54911' + cleaned.substring(2);
  if (cleaned.startsWith('11') && cleaned.length >= 10) return '+549' + cleaned;
  if (cleaned.startsWith('9') && cleaned.length >= 10) return '+54' + cleaned;
  if (cleaned.length === 10) return '+549' + cleaned;
  if (cleaned.length === 8) return '+54911' + cleaned;
  if (cleaned.length >= 8 && cleaned.length <= 12 && !cleaned.startsWith('54')) return '+54' + cleaned;
  return '+' + cleaned;
}

/**
 * Queue a WhatsApp template send for a given event.
 *
 * @param supabase - Supabase client (service role)
 * @param eventType - System event type (e.g. 'booking_created')
 * @param ctx - Template context with customer data
 * @param entityType - 'reservation' | 'subscription' | 'manual'
 * @param entityId - booking or subscription ID
 */
export async function queueTemplateSend(
  supabase: any,
  eventType: string,
  ctx: TemplateContext,
  entityType: 'reservation' | 'subscription' | 'manual' = 'manual',
  entityId?: string,
): Promise<QueueResult> {
  const tag = '[whatsapp-automation]';

  // 1. Resolve template
  const mapping = resolveTemplate(eventType);
  if (!mapping) {
    console.warn(`${tag} No template mapping for event: ${eventType}`);
    return { queued: false, error: `No template mapping for event: ${eventType}` };
  }

  // 2. Validate phone
  const phoneE164 = normalizePhoneE164(ctx.customerPhone);
  const digits = phoneE164.replace(/[^0-9]/g, '');
  if (digits.length < 10 || !digits.startsWith('54')) {
    const err = `Invalid phone: ${ctx.customerPhone} -> ${phoneE164}`;
    console.error(`${tag} ${err}`);

    // Log the failure
    await supabase.from('whatsapp_template_logs').insert({
      event_type: eventType,
      template_name: mapping.templateName,
      language_code: mapping.languageCode,
      customer_phone: ctx.customerPhone,
      template_vars: [],
      booking_id: entityType === 'reservation' ? entityId : null,
      subscription_id: entityType === 'subscription' ? entityId : null,
      status: 'failed',
      error_message: err,
    });

    return { queued: false, templateName: mapping.templateName, error: err };
  }

  // 3. Build variables
  const vars = mapping.buildVars(ctx);
  console.log(`${tag} Event: ${eventType} -> Template: ${mapping.templateName}`, {
    phone: phoneE164,
    vars,
  });

  // 4. Insert into outbox
  const { data: outboxEntry, error: outboxError } = await supabase
    .from('whatsapp_outbox')
    .insert({
      entity_type: entityType,
      entity_id: entityId || null,
      customer_id: null,
      to_phone_e164: phoneE164,
      template_name: mapping.templateName,
      language_code: mapping.languageCode,
      template_vars: vars,
      status: 'queued',
    })
    .select('id')
    .single();

  if (outboxError) {
    console.error(`${tag} Outbox insert error:`, outboxError);

    await supabase.from('whatsapp_template_logs').insert({
      event_type: eventType,
      template_name: mapping.templateName,
      language_code: mapping.languageCode,
      customer_phone: phoneE164,
      template_vars: vars,
      booking_id: entityType === 'reservation' ? entityId : null,
      subscription_id: entityType === 'subscription' ? entityId : null,
      status: 'failed',
      error_message: `Outbox insert failed: ${outboxError.message}`,
    });

    return { queued: false, templateName: mapping.templateName, error: outboxError.message };
  }

  // 5. Log the send attempt
  const { data: logEntry } = await supabase
    .from('whatsapp_template_logs')
    .insert({
      event_type: eventType,
      template_name: mapping.templateName,
      language_code: mapping.languageCode,
      customer_phone: phoneE164,
      template_vars: vars,
      booking_id: entityType === 'reservation' ? entityId : null,
      subscription_id: entityType === 'subscription' ? entityId : null,
      outbox_id: outboxEntry.id,
      status: 'queued',
    })
    .select('id')
    .single();

  console.log(`${tag} Queued: outbox=${outboxEntry.id}, log=${logEntry?.id}`);

  return {
    queued: true,
    outboxId: outboxEntry.id,
    logId: logEntry?.id,
    templateName: mapping.templateName,
  };
}

/**
 * Trigger processing of the outbox immediately (fire & forget).
 */
export function triggerOutboxProcessing(supabaseUrl: string, serviceKey: string): void {
  fetch(`${supabaseUrl}/functions/v1/whatsapp-process-outbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({}),
  }).catch((e) => console.error('[whatsapp-automation] Outbox trigger error:', e));
}

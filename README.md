# Washero - Premium Mobile Car Wash

Premium on-demand car wash service in Buenos Aires, Argentina.

## MercadoPago Integration

### Setup

1. **Environment Variables (Secrets)**
   - `MERCADOPAGO_ACCESS_TOKEN`: Your MP access token from [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel)
   - `MERCADOPAGO_ENV`: Set to `sandbox` for testing, `production` for live payments

### Testing with MercadoPago Sandbox

#### Step 1: Create Test Users
1. Go to [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel)
2. Navigate to "Test accounts" (Cuentas de prueba)
3. Create two test accounts:
   - **Seller account**: Use this account's Access Token as `MERCADOPAGO_ACCESS_TOKEN`
   - **Buyer account**: Use this to make test payments

#### Step 2: Get Test Credentials
1. Log in to your test SELLER account
2. Go to Developer settings → Credentials
3. Copy the **Access Token** for sandbox testing
4. Add it as `MERCADOPAGO_ACCESS_TOKEN` in Lovable secrets

#### Step 3: Test a Payment
1. In Washero Admin Panel (/admin), click "Test MP Payment"
2. This creates a preference with $1 ARS test amount
3. A new tab opens with MercadoPago checkout
4. Log in with your test BUYER account
5. Use test card details:
   - **Visa**: 4509 9535 6623 3704
   - **CVV**: 123
   - **Expiry**: Any future date
   - **Name**: APRO (for approved payments)
   - **Document**: Any valid DNI

#### Step 4: Verify Webhook
After payment, the webhook should:
1. Receive notification from MercadoPago
2. Fetch payment details
3. Update booking status to "confirmed"
4. Update payment_status to "approved"
5. Queue confirmation notifications

Check webhook_logs table to see received webhooks.

### Production Deployment

1. Update `MERCADOPAGO_ENV` secret to `production`
2. Replace `MERCADOPAGO_ACCESS_TOKEN` with production credentials
3. Verify washero.online domain in MercadoPago

### Webhook URL
```
https://pkndizbozytnpgqxymms.supabase.co/functions/v1/mercadopago-webhook
```

### Back URLs (configured automatically)
- Success: `https://washero.online/reserva-confirmada?booking_id=...`
- Failure: `https://washero.online/reservar?error=payment_failed`
- Pending: `https://washero.online/reserva-confirmada?booking_id=...&status=pending`

---

## Notification System

### Email
- Provider: Resend
- From: `Washero <reservas@washero.online>`
- Verify domain at resend.com

### WhatsApp
- Provider: Twilio
- Mode: `sandbox` or `production`
- Sandbox sends to admin only
- Production requires Twilio WhatsApp approval

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `create-booking` | Creates new booking records |
| `create-mercadopago-preference` | Creates MP checkout preference |
| `mercadopago-webhook` | Receives MP payment notifications |
| `create-subscription` | Creates MP subscription (preapproval) |
| `subscription-webhook` | Handles subscription events |
| `queue-notifications` | Queues email/WhatsApp for processing |
| `process-notifications` | Sends queued notifications |
| `send-notifications` | Direct notification sending + tests |

---

## Development

This project is built with:
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (via Lovable Cloud)

### Local Development

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm i
npm run dev
```

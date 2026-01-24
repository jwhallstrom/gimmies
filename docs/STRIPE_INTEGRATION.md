# Stripe Payment Integration Guide

This document outlines how to integrate Stripe payments into Gimmies Tournaments using AWS Amplify.

## Overview

The payment flow:
1. User clicks "Register Now" → Registration modal opens
2. User fills profile → selects division → chooses games → selects payment method
3. If "Pay Now with Card" selected:
   - Frontend calls Amplify Lambda to create a PaymentIntent
   - Stripe Elements form collects card details (client-side, PCI compliant)
   - Frontend confirms payment with Stripe.js
   - On success, registration is created with `paymentStatus: 'paid'`
4. If "Pay Cash" selected:
   - Registration created immediately with `paymentStatus: 'pending'`
   - Organizer manually marks as paid later

## Prerequisites

1. **Stripe Account**: Create at [dashboard.stripe.com](https://dashboard.stripe.com)
2. **AWS Amplify**: Already configured in this project
3. **Environment Variables**: Configure in `.env`

## Setup Steps

### 1. Get Stripe API Keys

From Stripe Dashboard → Developers → API Keys:
- **Publishable key** (starts with `pk_`) - Safe for client-side
- **Secret key** (starts with `sk_`) - Server-side only, NEVER expose

### 2. Configure Environment Variables

Add to `.env`:
```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
VITE_PAYMENTS_API_ENDPOINT=/api/payments

# For Lambda (in Amplify console or .env.local)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

### 3. Install Stripe.js

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 4. Create Amplify Lambda Function

Create a new Lambda function for payment processing:

**amplify/functions/payments/resource.ts:**
```typescript
import { defineFunction } from '@aws-amplify/backend';

export const paymentsFunction = defineFunction({
  name: 'payments',
  entry: './handler.ts',
  environment: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  },
});
```

**amplify/functions/payments/handler.ts:**
```typescript
import Stripe from 'stripe';
import type { APIGatewayProxyHandler } from 'aws-lambda';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // Create PaymentIntent
    if (path.endsWith('/create-intent') && event.httpMethod === 'POST') {
      const { amount, currency = 'usd', description, metadata } = body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount, // in cents
        currency,
        description,
        metadata,
        automatic_payment_methods: { enabled: true },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
          },
        }),
      };
    }

    // Process refund
    if (path.endsWith('/refund') && event.httpMethod === 'POST') {
      const { paymentIntentId, amountCents, reason } = body;

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents, // Optional: omit for full refund
        reason: reason || 'requested_by_customer',
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ refundId: refund.id }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error: any) {
    console.error('Payment error:', error);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### 5. Add API Route

**amplify/backend.ts** (add to existing):
```typescript
import { paymentsFunction } from './functions/payments/resource';

// Add to backend definition
export const backend = defineBackend({
  // ... existing resources
  paymentsFunction,
});

// Add API Gateway route
backend.addApiRoute({
  path: '/api/payments/{proxy+}',
  function: paymentsFunction,
  methods: ['POST', 'OPTIONS'],
});
```

### 6. Update Registration Modal

In `TournamentRegistrationModal.tsx`, update the payment step to use real Stripe:

```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createPaymentIntent, getElementsConfig } from '../../adapters/payments';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// In the payment step:
const handleCardPayment = async () => {
  setIsProcessing(true);
  
  // 1. Create PaymentIntent on server
  const { success, paymentIntent, error } = await createPaymentIntent({
    amountCents: tournament.entryFeeCents,
    description: `Tournament entry: ${tournament.name}`,
    metadata: {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      profileId: currentProfile.id,
      golferName: data.displayName,
    },
  });
  
  if (!success || !paymentIntent) {
    setPaymentError(error || 'Failed to initialize payment');
    setIsProcessing(false);
    return;
  }
  
  // 2. Confirm with Stripe.js
  const stripe = await stripePromise;
  const { error: confirmError, paymentIntent: confirmedIntent } = 
    await stripe!.confirmCardPayment(paymentIntent.clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)!,
        billing_details: { name: data.displayName, email: data.email },
      },
    });
  
  if (confirmError) {
    setPaymentError(confirmError.message || 'Payment failed');
    setIsProcessing(false);
    return;
  }
  
  // 3. Success! Create registration
  if (confirmedIntent.status === 'succeeded') {
    // Registration is created with paymentStatus: 'paid'
  }
};
```

### 7. Add Stripe Card Element

Replace the placeholder card form with Stripe Elements:

```tsx
import { CardElement } from '@stripe/react-stripe-js';

// In the payment section:
<div className="mt-4">
  <Elements stripe={stripePromise} options={getElementsConfig(clientSecret)}>
    <CardElement
      options={{
        style: {
          base: {
            fontSize: '16px',
            color: '#1f2937',
            '::placeholder': { color: '#9ca3af' },
          },
        },
      }}
    />
  </Elements>
</div>
```

## Webhook Setup (Production)

For production, set up webhooks to handle async events:

1. **Stripe Dashboard** → Webhooks → Add endpoint
2. URL: `https://your-api.amplifyapp.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

**Lambda webhook handler:**
```typescript
// Verify webhook signature
const sig = event.headers['stripe-signature'];
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let stripeEvent;
try {
  stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
} catch (err) {
  return { statusCode: 400, body: 'Webhook signature verification failed' };
}

// Handle events
switch (stripeEvent.type) {
  case 'payment_intent.succeeded':
    // Update registration status in DynamoDB
    break;
  case 'payment_intent.payment_failed':
    // Notify user, log failure
    break;
  case 'charge.refunded':
    // Update registration status to 'refunded'
    break;
}
```

## Testing

### Test Mode
Use Stripe test mode keys (start with `pk_test_` and `sk_test_`).

### Test Card Numbers
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`
- **Any future date, any CVC, any ZIP**

### Local Testing
1. Install Stripe CLI: `stripe login`
2. Forward webhooks: `stripe listen --forward-to localhost:3000/api/payments/webhook`

## Security Checklist

- [ ] Never log or store full card numbers
- [ ] Use HTTPS in production
- [ ] Validate webhook signatures
- [ ] Store `STRIPE_SECRET_KEY` in Amplify environment variables (not in code)
- [ ] Use separate test/live keys
- [ ] Enable Stripe Radar for fraud detection

## Cost Considerations

Stripe fees (US):
- **2.9% + $0.30** per successful charge
- No monthly fees
- Volume discounts available

Example: $50 tournament entry → $1.75 fee → Organizer nets $48.25

## Alternative: Stripe Payment Links

For simpler setup without Lambda:

1. Create Payment Link in Stripe Dashboard
2. Store link URL in tournament settings
3. Open link in new tab when user clicks "Pay Now"
4. Manual reconciliation (check Stripe Dashboard)

```typescript
// Simple approach - open Stripe Payment Link
const handlePayWithLink = () => {
  window.open(tournament.stripePaymentLink, '_blank');
  // Show "I've Paid" button for manual confirmation
};
```

## Next Steps

1. Set up Stripe account and get API keys
2. Deploy Lambda function with `npx ampx push`
3. Test with test cards
4. Switch to live keys for production
5. (Optional) Add webhooks for real-time status updates

---

*Last updated: January 2026*

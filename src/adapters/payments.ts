/**
 * Payment Adapter - Stripe Integration for Tournament Payments
 * 
 * This adapter provides a clean interface for payment processing.
 * It's designed to work with AWS Amplify Lambda functions for secure server-side Stripe calls.
 * 
 * SETUP REQUIRED:
 * 1. Create Stripe account at https://dashboard.stripe.com
 * 2. Get API keys (publishable + secret)
 * 3. Add Lambda function for payment intents (see docs below)
 * 4. Configure environment variables
 * 5. Install Stripe.js: npm install @stripe/stripe-js
 */

// Type declaration for optional @stripe/stripe-js dependency
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // Stripe.js types (loaded dynamically)
  interface Window {
    Stripe?: any;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number; // in cents
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentRequest {
  amountCents: number;
  currency?: string;
  description?: string;
  metadata?: {
    tournamentId: string;
    tournamentName: string;
    profileId: string;
    golferName: string;
  };
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  paymentIntent?: PaymentIntent;
  error?: string;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  status?: string;
  error?: string;
}

export interface RefundRequest {
  paymentIntentId: string;
  amountCents?: number; // Optional for partial refunds
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

// Stripe publishable key (safe to expose in client)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// API endpoint for Lambda function (Amplify API Gateway)
const PAYMENTS_API_ENDPOINT = import.meta.env.VITE_PAYMENTS_API_ENDPOINT || '/api/payments';

// Check if Stripe is configured
export const isStripeConfigured = (): boolean => {
  return Boolean(STRIPE_PUBLISHABLE_KEY);
};

// ============================================================================
// Stripe.js Loading
// ============================================================================

let stripePromise: Promise<any> | null = null;

/**
 * Lazily load Stripe.js SDK
 * Only loads when payment is actually needed
 * 
 * Note: Requires @stripe/stripe-js package to be installed:
 * npm install @stripe/stripe-js
 */
export const getStripe = async (): Promise<any> => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Stripe publishable key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your .env file.');
  }
  
  if (!stripePromise) {
    try {
      // Dynamically import Stripe.js - fails gracefully if not installed
      // Using variable to prevent TypeScript from trying to resolve at compile time
      const stripePkg = '@stripe/stripe-js';
      const stripeModule = await import(/* @vite-ignore */ stripePkg);
      stripePromise = stripeModule.loadStripe(STRIPE_PUBLISHABLE_KEY);
    } catch (error) {
      console.warn('Stripe.js not installed. Run: npm install @stripe/stripe-js');
      throw new Error('Stripe.js package not installed. See docs/STRIPE_INTEGRATION.md for setup instructions.');
    }
  }
  
  return stripePromise;
};

// ============================================================================
// Payment Intent API (calls Amplify Lambda)
// ============================================================================

/**
 * Create a PaymentIntent on the server
 * This calls your Amplify Lambda function which uses the Stripe secret key
 */
export const createPaymentIntent = async (
  request: CreatePaymentIntentRequest
): Promise<CreatePaymentIntentResponse> => {
  try {
    // In production, this calls your Amplify API Gateway -> Lambda
    const response = await fetch(`${PAYMENTS_API_ENDPOINT}/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if using Amplify Auth
        // 'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({
        amount: request.amountCents,
        currency: request.currency || 'usd',
        description: request.description,
        metadata: request.metadata,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Failed to create payment intent' };
    }
    
    const data = await response.json();
    return {
      success: true,
      paymentIntent: data.paymentIntent,
    };
  } catch (error: any) {
    console.error('Create payment intent error:', error);
    return { success: false, error: error.message || 'Payment service unavailable' };
  }
};

/**
 * Confirm a PaymentIntent with a payment method
 * Usually done client-side with Stripe.js confirmCardPayment
 */
export const confirmPayment = async (
  request: ConfirmPaymentRequest
): Promise<ConfirmPaymentResponse> => {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      return { success: false, error: 'Stripe not loaded' };
    }
    
    // Get the payment intent's client secret from your backend
    // Then confirm with Stripe.js
    const { error, paymentIntent } = await stripe.confirmCardPayment(request.paymentIntentId, {
      payment_method: request.paymentMethodId,
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, status: paymentIntent?.status };
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    return { success: false, error: error.message || 'Payment confirmation failed' };
  }
};

/**
 * Request a refund for a payment
 * Calls your Amplify Lambda function
 */
export const requestRefund = async (request: RefundRequest): Promise<RefundResponse> => {
  try {
    const response = await fetch(`${PAYMENTS_API_ENDPOINT}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Refund failed' };
    }
    
    const data = await response.json();
    return { success: true, refundId: data.refundId };
  } catch (error: any) {
    console.error('Refund error:', error);
    return { success: false, error: error.message || 'Refund service unavailable' };
  }
};

// ============================================================================
// Stripe Elements Components Helper
// ============================================================================

export interface StripeElementsConfig {
  clientSecret: string;
  appearance?: {
    theme?: 'stripe' | 'night' | 'flat';
    variables?: {
      colorPrimary?: string;
      colorBackground?: string;
      colorText?: string;
      fontFamily?: string;
      borderRadius?: string;
    };
  };
}

/**
 * Get Stripe Elements configuration for consistent styling
 */
export const getElementsConfig = (clientSecret: string): StripeElementsConfig => ({
  clientSecret,
  appearance: {
    theme: 'stripe',
    variables: {
      colorPrimary: '#1561AE', // Gimmies primary
      colorText: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderRadius: '12px',
    },
  },
});

// ============================================================================
// Mock Payment (Development Only)
// ============================================================================

/**
 * Mock payment for development/testing
 * Returns success after a delay to simulate processing
 */
export const mockPayment = async (amountCents: number): Promise<CreatePaymentIntentResponse> => {
  if (import.meta.env.PROD) {
    throw new Error('Mock payments not available in production');
  }
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate occasional failures for testing
  if (Math.random() < 0.1) {
    return { success: false, error: 'Card declined (test failure)' };
  }
  
  return {
    success: true,
    paymentIntent: {
      id: `mock_pi_${Date.now()}`,
      clientSecret: `mock_secret_${Date.now()}`,
      amount: amountCents,
      currency: 'usd',
      status: 'succeeded',
    },
  };
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format amount in cents to display string
 */
export const formatAmount = (cents: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
};

/**
 * Validate card number format (basic check)
 */
export const isValidCardNumber = (number: string): boolean => {
  const cleaned = number.replace(/\s/g, '');
  return /^\d{13,19}$/.test(cleaned);
};

/**
 * Get card brand from number prefix
 */
export const getCardBrand = (number: string): string => {
  const cleaned = number.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  return 'unknown';
};

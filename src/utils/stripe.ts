/**
 * Stripe Integration Utilities
 * 
 * Handles Stripe Connect for club accounts:
 * - Connect onboarding for clubs
 * - Entry fee collection
 * - Prize payout distribution
 * 
 * NOTE: In production, sensitive operations (creating payment intents,
 * transfers, etc.) should be handled by a secure backend API.
 * This file provides the client-side utilities and types.
 */

import type { Club, TournamentPayment, TournamentPayout } from '../state/types';

// Stripe publishable key (public, safe for client)
// In production, load from environment variable
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_xxx';

// Platform fee percentage (what Gimmies takes)
const PLATFORM_FEE_PERCENT = 2.5;

/**
 * Calculate platform fee for a given amount
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

/**
 * Calculate the amount a club receives after platform fee
 */
export function calculateClubReceives(amountCents: number): number {
  const fee = calculatePlatformFee(amountCents);
  return amountCents - fee;
}

/**
 * Format cents to display currency
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

/**
 * Stripe Connect Account Types
 */
export type ConnectAccountType = 'standard' | 'express' | 'custom';

/**
 * Stripe Connect onboarding link parameters
 */
export interface ConnectOnboardingParams {
  clubId: string;
  clubName: string;
  email: string;
  returnUrl: string;
  refreshUrl: string;
  accountType?: ConnectAccountType;
}

/**
 * Create a Stripe Connect account link for onboarding
 * 
 * NOTE: In production, this should call your backend API which will:
 * 1. Create a Connected Account using Stripe's API
 * 2. Generate an Account Link for onboarding
 * 3. Return the URL to redirect the user to
 */
export async function createConnectOnboardingLink(params: ConnectOnboardingParams): Promise<string> {
  // In production, this would be an API call to your backend:
  // const response = await fetch('/api/stripe/connect/onboarding', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(params),
  // });
  // const { url } = await response.json();
  // return url;
  
  // For now, return a placeholder
  console.log('Creating Connect onboarding link for:', params);
  return `https://connect.stripe.com/express/oauth/authorize?redirect_uri=${encodeURIComponent(params.returnUrl)}&client_id=ca_xxx&state=${params.clubId}`;
}

/**
 * Check the status of a Stripe Connect account
 */
export interface ConnectAccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requiresAction: boolean;
  currentlyDue: string[];
}

export async function getConnectAccountStatus(accountId: string): Promise<ConnectAccountStatus> {
  // In production, this would be an API call to your backend
  // which would fetch the account status from Stripe
  
  console.log('Checking Connect account status for:', accountId);
  
  // Mock response
  return {
    accountId,
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    requiresAction: false,
    currentlyDue: [],
  };
}

/**
 * Create a Payment Intent for tournament entry fee
 */
export interface CreatePaymentIntentParams {
  tournamentId: string;
  registrationId: string;
  amountCents: number;
  currency: string;
  clubStripeAccountId: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  platformFeeCents: number;
}

export async function createEntryFeePaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
  // In production, this would call your backend API:
  // const response = await fetch('/api/stripe/payment-intent', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(params),
  // });
  // return response.json();
  
  const platformFee = calculatePlatformFee(params.amountCents);
  
  console.log('Creating payment intent:', {
    ...params,
    platformFeeCents: platformFee,
  });
  
  // Mock response
  return {
    clientSecret: 'pi_xxx_secret_xxx',
    paymentIntentId: 'pi_xxx',
    amountCents: params.amountCents,
    platformFeeCents: platformFee,
  };
}

/**
 * Process a refund for a tournament registration
 */
export interface RefundParams {
  paymentIntentId: string;
  amountCents?: number; // Partial refund if specified
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'tournament_cancelled';
}

export async function processRefund(params: RefundParams): Promise<{ refundId: string; status: string }> {
  // In production, this would call your backend API
  console.log('Processing refund:', params);
  
  return {
    refundId: 're_xxx',
    status: 'succeeded',
  };
}

/**
 * Create a transfer/payout to a player
 */
export interface CreatePayoutParams {
  tournamentId: string;
  clubStripeAccountId: string;
  recipientStripeAccountId?: string; // If player has Stripe Express account
  recipientEmail?: string;
  amountCents: number;
  description: string;
  metadata?: Record<string, string>;
}

export async function createPrizeTransfer(params: CreatePayoutParams): Promise<{ transferId: string; status: string }> {
  // In production, this would call your backend API
  // Options for payouts:
  // 1. Stripe Transfer (if recipient has Express account)
  // 2. Stripe Issuing (virtual card)
  // 3. External system (Venmo, PayPal, etc.)
  // 4. Check/Cash (manual confirmation)
  
  console.log('Creating prize transfer:', params);
  
  return {
    transferId: 'tr_xxx',
    status: 'pending',
  };
}

/**
 * Generate a summary of tournament finances
 */
export interface TournamentFinanceSummary {
  tournamentId: string;
  totalEntryFees: number;
  totalPlatformFees: number;
  totalPrizePool: number;
  totalPayouts: number;
  netToClub: number;
  registrationCount: number;
  paidCount: number;
  refundedCount: number;
}

export function calculateTournamentFinances(
  entryFeeCents: number,
  registrations: { paymentStatus: string }[],
  payouts: TournamentPayout[]
): TournamentFinanceSummary {
  const paidRegistrations = registrations.filter(r => r.paymentStatus === 'paid');
  const refundedRegistrations = registrations.filter(r => r.paymentStatus === 'refunded');
  
  const totalEntryFees = paidRegistrations.length * entryFeeCents;
  const totalPlatformFees = calculatePlatformFee(totalEntryFees);
  const totalPrizePool = totalEntryFees - totalPlatformFees;
  const totalPayouts = payouts.reduce((sum, p) => sum + p.grossAmountCents, 0);
  
  return {
    tournamentId: '',
    totalEntryFees,
    totalPlatformFees,
    totalPrizePool,
    totalPayouts,
    netToClub: totalPrizePool - totalPayouts,
    registrationCount: registrations.length,
    paidCount: paidRegistrations.length,
    refundedCount: refundedRegistrations.length,
  };
}

/**
 * Stripe Elements configuration for payment forms
 */
export function getStripeElementsConfig() {
  return {
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#1e40af',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#dc2626',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '12px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: '1px solid #d1d5db',
          boxShadow: 'none',
        },
        '.Input:focus': {
          border: '2px solid #1e40af',
          boxShadow: 'none',
        },
      },
    },
  };
}

/**
 * Helper to load Stripe.js
 */
let stripePromise: Promise<any> | null = null;

export function loadStripe() {
  if (!stripePromise) {
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) => 
      loadStripe(STRIPE_PUBLISHABLE_KEY)
    );
  }
  return stripePromise;
}

/**
 * Generate a simple payment receipt
 */
export function generatePaymentReceipt(payment: TournamentPayment, tournamentName: string): string {
  return `
GIMMIES GOLF - PAYMENT RECEIPT
================================

Tournament: ${tournamentName}
Date: ${new Date(payment.createdAt).toLocaleDateString()}

Entry Fee: ${formatCurrency(payment.amountCents)}
Platform Fee: ${formatCurrency(payment.platformFeeCents)}
Total Paid: ${formatCurrency(payment.amountCents)}

Transaction ID: ${payment.stripePaymentIntentId || payment.id}
Status: ${payment.status.toUpperCase()}

Thank you for your registration!
Questions? Contact tournaments@gimmiesgolf.com
  `.trim();
}

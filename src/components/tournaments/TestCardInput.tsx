/**
 * TestCardInput - Mock Stripe Card Input for Testing
 * 
 * This component simulates the Stripe Card Element for development/testing.
 * It allows testing the full payment flow without Stripe API keys.
 * 
 * Test Cards:
 * - 4242 4242 4242 4242 → Success
 * - 4000 0000 0000 0002 → Declined
 * - 4000 0025 0000 3155 → Requires authentication (simulated success)
 */

import React, { useState, useEffect } from 'react';

export interface CardData {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
  zip: string;
}

export interface TestCardInputProps {
  onCardChange: (card: CardData, isValid: boolean) => void;
  disabled?: boolean;
}

// Card brand detection
const getCardBrand = (number: string): 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown' => {
  const cleaned = number.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  return 'unknown';
};

// Card brand icons
const CardBrandIcon: React.FC<{ brand: string }> = ({ brand }) => {
  switch (brand) {
    case 'visa':
      return (
        <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
          <rect width="32" height="20" rx="2" fill="#1A1F71" />
          <path d="M13.2 14.4L14.6 5.6H16.8L15.4 14.4H13.2Z" fill="white" />
          <path d="M21.6 5.8C21.2 5.6 20.4 5.4 19.4 5.4C17.2 5.4 15.6 6.6 15.6 8.2C15.6 9.4 16.6 10 17.4 10.4C18.2 10.8 18.4 11.2 18.4 11.6C18.4 12.2 17.8 12.6 16.8 12.6C15.8 12.6 15.2 12.4 14.4 12L14 12.2L13.6 14.2C14.2 14.4 15.2 14.6 16.4 14.6C18.8 14.6 20.4 13.4 20.4 11.6C20.4 10.6 19.8 9.8 18.4 9.2C17.6 8.8 17.2 8.6 17.2 8.2C17.2 7.8 17.6 7.4 18.6 7.4C19.4 7.4 20 7.6 20.4 7.8L20.6 7.8L21 5.8H21.6Z" fill="white" />
          <path d="M24.6 5.6H26.4L28 14.4H26L25.6 12.8H23L22.4 14.4H20L23.2 5.6H24.6ZM25.2 11L24.6 8.2L23.6 11H25.2Z" fill="white" />
          <path d="M12 5.6L9.8 11.4L9.6 10.4L8.8 6.4C8.6 5.8 8.2 5.6 7.6 5.6H4L4 5.8C5 6 6 6.4 6.8 6.8L8.8 14.4H11.2L14.4 5.6H12Z" fill="white" />
        </svg>
      );
    case 'mastercard':
      return (
        <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
          <rect width="32" height="20" rx="2" fill="#000" />
          <circle cx="12" cy="10" r="6" fill="#EB001B" />
          <circle cx="20" cy="10" r="6" fill="#F79E1B" />
          <path d="M16 5.8C17.4 7 18.2 8.4 18.2 10C18.2 11.6 17.4 13 16 14.2C14.6 13 13.8 11.6 13.8 10C13.8 8.4 14.6 7 16 5.8Z" fill="#FF5F00" />
        </svg>
      );
    case 'amex':
      return (
        <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
          <rect width="32" height="20" rx="2" fill="#006FCF" />
          <path d="M4 10L6 6H9L10 8L11 6H14L12 10L14 14H11L10 12L9 14H6L4 10Z" fill="white" />
          <path d="M15 6H22V8H17V9H22V11H17V12H22V14H15V6Z" fill="white" />
          <path d="M23 6H26L28 10L26 14H23L25 10L23 6Z" fill="white" />
        </svg>
      );
    default:
      return (
        <svg className="w-8 h-5 text-gray-400" viewBox="0 0 32 20" fill="none" stroke="currentColor">
          <rect x="1" y="1" width="30" height="18" rx="2" strokeWidth="2" />
          <path d="M1 7H31" strokeWidth="2" />
        </svg>
      );
  }
};

// Format card number with spaces
const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
};

// Format expiry as MM/YY
const formatExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }
  return cleaned;
};

const TestCardInput: React.FC<TestCardInputProps> = ({ onCardChange, disabled = false }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [zip, setZip] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  
  const brand = getCardBrand(cardNumber);
  
  // Validate card
  const isValidNumber = cardNumber.replace(/\s/g, '').length >= 15;
  const isValidExpiry = /^\d{2}\/\d{2}$/.test(expiry);
  const isValidCvc = cvc.length >= 3;
  const isComplete = isValidNumber && isValidExpiry && isValidCvc;
  
  // Notify parent of changes
  useEffect(() => {
    onCardChange(
      { number: cardNumber, expiry, cvc, name, zip },
      isComplete
    );
  }, [cardNumber, expiry, cvc, name, zip, isComplete]);
  
  return (
    <div className="space-y-3">
      {/* Test Mode Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="text-xs text-yellow-700">
          <span className="font-semibold">Test Mode</span> — Use card 4242 4242 4242 4242
        </div>
      </div>
      
      {/* Card Number */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
        <div className={`relative flex items-center border rounded-lg transition-colors ${
          focused === 'number' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100' : 'bg-white'}`}>
          <input
            type="text"
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            onFocus={() => setFocused('number')}
            onBlur={() => setFocused(null)}
            placeholder="4242 4242 4242 4242"
            disabled={disabled}
            className="flex-1 px-3 py-3 text-base bg-transparent border-none focus:outline-none focus:ring-0"
          />
          <div className="pr-3">
            <CardBrandIcon brand={brand} />
          </div>
        </div>
      </div>
      
      {/* Expiry, CVC, ZIP row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expiry</label>
          <input
            type="text"
            value={expiry}
            onChange={e => setExpiry(formatExpiry(e.target.value))}
            onFocus={() => setFocused('expiry')}
            onBlur={() => setFocused(null)}
            placeholder="MM/YY"
            disabled={disabled}
            className={`w-full px-3 py-3 text-base border rounded-lg transition-colors ${
              focused === 'expiry' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300'
            } ${disabled ? 'bg-gray-100' : 'bg-white'} focus:outline-none`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
          <input
            type="text"
            value={cvc}
            onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onFocus={() => setFocused('cvc')}
            onBlur={() => setFocused(null)}
            placeholder="123"
            disabled={disabled}
            className={`w-full px-3 py-3 text-base border rounded-lg transition-colors ${
              focused === 'cvc' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300'
            } ${disabled ? 'bg-gray-100' : 'bg-white'} focus:outline-none`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
          <input
            type="text"
            value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onFocus={() => setFocused('zip')}
            onBlur={() => setFocused(null)}
            placeholder="12345"
            disabled={disabled}
            className={`w-full px-3 py-3 text-base border rounded-lg transition-colors ${
              focused === 'zip' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300'
            } ${disabled ? 'bg-gray-100' : 'bg-white'} focus:outline-none`}
          />
        </div>
      </div>
      
      {/* Name on card */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name on Card</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          placeholder="John Smith"
          disabled={disabled}
          className={`w-full px-3 py-3 text-base border rounded-lg transition-colors ${
            focused === 'name' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100' : 'bg-white'} focus:outline-none`}
        />
      </div>
      
      {/* Test Card Reference */}
      <div className="text-xs text-gray-400 mt-2">
        <div className="font-medium mb-1">Test Cards:</div>
        <div className="space-y-0.5">
          <div><code className="bg-gray-100 px-1 rounded">4242 4242 4242 4242</code> Success</div>
          <div><code className="bg-gray-100 px-1 rounded">4000 0000 0000 0002</code> Declined</div>
        </div>
      </div>
    </div>
  );
};

export default TestCardInput;

// ============================================================================
// Test Payment Processing
// ============================================================================

export interface ProcessTestPaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Process a test payment
 * Simulates Stripe payment processing based on test card numbers
 */
export const processTestPayment = async (
  card: CardData,
  amountCents: number
): Promise<ProcessTestPaymentResult> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  
  const cleanNumber = card.number.replace(/\s/g, '');
  
  // Test card scenarios
  switch (cleanNumber) {
    case '4242424242424242':
      // Success card
      return {
        success: true,
        transactionId: `txn_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
    case '4000000000000002':
      // Decline card
      return {
        success: false,
        error: 'Your card was declined.',
        errorCode: 'card_declined',
      };
      
    case '4000002500003155':
      // 3D Secure (simulate success after auth)
      await new Promise(resolve => setTimeout(resolve, 1000)); // Extra delay for "auth"
      return {
        success: true,
        transactionId: `txn_test_3ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
    case '4000000000009995':
      // Insufficient funds
      return {
        success: false,
        error: 'Your card has insufficient funds.',
        errorCode: 'insufficient_funds',
      };
      
    case '4000000000009987':
      // Lost card
      return {
        success: false,
        error: 'Your card was reported lost.',
        errorCode: 'lost_card',
      };
      
    case '4000000000000069':
      // Expired card
      return {
        success: false,
        error: 'Your card has expired.',
        errorCode: 'expired_card',
      };
      
    default:
      // For any other valid-looking card, succeed
      if (cleanNumber.length >= 15 && /^\d+$/.test(cleanNumber)) {
        return {
          success: true,
          transactionId: `txn_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
      }
      
      return {
        success: false,
        error: 'Invalid card number.',
        errorCode: 'invalid_number',
      };
  }
};

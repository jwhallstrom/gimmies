/**
 * TournamentRegistrationModal - Multi-step registration flow
 * 
 * Designed for older golfers: minimal clicks, explicit steps, clear CTAs
 * Payment-ready with Stripe integration hooks
 */

import React, { useState, useEffect } from 'react';
import useStore from '../../state/store';
import type { Tournament, TournamentDivision } from '../../state/types';
import TestCardInput, { CardData, processTestPayment } from './TestCardInput';
import { isStripeConfigured } from '../../adapters/payments';

interface Props {
  tournament: Tournament;
  onClose: () => void;
  onComplete: (registrationId: string) => void;
}

type RegistrationStep = 'profile' | 'division' | 'games' | 'payment' | 'confirm';

interface RegistrationData {
  // Profile
  displayName: string;
  email: string;
  phone: string;
  handicapIndex: number | null;
  
  // Division
  divisionId: string | null;
  
  // Games
  gamePreference: 'all' | 'skins' | 'none';
  
  // Payment
  paymentMethod: 'card' | 'cash' | 'later' | null;
  agreedToTerms: boolean;
  
  // Card data (for test mode)
  cardData: CardData | null;
  cardValid: boolean;
}

const TournamentRegistrationModal: React.FC<Props> = ({ tournament, onClose, onComplete }) => {
  const { currentProfile, registerForTournament } = useStore();
  const [step, setStep] = useState<RegistrationStep>('profile');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  // Initialize with profile data
  const [data, setData] = useState<RegistrationData>({
    displayName: currentProfile?.name || '',
    email: currentProfile?.email || '',
    phone: '',
    handicapIndex: currentProfile?.handicapIndex ?? null,
    divisionId: null,
    gamePreference: 'all',
    paymentMethod: null,
    agreedToTerms: false,
    cardData: null,
    cardValid: false,
  });
  
  // Check if using test mode (no Stripe configured)
  const isTestMode = !isStripeConfigured();
  
  // Auto-select division based on handicap
  useEffect(() => {
    if (tournament.divisions.length > 0 && data.handicapIndex != null && !data.divisionId) {
      const matchingDivision = tournament.divisions.find(d => {
        const min = d.handicapMin ?? -Infinity;
        const max = d.handicapMax ?? Infinity;
        return data.handicapIndex! >= min && data.handicapIndex! <= max;
      });
      if (matchingDivision) {
        setData(prev => ({ ...prev, divisionId: matchingDivision.id }));
      }
    }
  }, [data.handicapIndex, tournament.divisions]);
  
  const updateData = (patch: Partial<RegistrationData>) => {
    setData(prev => ({ ...prev, ...patch }));
  };
  
  // Step navigation
  const steps: RegistrationStep[] = ['profile'];
  if (tournament.divisions.length > 0) steps.push('division');
  if (tournament.hasBettingOverlay) steps.push('games');
  if (tournament.entryFeeCents > 0) steps.push('payment');
  steps.push('confirm');
  
  const currentStepIndex = steps.indexOf(step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  
  const goNext = () => {
    if (!isLastStep) {
      setStep(steps[currentStepIndex + 1]);
    }
  };
  
  const goBack = () => {
    if (!isFirstStep) {
      setStep(steps[currentStepIndex - 1]);
    }
  };
  
  // Validation
  const canProceed = (): boolean => {
    switch (step) {
      case 'profile':
        return data.displayName.trim().length > 0;
      case 'division':
        return data.divisionId != null;
      case 'games':
        return true; // Always valid
      case 'payment':
        // For card payment, need valid card; for cash, just terms
        if (data.paymentMethod === 'card') {
          return data.cardValid && data.agreedToTerms;
        }
        return data.paymentMethod != null && data.agreedToTerms;
      case 'confirm':
        return true;
      default:
        return false;
    }
  };
  
  // Handle card data change from TestCardInput
  const handleCardChange = (card: CardData, isValid: boolean) => {
    setData(prev => ({ ...prev, cardData: card, cardValid: isValid }));
  };
  
  // Handle registration completion
  const handleComplete = async () => {
    if (!currentProfile) return;
    
    setIsProcessing(true);
    setPaymentError(null);
    
    try {
      // If payment required and card selected, process payment first
      if (tournament.entryFeeCents > 0 && data.paymentMethod === 'card') {
        if (!data.cardData) {
          throw new Error('Please enter your card details.');
        }
        
        // Process test payment (or real Stripe when configured)
        if (isTestMode) {
          const paymentResult = await processTestPayment(data.cardData, tournament.entryFeeCents);
          
          if (!paymentResult.success) {
            throw new Error(paymentResult.error || 'Payment failed');
          }
          
          console.log('Test payment successful:', paymentResult.transactionId);
        } else {
          // TODO: Real Stripe payment processing
          // const paymentResult = await processStripePayment(tournament.entryFeeCents);
          // if (!paymentResult.success) throw new Error(paymentResult.error);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Create registration
      const registrationId = registerForTournament(tournament.id, {
        profileId: currentProfile.id,
        displayName: data.displayName,
        handicapSnapshot: data.handicapIndex,
        divisionId: data.divisionId || undefined,
        gamePreference: data.gamePreference,
        paymentStatus: 
          tournament.entryFeeCents === 0 ? 'paid' :
          data.paymentMethod === 'card' ? 'paid' :
          'pending',
      });
      
      if (registrationId) {
        onComplete(registrationId);
      }
    } catch (error: any) {
      setPaymentError(error.message || 'Registration failed. Please try again.');
      setIsProcessing(false);
    }
  };
  
  const entryFee = tournament.entryFeeCents / 100;
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="bg-primary-600 px-4 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Register</h2>
            <p className="text-sm text-primary-100 truncate">{tournament.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress */}
        <div className="flex gap-1 px-4 py-2 bg-gray-50 flex-shrink-0">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {/* Step: Profile */}
          {step === 'profile' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Your Information</h3>
                <p className="text-sm text-gray-500 mt-1">Confirm your details for registration</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={data.displayName}
                  onChange={e => updateData({ displayName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email <span className="font-normal text-gray-400">(for updates)</span>
                </label>
                <input
                  type="email"
                  value={data.email}
                  onChange={e => updateData({ email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Phone <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={e => updateData({ phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Handicap Index</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.handicapIndex ?? ''}
                  onChange={e => updateData({ handicapIndex: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g. 12.4"
                />
                {currentProfile?.handicapIndex && (
                  <p className="text-xs text-gray-500 mt-1">
                    Your Gimmies handicap: {currentProfile.handicapIndex.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Step: Division */}
          {step === 'division' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Select Division</h3>
                <p className="text-sm text-gray-500 mt-1">Choose the flight that fits your game</p>
              </div>
              
              <div className="space-y-3">
                {tournament.divisions.map(division => {
                  const isSelected = data.divisionId === division.id;
                  const handicapRange = division.handicapMin != null || division.handicapMax != null
                    ? `${division.handicapMin ?? '0'} - ${division.handicapMax ?? '36+'}`
                    : null;
                  
                  return (
                    <button
                      key={division.id}
                      onClick={() => updateData({ divisionId: division.id })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 text-lg">{division.name}</div>
                          {handicapRange && (
                            <div className="text-sm text-gray-500">Handicap: {handicapRange}</div>
                          )}
                          {division.gender && division.gender !== 'mixed' && (
                            <div className="text-sm text-gray-500 capitalize">{division.gender}</div>
                          )}
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Step: Games */}
          {step === 'games' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Side Games</h3>
                <p className="text-sm text-gray-500 mt-1">Optional betting games for extra fun</p>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🎰</div>
                  <div>
                    <div className="font-semibold text-gray-900">Gimmies Games Available</div>
                    <div className="text-sm text-gray-600">
                      This tournament offers optional side games like Skins, Nassau, and more with automatic payouts.
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {[
                  { value: 'all', label: 'All Games', desc: 'I want to play all available side games' },
                  { value: 'skins', label: 'Skins Only', desc: 'Just skins game, nothing else' },
                  { value: 'none', label: 'No Side Games', desc: 'Leaderboard only, no betting' },
                ].map(option => {
                  const isSelected = data.gamePreference === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updateData({ gamePreference: option.value as any })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.desc}</div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Step: Payment */}
          {step === 'payment' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Payment</h3>
                <p className="text-sm text-gray-500 mt-1">Entry fee: ${entryFee.toFixed(2)}</p>
              </div>
              
              {/* Payment Method Selection */}
              <div className="space-y-3">
                {/* Card Payment */}
                <button
                  onClick={() => updateData({ paymentMethod: 'card' })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    data.paymentMethod === 'card'
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Pay Now with Card</div>
                      <div className="text-sm text-gray-500">Secure payment via Stripe</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      data.paymentMethod === 'card' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                    }`}>
                      {data.paymentMethod === 'card' && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
                
                {/* Cash Payment */}
                <button
                  onClick={() => updateData({ paymentMethod: 'cash' })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    data.paymentMethod === 'cash'
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Pay Cash at Check-in</div>
                      <div className="text-sm text-gray-500">Pay the organizer in person</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      data.paymentMethod === 'cash' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                    }`}>
                      {data.paymentMethod === 'cash' && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              </div>
              
              {/* Card Payment Form */}
              {data.paymentMethod === 'card' && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <TestCardInput 
                    onCardChange={handleCardChange}
                    disabled={isProcessing}
                  />
                </div>
              )}
              
              {/* Terms Agreement */}
              <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.agreedToTerms}
                  onChange={e => updateData({ agreedToTerms: e.target.checked })}
                  className="mt-1 h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="text-sm text-gray-600">
                  I agree to the tournament rules and understand that entry fees are non-refundable unless the tournament is cancelled.
                </div>
              </label>
              
              {paymentError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {paymentError}
                </div>
              )}
            </div>
          )}
          
          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Confirm Registration</h3>
                <p className="text-sm text-gray-500 mt-1">Review your details before completing</p>
              </div>
              
              {/* Summary Card */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold text-gray-900">{data.displayName}</span>
                </div>
                {data.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-700">{data.email}</span>
                  </div>
                )}
                {data.handicapIndex != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Handicap</span>
                    <span className="font-medium text-gray-700">{data.handicapIndex.toFixed(1)}</span>
                  </div>
                )}
                {data.divisionId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Division</span>
                    <span className="font-medium text-gray-700">
                      {tournament.divisions.find(d => d.id === data.divisionId)?.name}
                    </span>
                  </div>
                )}
                {tournament.hasBettingOverlay && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Side Games</span>
                    <span className="font-medium text-gray-700">
                      {data.gamePreference === 'all' ? 'All games' : 
                       data.gamePreference === 'skins' ? 'Skins only' : 'None'}
                    </span>
                  </div>
                )}
                
                {tournament.entryFeeCents > 0 && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment</span>
                      <span className="font-medium text-gray-700">
                        {data.paymentMethod === 'card' 
                          ? `Card ending ${data.cardData?.number.slice(-4) || '****'}`
                          : 'Cash at check-in'}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-green-600">${entryFee.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
              
              {/* Tournament Info */}
              <div className="bg-primary-50 rounded-xl p-4">
                <div className="font-semibold text-primary-900">{tournament.name}</div>
                <div className="text-sm text-primary-700 mt-1">
                  {tournament.courseName} • {new Date(tournament.dates[0]).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex gap-3">
            {!isFirstStep && (
              <button
                onClick={goBack}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            
            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isProcessing || !canProceed()}
                className={`flex-1 py-3 px-4 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  isProcessing || !canProceed()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                }`}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Registration
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className={`flex-1 py-3 px-4 font-semibold rounded-xl transition-colors ${
                  !canProceed()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                Continue
              </button>
            )}
          </div>
          
          {/* Trust Badges */}
          {step === 'payment' && (
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure
              </span>
              <span>{isTestMode ? 'Test Mode' : 'Powered by Stripe'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentRegistrationModal;

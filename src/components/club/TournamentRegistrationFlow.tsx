/**
 * TournamentRegistrationFlow - Player registration for tournaments
 * 
 * Features:
 * - Tournament info display
 * - Player details form
 * - Division selection
 * - Entry fee payment (Stripe)
 * - Confirmation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Tournament, TournamentDivision, TournamentRegistration } from '../../state/types';
import { formatCurrency, calculatePlatformFee } from '../../utils/stripe';
import useStore from '../../state/store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  onComplete: (registration: Partial<TournamentRegistration>) => void;
}

type Step = 'info' | 'details' | 'division' | 'payment' | 'confirmation';

const TournamentRegistrationFlow: React.FC<Props> = ({ isOpen, onClose, tournament, onComplete }) => {
  const { currentProfile } = useStore();
  const [step, setStep] = useState<Step>('info');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Registration data
  const [registration, setRegistration] = useState<Partial<TournamentRegistration>>({
    tournamentId: tournament.id,
    profileId: currentProfile?.id,
    displayName: currentProfile?.name || '',
    handicapSnapshot: currentProfile?.handicapIndex,
    gamePreference: 'all',
    paymentStatus: 'pending',
  });
  
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestHandicap, setGuestHandicap] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);
  
  // Payment simulation
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  
  // Calculate fees
  const entryFee = tournament.entryFeeCents;
  const isEarlyBird = tournament.earlyBirdDeadline && new Date(tournament.earlyBirdDeadline) > new Date();
  const effectiveFee = isEarlyBird && tournament.earlyBirdFeeCents ? tournament.earlyBirdFeeCents : entryFee;
  
  // Check if already registered
  const isAlreadyRegistered = useMemo(() => {
    if (!currentProfile) return false;
    return tournament.registrations.some(r => r.profileId === currentProfile.id);
  }, [tournament.registrations, currentProfile]);
  
  // Check capacity
  const spotsRemaining = tournament.maxPlayers - tournament.registrations.length;
  const isFull = spotsRemaining <= 0;
  const waitlistPosition = isFull ? tournament.registrations.filter(r => r.waitingListPosition != null).length + 1 : null;
  
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setGuestMode(false);
      setSelectedDivision(null);
      setAgreedToRules(false);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const nextStep = () => {
    const steps: Step[] = ['info', 'details', 'division', 'payment', 'confirmation'];
    const currentIndex = steps.indexOf(step);
    
    // Skip division if no divisions
    if (step === 'details' && tournament.divisions.length === 0) {
      setStep('payment');
      return;
    }
    
    // Skip payment if free tournament
    if (step === 'division' && effectiveFee === 0) {
      handleRegister();
      return;
    }
    if (step === 'details' && tournament.divisions.length === 0 && effectiveFee === 0) {
      handleRegister();
      return;
    }
    
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };
  
  const prevStep = () => {
    const steps: Step[] = ['info', 'details', 'division', 'payment', 'confirmation'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };
  
  const handleRegister = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const finalRegistration: Partial<TournamentRegistration> = {
        id: `reg-${Date.now()}`,
        tournamentId: tournament.id,
        profileId: guestMode ? undefined : currentProfile?.id,
        guestName: guestMode ? guestName : undefined,
        displayName: guestMode ? guestName : currentProfile?.name,
        handicapSnapshot: guestMode ? parseFloat(guestHandicap) || null : currentProfile?.handicapIndex,
        divisionId: selectedDivision || undefined,
        gamePreference: registration.gamePreference,
        paymentStatus: effectiveFee > 0 ? 'paid' : 'paid',
        waitingListPosition: isFull ? waitlistPosition : undefined,
        createdAt: new Date().toISOString(),
      };
      
      setRegistration(finalRegistration);
      setStep('confirmation');
      onComplete(finalRegistration);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  const renderInfoStep = () => (
    <div className="space-y-5">
      {/* Tournament Banner */}
      {tournament.bannerImage ? (
        <img src={tournament.bannerImage} alt="" className="w-full h-40 object-cover rounded-xl" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center">
          <span className="text-6xl">🏆</span>
        </div>
      )}
      
      <div>
        <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
        <p className="text-sm text-gray-500 mt-1">{tournament.courseName || 'Course TBD'}</p>
      </div>
      
      {/* Key Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Date</p>
          <p className="font-medium text-gray-900">
            {tournament.dates[0] ? formatDate(tournament.dates[0]) : 'TBD'}
          </p>
          {tournament.dates.length > 1 && (
            <p className="text-xs text-gray-500">+ {tournament.dates.length - 1} more day(s)</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Format</p>
          <p className="font-medium text-gray-900 capitalize">{tournament.format.replace('_', ' ')}</p>
          <p className="text-xs text-gray-500">{tournament.rounds} round(s)</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Entry Fee</p>
          <p className="font-medium text-gray-900">
            {effectiveFee > 0 ? formatCurrency(effectiveFee) : 'Free'}
          </p>
          {isEarlyBird && tournament.earlyBirdFeeCents && (
            <p className="text-xs text-green-600">Early bird pricing!</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Spots</p>
          <p className="font-medium text-gray-900">
            {isFull ? 'Waitlist' : `${spotsRemaining} left`}
          </p>
          <p className="text-xs text-gray-500">{tournament.registrations.length}/{tournament.maxPlayers}</p>
        </div>
      </div>
      
      {/* Description */}
      {tournament.description && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-gray-700">{tournament.description}</p>
        </div>
      )}
      
      {/* Prize Pool */}
      {tournament.prizePool?.totalCents > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏆</span>
            <span className="font-bold text-gray-900">Prize Pool</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(tournament.prizePool.totalCents)}</p>
        </div>
      )}
      
      {/* Already Registered Warning */}
      {isAlreadyRegistered && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 font-medium">You're already registered for this tournament!</p>
        </div>
      )}
      
      {/* Full Warning */}
      {isFull && !isAlreadyRegistered && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-800">
            <strong>Tournament is full.</strong> You can join the waitlist (position #{waitlistPosition}).
          </p>
        </div>
      )}
    </div>
  );
  
  const renderDetailsStep = () => (
    <div className="space-y-5">
      <div className="text-center py-2">
        <h3 className="text-lg font-bold text-gray-900">Player Information</h3>
        <p className="text-sm text-gray-500">Confirm your details for the tournament</p>
      </div>
      
      {/* Toggle Guest Mode */}
      {!currentProfile && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            <strong>Not signed in.</strong> You'll register as a guest.
          </p>
        </div>
      )}
      
      {currentProfile && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <input
            type="checkbox"
            id="guestMode"
            checked={guestMode}
            onChange={e => setGuestMode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600"
          />
          <label htmlFor="guestMode" className="text-sm text-gray-700">
            Register someone else (guest registration)
          </label>
        </div>
      )}
      
      {(guestMode || !currentProfile) ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="John Smith"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Handicap Index</label>
            <input
              type="number"
              step="0.1"
              value={guestHandicap}
              onChange={e => setGuestHandicap(e.target.value)}
              placeholder="15.0"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">
              {currentProfile.avatar ? (
                <img src={currentProfile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                currentProfile.name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900">{currentProfile.name}</p>
              <p className="text-sm text-gray-500">
                Handicap: {currentProfile.handicapIndex != null ? currentProfile.handicapIndex.toFixed(1) : 'Not set'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Game Preference */}
      {tournament.hasBettingOverlay && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Side Games</label>
          <div className="space-y-2">
            {[
              { value: 'all', label: 'Participate in all games', desc: 'Nassau, Skins, etc.' },
              { value: 'nassau', label: 'Nassau only', desc: 'No individual skins' },
              { value: 'none', label: 'No side games', desc: 'Tournament only' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  registration.gamePreference === opt.value 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="gamePreference"
                  value={opt.value}
                  checked={registration.gamePreference === opt.value}
                  onChange={e => setRegistration(prev => ({ ...prev, gamePreference: e.target.value as any }))}
                  className="w-4 h-4 text-primary-600"
                />
                <div>
                  <p className="font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  const renderDivisionStep = () => (
    <div className="space-y-5">
      <div className="text-center py-2">
        <h3 className="text-lg font-bold text-gray-900">Select Division</h3>
        <p className="text-sm text-gray-500">Choose the division that fits your game</p>
      </div>
      
      <div className="space-y-3">
        {tournament.divisions.map(div => (
          <button
            key={div.id}
            onClick={() => setSelectedDivision(div.id)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              selectedDivision === div.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{div.name}</p>
                <p className="text-sm text-gray-500">
                  {div.handicapMin != null && div.handicapMax != null 
                    ? `Handicap ${div.handicapMin} - ${div.handicapMax}`
                    : div.handicapMax != null 
                      ? `Handicap ${div.handicapMax} and below`
                      : div.handicapMin != null
                        ? `Handicap ${div.handicapMin} and above`
                        : 'Open'}
                  {div.gender && ` · ${div.gender.charAt(0).toUpperCase() + div.gender.slice(1)}`}
                </p>
              </div>
              {selectedDivision === div.id && (
                <span className="text-primary-600 text-xl">✓</span>
              )}
            </div>
          </button>
        ))}
      </div>
      
      {tournament.divisions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No divisions - all players compete together</p>
        </div>
      )}
    </div>
  );
  
  const renderPaymentStep = () => (
    <div className="space-y-5">
      <div className="text-center py-2">
        <h3 className="text-lg font-bold text-gray-900">Payment</h3>
        <p className="text-sm text-gray-500">Secure payment powered by Stripe</p>
      </div>
      
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Entry Fee</span>
          <span className="font-medium text-gray-900">{formatCurrency(effectiveFee)}</span>
        </div>
        {isEarlyBird && tournament.earlyBirdFeeCents && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Early Bird Discount</span>
            <span className="font-medium text-green-600">
              -{formatCurrency(entryFee - tournament.earlyBirdFeeCents)}
            </span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 flex justify-between">
          <span className="font-bold text-gray-900">Total</span>
          <span className="font-bold text-gray-900">{formatCurrency(effectiveFee)}</span>
        </div>
      </div>
      
      {/* Payment Form (Simulated) */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
          <input
            type="text"
            value={cardNumber}
            onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
            placeholder="4242 4242 4242 4242"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
            <input
              type="text"
              value={cardExpiry}
              onChange={e => setCardExpiry(e.target.value)}
              placeholder="MM/YY"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CVC</label>
            <input
              type="text"
              value={cardCvc}
              onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base font-mono"
            />
          </div>
        </div>
      </div>
      
      {/* Rules Agreement */}
      {tournament.rules && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="agreeRules"
            checked={agreedToRules}
            onChange={e => setAgreedToRules(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600"
          />
          <label htmlFor="agreeRules" className="text-sm text-gray-600">
            I have read and agree to the <button className="text-primary-600 underline">tournament rules</button>
          </label>
        </div>
      )}
      
      {/* Security Note */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Your payment info is encrypted and secure
      </div>
    </div>
  );
  
  const renderConfirmationStep = () => (
    <div className="space-y-5 text-center">
      <div className="py-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">✓</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900">You're Registered!</h3>
        <p className="text-gray-600 mt-1">
          {isFull 
            ? `You're #${waitlistPosition} on the waitlist`
            : 'See you on the course!'}
        </p>
      </div>
      
      <div className="bg-gray-50 rounded-xl p-4 text-left">
        <h4 className="font-bold text-gray-900 mb-3">Registration Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Tournament</span>
            <span className="font-medium text-gray-900">{tournament.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">
              {tournament.dates[0] && new Date(tournament.dates[0]).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Player</span>
            <span className="font-medium text-gray-900">{registration.displayName}</span>
          </div>
          {selectedDivision && (
            <div className="flex justify-between">
              <span className="text-gray-500">Division</span>
              <span className="font-medium text-gray-900">
                {tournament.divisions.find(d => d.id === selectedDivision)?.name}
              </span>
            </div>
          )}
          {effectiveFee > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Amount Paid</span>
              <span className="font-medium text-green-600">{formatCurrency(effectiveFee)}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
        <p className="text-sm text-blue-800">
          <strong>What's next?</strong> You'll receive a confirmation email with tee time details closer to the event date.
        </p>
      </div>
    </div>
  );
  
  const renderCurrentStep = () => {
    switch (step) {
      case 'info': return renderInfoStep();
      case 'details': return renderDetailsStep();
      case 'division': return renderDivisionStep();
      case 'payment': return renderPaymentStep();
      case 'confirmation': return renderConfirmationStep();
    }
  };
  
  const canProceed = () => {
    switch (step) {
      case 'info':
        return !isAlreadyRegistered;
      case 'details':
        if (guestMode || !currentProfile) {
          return guestName.trim().length > 0 && guestEmail.includes('@');
        }
        return true;
      case 'division':
        return tournament.divisions.length === 0 || selectedDivision != null;
      case 'payment':
        return cardNumber.length >= 13 && cardExpiry.length >= 4 && cardCvc.length >= 3 && 
               (!tournament.rules || agreedToRules);
      default:
        return true;
    }
  };
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-800 px-6 py-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {step === 'confirmation' ? 'Registration Complete' : 'Tournament Registration'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress */}
        {step !== 'confirmation' && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              {['Info', 'Details', tournament.divisions.length > 0 ? 'Division' : null, effectiveFee > 0 ? 'Payment' : null]
                .filter(Boolean)
                .map((label, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx <= ['info', 'details', 'division', 'payment'].indexOf(step)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderCurrentStep()}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          {step === 'confirmation' ? (
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              {step !== 'info' ? (
                <button
                  onClick={prevStep}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}
              
              {step === 'payment' ? (
                <button
                  onClick={handleRegister}
                  disabled={!canProceed() || isProcessing}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay {formatCurrency(effectiveFee)}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {step === 'info' && isAlreadyRegistered ? 'Already Registered' : 'Continue →'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TournamentRegistrationFlow;

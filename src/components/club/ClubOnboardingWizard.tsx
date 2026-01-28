/**
 * ClubOnboardingWizard - Multi-step onboarding for golf courses/clubs
 * 
 * Steps:
 * 1. Club Type & Basic Info
 * 2. Contact & Location
 * 3. Link Course (optional)
 * 4. Stripe Connect Setup
 * 5. Review & Submit
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Club, ClubType } from '../../state/types';
import { CourseSearch } from '../CourseSearch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (club: Partial<Club>) => void;
}

type Step = 'type' | 'contact' | 'course' | 'stripe' | 'review';

const CLUB_TYPES: { value: ClubType; label: string; icon: string; description: string }[] = [
  { value: 'golf_course', label: 'Golf Course', icon: '⛳', description: 'Public or semi-private course' },
  { value: 'country_club', label: 'Country Club', icon: '🏛️', description: 'Private membership club' },
  { value: 'municipal', label: 'Municipal Course', icon: '🏛️', description: 'City or county-owned course' },
  { value: 'resort', label: 'Resort', icon: '🏨', description: 'Hotel or resort with golf' },
  { value: 'golf_league', label: 'Golf League', icon: '🏆', description: 'Organized league or association' },
  { value: 'driving_range', label: 'Driving Range', icon: '🎯', description: 'Practice facility' },
  { value: 'other', label: 'Other', icon: '🏌️', description: 'Other golf organization' },
];

const ClubOnboardingWizard: React.FC<Props> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<Step>('type');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  
  // Form data
  const [clubData, setClubData] = useState<Partial<Club>>({
    type: 'golf_course',
    name: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA',
    },
    settings: {
      allowPublicTournaments: true,
      defaultEntryFeeEnabled: true,
      defaultTipFundEnabled: false,
      autoApproveRegistrations: false,
      requireHandicapVerification: false,
      maxPlayersPerTournament: 144,
    },
    stripe: {
      connectStatus: 'not_started',
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      defaultCurrency: 'usd',
      platformFeePercent: 2.5,
    },
  });
  
  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
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
  
  if (!isOpen) return null;
  
  const updateClubData = (updates: Partial<Club>) => {
    setClubData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    Object.keys(updates).forEach(key => {
      if (errors[key]) {
        setErrors(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    });
  };
  
  const updateAddress = (field: string, value: string) => {
    setClubData(prev => ({
      ...prev,
      address: { ...prev.address!, [field]: value },
    }));
  };
  
  const validateStep = (currentStep: Step): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (currentStep) {
      case 'type':
        if (!clubData.name?.trim()) newErrors.name = 'Club name is required';
        if (!clubData.type) newErrors.type = 'Please select a club type';
        break;
      case 'contact':
        if (!clubData.email?.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(clubData.email)) newErrors.email = 'Invalid email format';
        if (!clubData.address?.city?.trim()) newErrors.city = 'City is required';
        if (!clubData.address?.state?.trim()) newErrors.state = 'State is required';
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const nextStep = () => {
    if (!validateStep(step)) return;
    
    const steps: Step[] = ['type', 'contact', 'course', 'stripe', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };
  
  const prevStep = () => {
    const steps: Step[] = ['type', 'contact', 'course', 'stripe', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // In production, this would create the club in the backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      onComplete(clubData);
    } catch (error) {
      console.error('Failed to create club:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCourseSelect = (courseId: string, courseName: string) => {
    updateClubData({
      linkedCourseId: courseId,
      linkedCourseName: courseName,
    });
    setShowCourseSearch(false);
  };
  
  const renderStepIndicator = () => {
    const steps: { key: Step; label: string }[] = [
      { key: 'type', label: 'Type' },
      { key: 'contact', label: 'Contact' },
      { key: 'course', label: 'Course' },
      { key: 'stripe', label: 'Payments' },
      { key: 'review', label: 'Review' },
    ];
    
    const currentIndex = steps.findIndex(s => s.key === step);
    
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  idx < currentIndex 
                    ? 'bg-green-500 text-white' 
                    : idx === currentIndex 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {idx < currentIndex ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 ${idx === currentIndex ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 -mt-4 ${idx < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };
  
  const renderTypeStep = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Club Name *</label>
        <input
          type="text"
          value={clubData.name || ''}
          onChange={e => updateClubData({ name: e.target.value })}
          placeholder="e.g., Pine Valley Golf Club"
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">What type of organization? *</label>
        <div className="grid grid-cols-2 gap-3">
          {CLUB_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateClubData({ type: type.value })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                clubData.type === type.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{type.icon}</span>
                <span className="font-medium text-gray-900 text-sm">{type.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-7">{type.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
        <textarea
          value={clubData.description || ''}
          onChange={e => updateClubData({ description: e.target.value })}
          placeholder="Tell players about your club..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base resize-none"
        />
      </div>
    </div>
  );
  
  const renderContactStep = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
        <input
          type="email"
          value={clubData.email || ''}
          onChange={e => updateClubData({ email: e.target.value })}
          placeholder="tournaments@yourclub.com"
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 text-base ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
          <input
            type="tel"
            value={clubData.phone || ''}
            onChange={e => updateClubData({ phone: e.target.value })}
            placeholder="(555) 123-4567"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
          <input
            type="url"
            value={clubData.website || ''}
            onChange={e => updateClubData({ website: e.target.value })}
            placeholder="https://yourclub.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
        <input
          type="text"
          value={clubData.address?.street || ''}
          onChange={e => updateAddress('street', e.target.value)}
          placeholder="123 Fairway Drive"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
          <input
            type="text"
            value={clubData.address?.city || ''}
            onChange={e => updateAddress('city', e.target.value)}
            placeholder="Palm Beach"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 text-base ${
              errors.city ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
          <input
            type="text"
            value={clubData.address?.state || ''}
            onChange={e => updateAddress('state', e.target.value)}
            placeholder="FL"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 text-base ${
              errors.state ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
          <input
            type="text"
            value={clubData.address?.zip || ''}
            onChange={e => updateAddress('zip', e.target.value)}
            placeholder="33480"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          <select
            value={clubData.address?.country || 'USA'}
            onChange={e => updateAddress('country', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-base"
          >
            <option value="USA">United States</option>
            <option value="CAN">Canada</option>
            <option value="MEX">Mexico</option>
          </select>
        </div>
      </div>
    </div>
  );
  
  const renderCourseStep = () => (
    <div className="space-y-5">
      <div className="text-center py-4">
        <div className="text-4xl mb-3">⛳</div>
        <h3 className="text-lg font-bold text-gray-900">Link Your Course</h3>
        <p className="text-sm text-gray-600 mt-1">
          Connect your club to an existing course in our database for easier tournament setup.
        </p>
      </div>
      
      {clubData.linkedCourseId ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600">✓</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{clubData.linkedCourseName}</p>
                <p className="text-xs text-gray-500">Course linked successfully</p>
              </div>
            </div>
            <button
              onClick={() => updateClubData({ linkedCourseId: undefined, linkedCourseName: undefined })}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => setShowCourseSearch(true)}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search for your course
          </button>
          
          <p className="text-center text-sm text-gray-500">
            Don't see your course? You can skip this step and add courses when creating tournaments.
          </p>
        </>
      )}
      
      {/* Course Search Sub-panel */}
      {showCourseSearch && (
        <div className="fixed inset-0 z-[10001] bg-white flex flex-col">
          <div className="bg-primary-700 text-white px-4 py-4 flex items-center justify-between">
            <h3 className="font-bold">Search Courses</h3>
            <button onClick={() => setShowCourseSearch(false)} className="p-2 hover:bg-white/10 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CourseSearch
              selectedCourseId={clubData.linkedCourseId || ''}
              onSelect={handleCourseSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
  
  const renderStripeStep = () => (
    <div className="space-y-5">
      <div className="text-center py-4">
        <div className="text-4xl mb-3">💳</div>
        <h3 className="text-lg font-bold text-gray-900">Accept Payments</h3>
        <p className="text-sm text-gray-600 mt-1">
          Connect with Stripe to collect entry fees and distribute prize money.
        </p>
      </div>
      
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
        <h4 className="font-bold text-gray-900 mb-3">With Stripe Connect, you can:</h4>
        <ul className="space-y-2">
          {[
            'Collect tournament entry fees online',
            'Automatically distribute prize money',
            'Track all payments in one dashboard',
            'Accept cards, Apple Pay, Google Pay',
            'Get paid directly to your bank account',
          ].map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-green-500">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-500 text-xl">💡</span>
          <div>
            <p className="text-sm text-gray-700">
              <strong>Set up later:</strong> You can skip this step and set up payments when you're ready to host your first paid tournament.
            </p>
          </div>
        </div>
      </div>
      
      <button
        className="w-full py-4 bg-[#635bff] text-white rounded-xl font-bold text-base hover:bg-[#5851db] transition-colors flex items-center justify-center gap-3"
        onClick={() => {
          // In production, this would redirect to Stripe Connect onboarding
          alert('In production, this would redirect to Stripe Connect onboarding.');
        }}
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
        </svg>
        Connect with Stripe
      </button>
      
      <button
        onClick={nextStep}
        className="w-full py-3 text-gray-600 hover:text-gray-900 text-sm transition-colors"
      >
        Skip for now →
      </button>
    </div>
  );
  
  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="text-center py-2">
        <div className="text-4xl mb-2">🎉</div>
        <h3 className="text-lg font-bold text-gray-900">Almost Done!</h3>
        <p className="text-sm text-gray-600">Review your club details before submitting.</p>
      </div>
      
      {/* Club Info Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          {clubData.logo ? (
            <img src={clubData.logo} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-2xl">⛳</span>
            </div>
          )}
          <div>
            <h4 className="font-bold text-gray-900">{clubData.name}</h4>
            <p className="text-sm text-gray-500 capitalize">{clubData.type?.replace('_', ' ')}</p>
          </div>
        </div>
        
        {clubData.description && (
          <p className="text-sm text-gray-600">{clubData.description}</p>
        )}
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Email:</span>
            <p className="font-medium text-gray-900">{clubData.email}</p>
          </div>
          {clubData.phone && (
            <div>
              <span className="text-gray-500">Phone:</span>
              <p className="font-medium text-gray-900">{clubData.phone}</p>
            </div>
          )}
        </div>
        
        {clubData.address?.city && (
          <div className="text-sm">
            <span className="text-gray-500">Location:</span>
            <p className="font-medium text-gray-900">
              {[clubData.address.city, clubData.address.state].filter(Boolean).join(', ')}
            </p>
          </div>
        )}
        
        {clubData.linkedCourseName && (
          <div className="text-sm">
            <span className="text-gray-500">Linked Course:</span>
            <p className="font-medium text-gray-900">{clubData.linkedCourseName}</p>
          </div>
        )}
        
        <div className="flex items-center gap-2 pt-2">
          <span className={`w-2 h-2 rounded-full ${
            clubData.stripe?.connectStatus === 'active' ? 'bg-green-500' : 'bg-amber-500'
          }`} />
          <span className="text-sm text-gray-600">
            {clubData.stripe?.connectStatus === 'active' 
              ? 'Payments connected' 
              : 'Payments not yet configured'}
          </span>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>What happens next:</strong> After submitting, you'll have access to your Club Dashboard where you can create tournaments, manage registrations, and configure settings.
        </p>
      </div>
    </div>
  );
  
  const renderCurrentStep = () => {
    switch (step) {
      case 'type': return renderTypeStep();
      case 'contact': return renderContactStep();
      case 'course': return renderCourseStep();
      case 'stripe': return renderStripeStep();
      case 'review': return renderReviewStep();
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
        <div className="bg-gradient-to-r from-primary-700 to-primary-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Set Up Your Club</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {renderStepIndicator()}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderCurrentStep()}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          {step !== 'type' ? (
            <button
              onClick={prevStep}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          
          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Club
                  <span>🎉</span>
                </>
              )}
            </button>
          ) : step !== 'stripe' ? (
            <button
              onClick={nextStep}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
            >
              Continue →
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ClubOnboardingWizard;

import { useCallback } from 'react';
import {
  trackLoanStep,
  trackLoanConversion,
  trackVideoKYCComplete,
  trackPANVerified,
  trackAadhaarInitiated,
  trackAadhaarVerified,
  trackReferralFormStart,
  trackReferralStep1Lead,
  trackMetaEvent,
  trackMetaCustomEvent,
  trackGoogleConversion,
  gtag,
} from '@/utils/analytics';

/**
 * React hook for analytics tracking in components
 * Provides memoized tracking functions for optimal performance
 */
export function useAnalytics() {
  /**
   * Track loan application step view
   */
  const trackStep = useCallback((
    step: number,
    stepName: string,
    flowType: 'referral' | 'public' = 'referral'
  ) => {
    trackLoanStep(step, stepName, flowType);
  }, []);

  /**
   * Track final loan conversion
   */
  const trackConversion = useCallback((
    applicationId: string,
    amount?: number,
    flowType: 'referral' | 'public' = 'referral'
  ) => {
    trackLoanConversion(applicationId, amount, flowType);
  }, []);

  /**
   * Track Video KYC completion (primary conversion)
   */
  const trackVideoKYC = useCallback((applicationId: string) => {
    trackVideoKYCComplete(applicationId);
  }, []);

  /**
   * Track PAN verification
   */
  const trackPAN = useCallback((applicationId?: string) => {
    trackPANVerified(applicationId);
  }, []);

  /**
   * Track Aadhaar/DigiLocker initiation
   */
  const trackAadhaarStart = useCallback(() => {
    trackAadhaarInitiated();
  }, []);

  /**
   * Track Aadhaar verification success
   */
  const trackAadhaarSuccess = useCallback(() => {
    trackAadhaarVerified();
  }, []);

  /**
   * Track referral form start (Step 1 complete)
   */
  const trackFormStart = useCallback((loanAmount?: number) => {
    trackReferralFormStart(loanAmount);
  }, []);

  /**
   * Track Step 1 lead (fires Google & Meta pixels with UTM source)
   */
  const trackStep1Lead = useCallback((
    loanAmount?: number,
    utmParams?: { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null }
  ) => {
    trackReferralStep1Lead(loanAmount, utmParams);
  }, []);

  /**
   * Track custom event on both platforms
   */
  const trackCustomEvent = useCallback((
    eventName: string,
    params?: Record<string, any>
  ) => {
    // Google Analytics
    gtag('event', eventName, params || {});
    // Meta custom event
    trackMetaCustomEvent(eventName, params);
  }, []);

  return {
    // Step tracking
    trackStep,
    
    // Conversion tracking
    trackConversion,
    trackVideoKYC,
    
    // Verification tracking
    trackPAN,
    trackAadhaarStart,
    trackAadhaarSuccess,
    
    // Form tracking
    trackFormStart,
    trackStep1Lead,
    
    // Generic tracking
    trackCustomEvent,
    
    // Direct access to low-level functions
    trackMetaEvent,
    trackGoogleConversion,
  };
}

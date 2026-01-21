import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 2 * 60 * 1000;  // Show warning 2 minutes before logout

export function useIdleTimeout() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Reset timers on activity
  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    
    clearAllTimers();
    
    // Set warning timer (28 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingTime(Math.floor(WARNING_TIME / 1000));
      
      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingTime(prev => Math.max(0, prev - 1));
      }, 1000);
    }, IDLE_TIMEOUT - WARNING_TIME);
    
    // Set logout timer (30 minutes)
    timeoutRef.current = setTimeout(async () => {
      clearAllTimers();
      setShowWarning(false);
      toast.info("You have been logged out due to inactivity");
      await signOut();
      navigate('/');
    }, IDLE_TIMEOUT);
  }, [signOut, navigate, clearAllTimers]);

  // Activity event listeners
  useEffect(() => {
    if (!session) {
      clearAllTimers();
      return;
    }
    
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      // Only reset if warning is not showing
      if (!showWarning) {
        resetTimers();
      }
    };
    
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimers(); // Initialize timers
    
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [session, resetTimers, showWarning, clearAllTimers]);

  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return { showWarning, remainingTime, stayLoggedIn };
}

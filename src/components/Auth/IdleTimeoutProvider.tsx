import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { IdleTimeoutWarning } from './IdleTimeoutWarning';
import { useAuth } from '@/contexts/AuthContext';

interface IdleTimeoutProviderProps {
  children: React.ReactNode;
}

export function IdleTimeoutProvider({ children }: IdleTimeoutProviderProps) {
  const { session } = useAuth();
  const { showWarning, remainingTime, stayLoggedIn } = useIdleTimeout();

  return (
    <>
      {children}
      {session && (
        <IdleTimeoutWarning
          open={showWarning}
          remainingTime={remainingTime}
          onStayLoggedIn={stayLoggedIn}
        />
      )}
    </>
  );
}

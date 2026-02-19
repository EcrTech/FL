import { MapPin, Loader2, ArrowLeft } from "lucide-react";
import logo from "@/assets/loanflow-logo.png";

interface ApplicationHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  locationLoading: boolean;
  hasLocation: boolean;
}

export function ApplicationHeader({
  showBack = false,
  onBack,
  locationLoading,
  hasLocation,
}: ApplicationHeaderProps) {
  return (
    <header className="h-14 bg-card border-b border-border sticky top-0 z-50">
      <div className="h-full max-w-lg mx-auto px-4 flex items-center justify-between">
        {/* Left: Back button or spacer */}
        <div className="w-8 flex items-center">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
        </div>

        {/* Center: Logo and brand name */}
        <div className="flex items-center gap-2.5">
          <img 
            src={logo} 
            alt="LoanFlow"
            className="h-10 w-10 rounded-lg object-cover shadow-sm" 
          />
          <span className="text-lg font-heading font-bold text-foreground tracking-tight">
            Loan<span className="text-primary">Flow</span>
          </span>
        </div>

        {/* Right: Location pill */}
        <div className="flex items-center">
          {locationLoading ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          ) : hasLocation ? (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-[hsl(var(--success))] rounded-full">
              <MapPin className="h-3 w-3 text-white" />
              <span className="text-[10px] font-medium text-white uppercase tracking-wide">OK</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-destructive/10 rounded-full">
              <MapPin className="h-3 w-3 text-destructive" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

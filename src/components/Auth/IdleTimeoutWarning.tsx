import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface IdleTimeoutWarningProps {
  open: boolean;
  remainingTime: number;
  onStayLoggedIn: () => void;
}

export function IdleTimeoutWarning({ open, remainingTime, onStayLoggedIn }: IdleTimeoutWarningProps) {
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Session Timeout Warning
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>You have been inactive for a while. For security reasons, you will be automatically logged out in:</p>
              <p className="text-3xl font-bold text-center text-amber-600">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </p>
              <p className="text-sm">Click "Stay Logged In" to continue your session.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={onStayLoggedIn} className="w-full">
            Stay Logged In
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

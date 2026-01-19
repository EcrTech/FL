import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye, Mic, CreditCard, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecordingStage = 'liveness' | 'speak_details' | 'aadhaar_front' | 'aadhaar_back';

export interface StageConfig {
  id: RecordingStage;
  title: string;
  instruction: string;
  icon: React.ElementType;
  duration: number;
  color: string;
}

export const RECORDING_STAGES: StageConfig[] = [
  {
    id: 'liveness',
    title: 'Liveness Check',
    instruction: 'Look directly at the camera and blink your eyes slowly',
    icon: Eye,
    duration: 5,
    color: 'hsl(var(--primary))'
  },
  {
    id: 'speak_details',
    title: 'Speak Your Details',
    instruction: 'Say your full name and date of birth clearly',
    icon: Mic,
    duration: 10,
    color: 'hsl(var(--accent))'
  },
  {
    id: 'aadhaar_front',
    title: 'Show Aadhaar Front',
    instruction: 'Hold the FRONT of your Aadhaar card up to the camera',
    icon: CreditCard,
    duration: 8,
    color: 'hsl(var(--success))'
  },
  {
    id: 'aadhaar_back',
    title: 'Show Aadhaar Back',
    instruction: 'Now show the BACK of your Aadhaar card',
    icon: CreditCard,
    duration: 8,
    color: 'hsl(var(--warning))'
  }
];

interface RecordingStageOverlayProps {
  currentStageIndex: number;
  stageTimeRemaining: number;
  totalRecordingTime: number;
  onAdvanceStage: () => void;
  allStagesComplete: boolean;
  formatTime: (seconds: number) => string;
}

export function RecordingStageOverlay({
  currentStageIndex,
  stageTimeRemaining,
  totalRecordingTime,
  onAdvanceStage,
  allStagesComplete,
  formatTime
}: RecordingStageOverlayProps) {
  const currentStage = RECORDING_STAGES[currentStageIndex];
  const StageIcon = currentStage?.icon || Eye;
  
  const totalDuration = RECORDING_STAGES.reduce((sum, s) => sum + s.duration, 0);
  const completedDuration = RECORDING_STAGES.slice(0, currentStageIndex).reduce((sum, s) => sum + s.duration, 0);
  const currentProgress = currentStage ? (currentStage.duration - stageTimeRemaining) : 0;
  const overallProgress = ((completedDuration + currentProgress) / totalDuration) * 100;

  if (allStagesComplete) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Top: Recording badge */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
          <Badge className="bg-destructive text-white border-0 animate-pulse px-3 py-1.5">
            <span className="w-2 h-2 bg-white rounded-full mr-2 inline-block" />
            REC {formatTime(totalRecordingTime)}
          </Badge>
          <Badge variant="secondary" className="bg-[hsl(var(--success))] text-white border-0 px-3 py-1.5">
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            All Steps Complete
          </Badge>
        </div>

        {/* Center: Completion message */}
        <div className="absolute bottom-20 left-4 right-4 pointer-events-auto">
          <div className="bg-[hsl(var(--success))]/95 backdrop-blur-sm rounded-xl p-5 text-white text-center shadow-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-lg">All Steps Completed!</span>
            </div>
            <p className="text-white/90 text-sm">
              You can now click "Stop Recording" below
            </p>
          </div>
        </div>

        {/* Bottom: Progress dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {RECORDING_STAGES.map((stage, i) => (
            <div 
              key={stage.id}
              className="w-3 h-3 rounded-full bg-[hsl(var(--success))]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top: Recording badge + step counter */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
        <Badge className="bg-destructive text-white border-0 animate-pulse px-3 py-1.5">
          <span className="w-2 h-2 bg-white rounded-full mr-2 inline-block" />
          REC {formatTime(totalRecordingTime)}
        </Badge>
        <Badge variant="secondary" className="bg-background/80 text-foreground border-0 px-3 py-1.5">
          Step {currentStageIndex + 1} of {RECORDING_STAGES.length}
        </Badge>
      </div>

      {/* Center: Stage instruction card */}
      <div className="absolute bottom-28 left-4 right-4 pointer-events-auto">
        <div className="bg-black/85 backdrop-blur-sm rounded-xl p-5 text-white shadow-lg">
          {/* Stage title with icon */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: currentStage.color }}>
              <StageIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">{currentStage.title}</span>
          </div>
          
          {/* Instruction */}
          <p className="text-white/90 text-center text-base mb-4 font-medium">
            {currentStage.instruction}
          </p>
          
          {/* Timer and Next button */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-mono font-bold">{stageTimeRemaining}</span>
              <span className="text-white/70 text-sm">seconds</span>
            </div>
            <Button 
              size="sm" 
              onClick={onAdvanceStage}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Next Step →
            </Button>
          </div>
          
          {/* Stage progress bar */}
          <div className="mt-4">
            <Progress 
              value={((currentStage.duration - stageTimeRemaining) / currentStage.duration) * 100} 
              className="h-1.5 bg-white/20"
            />
          </div>
        </div>
      </div>

      {/* Bottom: Stage progress dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {RECORDING_STAGES.map((stage, i) => (
          <div 
            key={stage.id}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              i < currentStageIndex 
                ? "bg-[hsl(var(--success))]" 
                : i === currentStageIndex 
                  ? "bg-white animate-pulse scale-125" 
                  : "bg-white/30"
            )}
          />
        ))}
      </div>

      {/* Overall progress bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div 
          className="h-full bg-[hsl(var(--success))] transition-all duration-300"
          style={{ width: `${overallProgress}%` }}
        />
      </div>
    </div>
  );
}

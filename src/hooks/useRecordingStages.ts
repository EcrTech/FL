import { useState, useEffect, useCallback } from "react";
import { RECORDING_STAGES, RecordingStage } from "@/components/VideoKYC/RecordingStageOverlay";
import { toast } from "sonner";

interface UseRecordingStagesOptions {
  isRecording: boolean;
  onAllStagesComplete?: () => void;
}

export function useRecordingStages({ isRecording, onAllStagesComplete }: UseRecordingStagesOptions) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageTime, setStageTime] = useState(0);
  const [allStagesComplete, setAllStagesComplete] = useState(false);

  const currentStage = RECORDING_STAGES[currentStageIndex];
  const stageTimeRemaining = currentStage ? Math.max(0, currentStage.duration - stageTime) : 0;

  // Reset stages when recording starts
  useEffect(() => {
    if (isRecording) {
      setCurrentStageIndex(0);
      setStageTime(0);
      setAllStagesComplete(false);
    }
  }, [isRecording]);

  // Stage timer
  useEffect(() => {
    if (!isRecording || allStagesComplete) return;

    const timer = setInterval(() => {
      setStageTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording, allStagesComplete]);

  // Auto-advance stages
  useEffect(() => {
    if (!isRecording || allStagesComplete) return;

    const currentStage = RECORDING_STAGES[currentStageIndex];
    
    if (stageTime >= currentStage.duration) {
      if (currentStageIndex < RECORDING_STAGES.length - 1) {
        // Move to next stage
        const nextIndex = currentStageIndex + 1;
        setCurrentStageIndex(nextIndex);
        setStageTime(0);
        toast.info(`Now: ${RECORDING_STAGES[nextIndex].title}`, {
          duration: 2000,
        });
      } else {
        // All stages complete
        setAllStagesComplete(true);
        onAllStagesComplete?.();
        toast.success("All steps complete! You can stop recording now.", {
          duration: 3000,
        });
      }
    }
  }, [stageTime, currentStageIndex, isRecording, allStagesComplete, onAllStagesComplete]);

  const advanceStage = useCallback(() => {
    if (allStagesComplete) return;

    if (currentStageIndex < RECORDING_STAGES.length - 1) {
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
      setStageTime(0);
      toast.info(`Now: ${RECORDING_STAGES[nextIndex].title}`, {
        duration: 2000,
      });
    } else {
      setAllStagesComplete(true);
      onAllStagesComplete?.();
      toast.success("All steps complete! You can stop recording now.", {
        duration: 3000,
      });
    }
  }, [currentStageIndex, allStagesComplete, onAllStagesComplete]);

  const resetStages = useCallback(() => {
    setCurrentStageIndex(0);
    setStageTime(0);
    setAllStagesComplete(false);
  }, []);

  // Calculate minimum recording time based on all stages
  const minRecordingTime = RECORDING_STAGES.reduce((sum, s) => sum + s.duration, 0);

  return {
    currentStageIndex,
    stageTime,
    stageTimeRemaining,
    allStagesComplete,
    advanceStage,
    resetStages,
    minRecordingTime,
    currentStage,
  };
}

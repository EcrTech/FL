import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Video, Camera, Mic, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface VideoKYCStepProps {
  onComplete: () => void;
  onBack: () => void;
  isCompleted: boolean;
  applicantName: string;
}

export function VideoKYCStep({
  onComplete,
  onBack,
  isCompleted,
  applicantName,
}: VideoKYCStepProps) {
  const [step, setStep] = useState<'instructions' | 'permissions' | 'recording' | 'completed'>('instructions');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const checkPermissions = async () => {
    setCheckingPermissions(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: true,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setHasPermissions(true);
      setStep('permissions');
      toast.success("Camera and microphone access granted");
    } catch (error) {
      console.error('Permission error:', error);
      toast.error("Please allow camera and microphone access to proceed");
    } finally {
      setCheckingPermissions(false);
    }
  };

  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      toast.error("Camera not available");
      return;
    }

    try {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9,opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Recording stopped - video data is in chunksRef
        console.log('Recording completed, chunks:', chunksRef.current.length);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setStep('recording');
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Recording error:', error);
      toast.error("Failed to start recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      setStep('completed');
      onComplete();
      toast.success("Video KYC completed successfully");
    }
  }, [isRecording, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const minRecordingTime = 10; // Minimum 10 seconds

  if (isCompleted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-auto">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-green-800">Video KYC Completed</h3>
            <p className="text-green-600 mt-2">Your video verification has been recorded successfully.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-auto">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {step === 'instructions' && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Video KYC Instructions</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Camera className="h-5 w-5 mt-0.5 text-primary" />
                Ensure you are in a well-lit area with your face clearly visible
              </li>
              <li className="flex items-start gap-2">
                <Mic className="h-5 w-5 mt-0.5 text-primary" />
                Allow camera and microphone access when prompted
              </li>
              <li className="flex items-start gap-2">
                <Video className="h-5 w-5 mt-0.5 text-primary" />
                You will need to record a short video (minimum 10 seconds)
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5 text-primary" />
                Please state your name clearly during the recording
              </li>
            </ul>

            <Button
              onClick={checkPermissions}
              disabled={checkingPermissions}
              className="w-full h-12 bg-primary hover:bg-primary/90 mt-6"
            >
              {checkingPermissions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Checking permissions...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Allow Camera & Microphone
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {(step === 'permissions' || step === 'recording') && (
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <Badge variant="destructive" className="animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  REC {formatTime(recordingTime)}
                </Badge>
              </div>
            )}

            {step === 'permissions' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <Badge className="bg-green-500">
                  <Camera className="h-3 w-3 mr-1" /> Camera Ready
                </Badge>
                <Badge className="bg-green-500">
                  <Mic className="h-3 w-3 mr-1" /> Mic Ready
                </Badge>
              </div>
            )}
          </div>

          {step === 'permissions' && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Please say: <strong>"My name is {applicantName} and I am applying for a personal loan."</strong>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {step === 'permissions' && (
              <Button
                onClick={startRecording}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white"
              >
                <Video className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            )}

            {step === 'recording' && (
              <Button
                onClick={stopRecording}
                disabled={recordingTime < minRecordingTime}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white"
              >
                {recordingTime < minRecordingTime ? (
                  `Wait ${minRecordingTime - recordingTime}s...`
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Stop Recording
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

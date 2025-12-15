import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Video, Camera, Mic, ArrowLeft, AlertCircle, Play, Square } from "lucide-react";
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
        console.log('Recording completed, chunks:', chunksRef.current.length);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setStep('recording');
      setRecordingTime(0);

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

  const minRecordingTime = 10;

  if (isCompleted) {
    return (
      <div className="space-y-8">
        {/* Section Header */}
        <div className="flex items-center gap-4 pb-5 border-b border-border">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center">
            <Check className="h-6 w-6 text-[hsl(var(--success))]" />
          </div>
          <div>
            <h3 className="text-xl font-heading font-bold text-foreground">Application Submitted</h3>
            <p className="text-sm text-muted-foreground font-body">Your loan application is complete</p>
          </div>
        </div>

        <Card className="bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20 rounded-xl">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="w-24 h-24 bg-[hsl(var(--success))] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Check className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-heading font-bold text-[hsl(var(--success))] mb-3">Application Submitted Successfully!</h3>
            <p className="text-muted-foreground font-body mb-4">Thank you for completing your loan application.</p>
            <p className="text-sm text-muted-foreground font-body">Our team will review your application and contact you shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Video className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Video KYC</h3>
          <p className="text-sm text-muted-foreground font-body">Record a short video for identity verification</p>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Aadhaar Verification
      </button>

      {step === 'instructions' && (
        <Card className="border-2 border-[hsl(var(--coral-500))]/20 rounded-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[hsl(var(--coral-500))] to-[hsl(var(--coral-400))]" />
          <CardContent className="p-6">
            <h4 className="text-lg font-heading font-bold text-foreground mb-5">Mandatory Instructions for Video KYC</h4>
            
            <div className="bg-[hsl(var(--coral-500))]/5 border border-[hsl(var(--coral-500))]/20 rounded-xl p-5 mb-6">
              <p className="font-heading font-bold text-foreground mb-4">During the recording, you must:</p>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="text-foreground font-body">
                  <span className="font-semibold">Speak your full name and Date of Birth</span> clearly
                </li>
                <li className="text-foreground font-body">
                  <span className="font-semibold">Show the front and back of your Aadhaar card</span> to the camera
                </li>
                <li className="text-foreground font-body">
                  <span className="font-semibold">Stop recording</span> after you have completed the above steps
                </li>
              </ol>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-foreground">Good Lighting</p>
                  <p className="text-sm text-muted-foreground font-body">Ensure you are in a well-lit area with your face clearly visible</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-foreground">Clear Audio</p>
                  <p className="text-sm text-muted-foreground font-body">Speak clearly when stating your name and DOB</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-foreground">Keep Aadhaar Ready</p>
                  <p className="text-sm text-muted-foreground font-body">Have your Aadhaar card ready to show both sides</p>
                </div>
              </li>
            </ul>

            <Button
              onClick={checkPermissions}
              disabled={checkingPermissions}
              className="w-full h-14 text-base font-heading font-bold btn-electric rounded-xl mt-6"
            >
              {checkingPermissions ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Checking permissions...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Video KYC
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {(step === 'permissions' || step === 'recording') && (
        <div className="space-y-5">
          <div className="relative aspect-video bg-foreground rounded-2xl overflow-hidden shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            
            {isRecording && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-[hsl(var(--error))] text-white border-0 font-heading px-4 py-2 text-sm animate-pulse-record">
                  <span className="w-2.5 h-2.5 bg-white rounded-full mr-2 inline-block" />
                  REC {formatTime(recordingTime)}
                </Badge>
              </div>
            )}

            {step === 'permissions' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Badge className="bg-[hsl(var(--success))] text-white border-0 font-heading">
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> Camera Ready
                </Badge>
                <Badge className="bg-[hsl(var(--success))] text-white border-0 font-heading">
                  <Mic className="h-3.5 w-3.5 mr-1.5" /> Mic Ready
                </Badge>
              </div>
            )}
          </div>

          {step === 'permissions' && (
            <Card className="bg-[hsl(var(--electric-blue-100))] border-0 rounded-xl">
              <CardContent className="p-5">
                <p className="text-sm text-foreground font-body font-semibold mb-2">Remember to:</p>
                <ol className="text-sm text-foreground font-body list-decimal list-inside space-y-1">
                  <li>Speak your <span className="text-primary font-semibold">Name</span> and <span className="text-primary font-semibold">Date of Birth</span></li>
                  <li>Show <span className="text-primary font-semibold">front and back of Aadhaar</span></li>
                  <li>Click <span className="text-primary font-semibold">Stop Recording</span> when done</li>
                </ol>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            {step === 'permissions' && (
              <Button
                onClick={startRecording}
                className="flex-1 h-14 text-base font-heading font-bold btn-coral rounded-xl"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            )}

            {step === 'recording' && (
              <Button
                onClick={stopRecording}
                disabled={recordingTime < minRecordingTime}
                className="flex-1 h-14 text-base font-heading font-bold bg-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/90 text-white rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {recordingTime < minRecordingTime ? (
                  `Wait ${minRecordingTime - recordingTime}s...`
                ) : (
                  <>
                    <Square className="h-5 w-5 mr-2" />
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

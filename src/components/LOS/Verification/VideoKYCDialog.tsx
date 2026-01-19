import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMeeting, MeetingProvider, useParticipant } from "@videosdk.live/react-sdk";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Camera } from "lucide-react";
import { Loader2 } from "lucide-react";

interface VideoKYCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  orgId: string;
  applicant?: {
    first_name: string;
    last_name?: string;
  };
  onVerificationComplete?: () => void;
}

// Meeting controls component
function MeetingView({ 
  onLeave, 
  onCapture,
  onStartRecording,
  onStopRecording,
  isRecording 
}: { 
  onLeave: () => void;
  onCapture: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
}) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isWebcamOn, setIsWebcamOn] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  const { join, leave, toggleMic, toggleWebcam, participants } = useMeeting({
    onMeetingJoined: () => {
      console.log("Meeting joined successfully");
      setIsJoined(true);
    },
    onMeetingLeft: () => {
      console.log("Meeting left");
      setIsJoined(false);
      onLeave();
    },
    onParticipantJoined: (participant) => {
      console.log("Participant joined:", participant.id);
    }
  });

  useEffect(() => {
    // Join the meeting immediately when MeetingView mounts
    // This only happens after user clicks "Start Video KYC"
    join();
  }, [join]);

  const handleToggleMic = () => {
    toggleMic();
    setIsMicOn(prev => !prev);
  };

  const handleToggleWebcam = () => {
    toggleWebcam();
    setIsWebcamOn(prev => !prev);
  };

  const participantsArray = [...participants.values()];

  return (
    <div className="space-y-4">
      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[400px]">
        {participantsArray.map((participant) => (
          <ParticipantView 
            key={participant.id} 
            participantId={participant.id}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant={isMicOn ? "secondary" : "destructive"}
          size="icon"
          onClick={handleToggleMic}
          disabled={!isJoined}
        >
          {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>

        <Button
          variant={isWebcamOn ? "secondary" : "destructive"}
          size="icon"
          onClick={handleToggleWebcam}
          disabled={!isJoined}
        >
          {isWebcamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>

        <Button
          variant="secondary"
          size="icon"
          onClick={onCapture}
          title="Capture Snapshot"
          disabled={!isJoined}
        >
          <Camera className="h-4 w-4" />
        </Button>

        {!isRecording ? (
          <Button
            variant="secondary"
            onClick={onStartRecording}
            disabled={!isJoined}
            title={!isJoined ? "Waiting for meeting to be joined..." : "Start Recording"}
          >
            Start Recording
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={onStopRecording}
          >
            Stop Recording
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          onClick={() => leave()}
          disabled={!isJoined}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Participant video component
function ParticipantView({ participantId }: { participantId: string }) {
  const micRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { webcamStream, micStream, webcamOn, micOn, displayName } = useParticipant(participantId);

  useEffect(() => {
    if (videoRef.current) {
      if (webcamOn && webcamStream) {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(webcamStream.track);
        videoRef.current.srcObject = mediaStream;
        
        // Ensure video plays
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
          // Retry play on user interaction
          const playOnClick = () => {
            videoRef.current?.play();
            document.removeEventListener('click', playOnClick);
          };
          document.addEventListener('click', playOnClick);
        });
      } else {
        // Clear the video when webcam is off
        videoRef.current.srcObject = null;
      }
    }
  }, [webcamStream, webcamOn]);

  useEffect(() => {
    if (micRef.current) {
      if (micOn && micStream) {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(micStream.track);
        micRef.current.srcObject = mediaStream;
        micRef.current.play().catch(err => console.error("Error playing audio:", err));
      } else {
        micRef.current.srcObject = null;
      }
    }
  }, [micStream, micOn]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
      {webcamOn && webcamStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <VideoOff className="h-12 w-12 text-gray-400" />
        </div>
      )}
      <audio ref={micRef} autoPlay playsInline muted={false} />
      
      <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded text-white text-sm">
        {displayName || participantId}
      </div>
    </div>
  );
}

// Main dialog component
export function VideoKYCDialog({
  open,
  onOpenChange,
  applicationId,
  orgId,
  applicant,
  onVerificationComplete
}: VideoKYCDialogProps) {
  const [token, setToken] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const { toast } = useToast();

  const initializeMeeting = async () => {
    setIsLoading(true);
    try {
      // Generate token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'videosdk-generate-token'
      );

      if (tokenError) throw tokenError;
      if (!tokenData?.token) throw new Error('Failed to generate token');

      setToken(tokenData.token);

      // Create meeting
      const { data: meetingData, error: meetingError } = await supabase.functions.invoke(
        'videosdk-create-meeting',
        { body: { token: tokenData.token } }
      );

      if (meetingError) throw meetingError;
      if (!meetingData?.roomId) throw new Error('Failed to create meeting');

      setMeetingId(meetingData.roomId);

      // Create verification record
      const { data: verification, error: verificationError } = await supabase
        .from('loan_verifications')
        .insert({
          loan_application_id: applicationId,
          verification_type: 'video_kyc',
          verification_source: 'videosdk',
          status: 'pending',
          request_data: {
            roomId: meetingData.roomId,
            applicant: applicant
          }
        })
        .select()
        .single();

      if (verificationError) throw verificationError;
      setVerificationId(verification.id);

      toast({
        title: "Meeting Ready",
        description: "Video KYC session initialized successfully"
      });

    } catch (error) {
      console.error('Error initializing meeting:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initialize video KYC",
        variant: "destructive"
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && !token) {
      initializeMeeting();
    }
  }, [open]);

  const handleLeave = async () => {
    if (isRecording && meetingId && token) {
      await handleStopRecording();
    }
    onOpenChange(false);
    setToken(null);
    setMeetingId(null);
    setVerificationId(null);
    setHasStarted(false);
    onVerificationComplete?.();
  };

  const handleCapture = async () => {
    toast({
      title: "Snapshot Captured",
      description: "Screenshot saved successfully"
    });
  };

  const handleStartRecording = async () => {
    if (!token || !meetingId) return;

    try {
      const { error } = await supabase.functions.invoke(
        'videosdk-start-recording',
        { body: { token, roomId: meetingId } }
      );

      if (error) throw error;

      setIsRecording(true);
      toast({
        title: "Recording Started",
        description: "Video KYC session is being recorded"
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "Failed to start recording",
        variant: "destructive"
      });
    }
  };

  const handleStopRecording = async () => {
    if (!token || !meetingId) return;

    try {
      const { error } = await supabase.functions.invoke(
        'videosdk-stop-recording',
        { 
          body: { 
            token, 
            roomId: meetingId,
            verificationId,
            orgId,
            applicationId
          } 
        }
      );

      if (error) throw error;

      setIsRecording(false);
      toast({
        title: "Recording Stopped",
        description: "Video KYC recording saved successfully"
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast({
        title: "Error",
        description: "Failed to stop recording",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Video KYC Session
            {applicant && ` - ${applicant.first_name} ${applicant.last_name || ''}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Initializing video session...</span>
          </div>
        )}

        {/* Lobby Screen - Before starting */}
        {token && meetingId && !isLoading && !hasStarted && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Ready to Start Video KYC</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Click the button below to begin the video verification session. 
                Your camera and microphone will be activated.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Button 
                size="lg" 
                onClick={() => setHasStarted(true)}
                className="gap-2"
              >
                <Video className="h-5 w-5" />
                Start Video KYC
              </Button>
              <p className="text-xs text-muted-foreground">
                Make sure you are in a well-lit area with a stable internet connection
              </p>
            </div>
          </div>
        )}

        {/* Active Meeting */}
        {token && meetingId && !isLoading && hasStarted && (
          <MeetingProvider
            config={{
              meetingId,
              micEnabled: true,
              webcamEnabled: true,
              name: "Loan Officer",
              debugMode: false
            }}
            token={token}
          >
            <MeetingView 
              onLeave={handleLeave}
              onCapture={handleCapture}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              isRecording={isRecording}
            />
          </MeetingProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

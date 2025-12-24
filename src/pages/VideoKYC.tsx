import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Camera, Mic, CheckCircle, XCircle, Clock, Play, Square, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type PageState = "loading" | "instructions" | "permissions" | "recording" | "uploading" | "success" | "error" | "expired" | "completed";

export default function VideoKYC() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [applicantName, setApplicantName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermissions, setHasPermissions] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("videokyc-verify-token", {
        body: { token },
      });

      if (error) {
        console.error("Error verifying token:", error);
        setErrorMessage("Failed to verify link. Please try again.");
        setPageState("error");
        return;
      }

      if (!data.valid) {
        if (data.status === "expired") {
          setPageState("expired");
        } else if (data.status === "completed") {
          setCompletedAt(data.completed_at);
          setPageState("completed");
        } else {
          setErrorMessage(data.error || "Invalid link");
          setPageState("error");
        }
        return;
      }

      setApplicantName(data.applicant_name);
      setPageState("instructions");
    } catch (err) {
      console.error("Error:", err);
      setErrorMessage("Something went wrong. Please try again.");
      setPageState("error");
    }
  };

  const checkPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setHasPermissions(true);
      setPageState("permissions");
      toast.success("Camera and microphone access granted");
    } catch (error) {
      console.error("Permission error:", error);
      toast.error("Please allow camera and microphone access to proceed");
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
        mimeType: "video/webm;codecs=vp9,opus",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setPageState("recording");
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Recording error:", error);
      toast.error("Failed to start recording");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Wait for data to be available
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Upload the recording
      await uploadRecording();
    }
  }, [isRecording, token]);

  const uploadRecording = async () => {
    setPageState("uploading");

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const formData = new FormData();
      formData.append("token", token!);
      formData.append("video", blob, "video.webm");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/videokyc-upload-recording`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Upload failed");
      }

      setPageState("success");
      toast.success("Video KYC completed successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage("Failed to upload video. Please try again.");
      setPageState("error");
      toast.error("Failed to upload video");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const minRecordingTime = 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Video KYC Verification</h1>
          <p className="text-muted-foreground mt-1">Complete your identity verification</p>
        </div>

        {/* Loading State */}
        {pageState === "loading" && (
          <Card className="border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying your link...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {pageState === "error" && (
          <Card className="border-2 border-destructive/20">
            <CardContent className="pt-8 pb-8 text-center">
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-destructive mb-2">Something went wrong</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
              <p className="text-sm text-muted-foreground mt-4">Please contact your loan officer for a new link.</p>
            </CardContent>
          </Card>
        )}

        {/* Expired State */}
        {pageState === "expired" && (
          <Card className="border-2 border-amber-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-amber-600 mb-2">Link Expired</h2>
              <p className="text-muted-foreground">This Video KYC link has expired.</p>
              <p className="text-sm text-muted-foreground mt-4">Please contact your loan officer for a new link.</p>
            </CardContent>
          </Card>
        )}

        {/* Already Completed State */}
        {pageState === "completed" && (
          <Card className="border-2 border-green-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-600 mb-2">Already Completed</h2>
              <p className="text-muted-foreground">Your Video KYC has already been submitted.</p>
              {completedAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Completed on {new Date(completedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions State */}
        {pageState === "instructions" && (
          <Card className="border-2">
            <CardHeader className="text-center">
              <CardTitle>Welcome, {applicantName}</CardTitle>
              <CardDescription>Please follow these instructions carefully</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-200">During the recording, you must:</p>
                    <ol className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300 list-decimal list-inside">
                      <li>Speak your <strong>full name</strong> and <strong>Date of Birth</strong></li>
                      <li>Show the <strong>front and back of your Aadhaar card</strong></li>
                      <li>Click <strong>Stop Recording</strong> when done</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Camera className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Good Lighting</p>
                    <p className="text-sm text-muted-foreground">Ensure your face is clearly visible</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Mic className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Clear Audio</p>
                    <p className="text-sm text-muted-foreground">Speak clearly when stating your details</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Video className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Keep Aadhaar Ready</p>
                    <p className="text-sm text-muted-foreground">Have your Aadhaar card ready to show</p>
                  </div>
                </div>
              </div>

              <Button onClick={checkPermissions} className="w-full h-12" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Start Video KYC
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Permissions / Recording State */}
        {(pageState === "permissions" || pageState === "recording") && (
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />

                {isRecording && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-destructive text-white border-0 animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full mr-2 inline-block" />
                      REC {formatTime(recordingTime)}
                    </Badge>
                  </div>
                )}

                {pageState === "permissions" && hasPermissions && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-500 text-white border-0">
                      <Camera className="h-3 w-3 mr-1" /> Camera Ready
                    </Badge>
                    <Badge variant="secondary" className="bg-green-500 text-white border-0">
                      <Mic className="h-3 w-3 mr-1" /> Mic Ready
                    </Badge>
                  </div>
                )}
              </div>

              {pageState === "permissions" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Remember to:</p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Speak your Name and Date of Birth</li>
                    <li>Show front and back of Aadhaar</li>
                    <li>Click Stop Recording when done</li>
                  </ol>
                </div>
              )}

              {pageState === "permissions" && (
                <Button onClick={startRecording} className="w-full h-12" size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Start Recording
                </Button>
              )}

              {pageState === "recording" && (
                <Button
                  onClick={stopRecording}
                  disabled={recordingTime < minRecordingTime}
                  variant="destructive"
                  className="w-full h-12"
                  size="lg"
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
            </CardContent>
          </Card>
        )}

        {/* Uploading State */}
        {pageState === "uploading" && (
          <Card className="border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Uploading your video...</h2>
              <p className="text-muted-foreground">Please wait while we process your recording.</p>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {pageState === "success" && (
          <Card className="border-2 border-green-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-600 mb-2">Video KYC Completed!</h2>
              <p className="text-muted-foreground">Thank you for completing your video verification.</p>
              <p className="text-sm text-muted-foreground mt-4">You can now close this page.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

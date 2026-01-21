import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, X, FileText, Image, Check, Camera, MapPin } from "lucide-react";

interface DocumentItem {
  type: string;
  file: File | null;
  base64: string;
  name: string;
  mimeType: string;
}

interface DocumentUploadStepProps {
  data: DocumentItem[];
  requiredDocuments: string[];
  onChange: (docs: DocumentItem[]) => void;
  onNext: () => void;
  onPrev: () => void;
  geolocation?: { latitude: number; longitude: number; accuracy: number } | null;
}

const DOCUMENT_LABELS: Record<string, { label: string; description: string }> = {
  pan_card: { label: "PAN Card", description: "Clear photo/scan of your PAN card" },
  aadhaar_card: { label: "Aadhaar Card", description: "Front and back of Aadhaar" },
  aadhaar_front: { label: "Aadhaar Card (Front)", description: "Front side of Aadhaar" },
  aadhaar_back: { label: "Aadhaar Card (Back)", description: "Back side of Aadhaar" },
  voter_card: { label: "Voter ID Card", description: "Front and back of Voter ID" },
  salary_slip: { label: "Salary Slips", description: "Last 3 months salary slips" },
  bank_statement: { label: "Bank Statement", description: "Last 6 months statement" },
  photo: { label: "Passport Photo", description: "Recent passport size photo" },
  selfie: { label: "Selfie Photo", description: "Take a clear selfie photo with good lighting" },
  address_proof: { label: "Address Proof", description: "Utility bill or rent agreement" },
  rental_agreement: { label: "Rental Agreement", description: "Current rental/lease agreement" },
  utility_bill: { label: "Utility Bill", description: "Recent electricity, water, or gas bill" },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function DocumentUploadStep({ 
  data, 
  requiredDocuments, 
  onChange, 
  onNext, 
  onPrev,
  geolocation 
}: DocumentUploadStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Default documents if none specified - now includes voter_card, selfie, photo, rental_agreement, utility_bill
  const documents = requiredDocuments.length > 0 
    ? requiredDocuments 
    : ["pan_card", "aadhaar_front", "aadhaar_back", "voter_card", "selfie", "photo", "rental_agreement", "utility_bill", "salary_slip", "bank_statement"];

  const getDocumentByType = (type: string) => {
    return data.find(d => d.type === type);
  };

  const handleFileSelect = async (type: string, file: File) => {
    setErrors(prev => ({ ...prev, [type]: "" }));

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: "Only JPG, PNG, WebP, and PDF files are allowed" }));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrors(prev => ({ ...prev, [type]: "File size must be less than 5MB" }));
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      
      const newDoc: DocumentItem = {
        type,
        file,
        base64,
        name: file.name,
        mimeType: file.type,
      };

      // Update or add document
      const existingIndex = data.findIndex(d => d.type === type);
      if (existingIndex >= 0) {
        const updated = [...data];
        updated[existingIndex] = newDoc;
        onChange(updated);
      } else {
        onChange([...data, newDoc]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (type: string) => {
    onChange(data.filter(d => d.type !== type));
    if (fileInputRefs.current[type]) {
      fileInputRefs.current[type]!.value = "";
    }
  };

  // Camera functions for selfie
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Unable to access camera. Please allow camera access or upload a file instead.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" });
        handleFileSelect("selfie", file);
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check required documents (PAN, Aadhaar, Selfie, Photo, Rental Agreement, Utility Bill are required)
    const hasPan = data.some(d => d.type === "pan_card");
    const hasAadhaar = data.some(d => d.type === "aadhaar_card" || d.type === "aadhaar_front");
    const hasSelfie = data.some(d => d.type === "selfie");
    const hasPhoto = data.some(d => d.type === "photo");
    const hasRentalAgreement = data.some(d => d.type === "rental_agreement");
    const hasUtilityBill = data.some(d => d.type === "utility_bill");
    
    const newErrors: Record<string, string> = {};
    if (!hasPan) newErrors.pan_card = "PAN Card is required";
    if (!hasAadhaar) newErrors.aadhaar_front = "Aadhaar Card is required";
    if (!hasSelfie) newErrors.selfie = "Selfie photo is required";
    if (!hasPhoto) newErrors.photo = "Passport Photo is required";
    if (!hasRentalAgreement) newErrors.rental_agreement = "Rental Agreement is required";
    if (!hasUtilityBill) newErrors.utility_bill = "Utility Bill is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onNext();
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <Image className="h-5 w-5 text-blue-500" />;
  };

  const isRequired = (docType: string) => {
    return ["pan_card", "aadhaar_front", "aadhaar_card", "selfie", "photo", "rental_agreement", "utility_bill"].includes(docType);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Upload Documents</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Upload clear photos or scans of your documents
        </p>
      </div>

      {/* Geolocation Status */}
      {geolocation && (
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
          <MapPin className="h-4 w-4" />
          <span>Location captured (Accuracy: {Math.round(geolocation.accuracy)}m)</span>
        </div>
      )}

      {/* Hidden canvas for capturing selfie */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="space-y-4">
        {documents.map((docType) => {
          const docInfo = DOCUMENT_LABELS[docType] || { label: docType, description: "" };
          const uploaded = getDocumentByType(docType);
          const error = errors[docType];
          const isSelfie = docType === "selfie";

          return (
            <div key={docType} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <Label className="text-sm font-medium">
                    {docInfo.label}
                    {isRequired(docType) && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <p className="text-xs text-muted-foreground">{docInfo.description}</p>
                </div>
                {uploaded && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs">Uploaded</span>
                  </div>
                )}
              </div>

              {uploaded ? (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(uploaded.mimeType)}
                    <span className="text-sm truncate">{uploaded.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(docType)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : isSelfie ? (
                <div>
                  {cameraActive ? (
                    <div className="space-y-3">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full rounded-lg bg-black aspect-video object-cover"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Capture
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={stopCamera}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cameraError && (
                        <p className="text-xs text-destructive">{cameraError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 h-16"
                          onClick={startCamera}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <Camera className="h-5 w-5 text-primary" />
                            <span className="text-xs">Take Selfie</span>
                          </div>
                        </Button>
                        <div className="flex-1">
                          <input
                            type="file"
                            ref={(el) => (fileInputRefs.current[docType] = el)}
                            accept="image/*"
                            capture="user"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(docType, file);
                            }}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-16"
                            onClick={() => fileInputRefs.current[docType]?.click()}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Upload className="h-5 w-5 text-muted-foreground" />
                              <span className="text-xs">Upload File</span>
                            </div>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    ref={(el) => (fileInputRefs.current[docType] = el)}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(docType, file);
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-20 border-dashed"
                    onClick={() => fileInputRefs.current[docType]?.click()}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload
                      </span>
                      <span className="text-xs text-muted-foreground">
                        JPG, PNG, PDF (max 5MB)
                      </span>
                    </div>
                  </Button>
                </div>
              )}

              {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        * Required documents. Other documents are optional but recommended.
      </p>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onPrev} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button type="submit" className="flex-1">
          Review Application
        </Button>
      </div>
    </form>
  );
}

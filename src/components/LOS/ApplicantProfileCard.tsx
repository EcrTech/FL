import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { User, FileText, CheckCircle, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  document_type: string;
  document_category: string;
  file_path: string;
  file_name: string;
  verification_status: string;
}

interface ApplicantProfileCardProps {
  applicationId: string;
  applicantName: string;
  panNumber?: string;
  aadhaarNumber?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
}

const DocumentCard = ({ 
  document, 
  onView 
}: { 
  document: Document; 
  onView: (url: string, name: string, isPdf: boolean) => void;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!document.file_path) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from('loan-documents')
          .createSignedUrl(document.file_path, 3600);
        
        if (error || !data) {
          setError(true);
        } else {
          setImageUrl(data.signedUrl);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [document.file_path]);

  const getDocumentLabel = () => {
    const type = document.document_type?.toLowerCase() || '';
    if (type.includes('pan')) return 'PAN Card';
    if (type.includes('aadhaar') || type.includes('aadhar')) return 'Aadhaar Card';
    if (type.includes('employee') || type.includes('id card')) return 'Employee ID';
    return document.document_type || 'Document';
  };

  const isVerified = document.verification_status === 'verified';
  const isPdf = document.file_name?.toLowerCase().endsWith('.pdf');

  return (
    <div 
      className={cn(
        "relative flex-1 h-32 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2",
        isVerified 
          ? "border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" 
          : "border-border hover:border-muted-foreground/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => imageUrl && onView(imageUrl, getDocumentLabel(), isPdf)}
    >
      {/* Document Content */}
      <div className="w-full h-full bg-muted flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : error || !imageUrl ? (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{getDocumentLabel()}</span>
          </div>
        ) : isPdf ? (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-10 w-10 text-red-500" />
            <span className="text-xs text-muted-foreground">{getDocumentLabel()}</span>
          </div>
        ) : (
          <img 
            src={imageUrl} 
            alt={getDocumentLabel()}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        )}
      </div>

      {/* Verified Checkmark */}
      {isVerified && (
        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
          <CheckCircle className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Label Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <span className="text-xs font-medium text-white">{getDocumentLabel()}</span>
      </div>

      {/* Hover View Overlay */}
      {isHovered && imageUrl && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">
          <div className="flex items-center gap-1.5 text-white bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">View</span>
          </div>
        </div>
      )}
    </div>
  );
};

export function ApplicantProfileCard({
  applicationId,
  applicantName,
  panNumber,
  aadhaarNumber,
  mobile,
  dateOfBirth,
  gender,
}: ApplicantProfileCardProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      const { data, error } = await supabase
        .from('loan_documents')
        .select('id, document_type, document_category, file_path, file_name, verification_status')
        .eq('loan_application_id', applicationId)
        .in('document_category', ['identity', 'photo']);

      if (!error && data) {
        setDocuments(data);
        
        // Find photo document
        const photoDoc = data.find(d => 
          d.document_type?.toLowerCase().includes('photo') ||
          d.document_category?.toLowerCase().includes('photo')
        );
        
        if (photoDoc?.file_path) {
          const { data: signedData } = await supabase.storage
            .from('loan-documents')
            .createSignedUrl(photoDoc.file_path, 3600);
          if (signedData) {
            setPhotoUrl(signedData.signedUrl);
          }
        }
      }
      setLoading(false);
    };

    fetchDocuments();
  }, [applicationId]);

  const handleViewDocument = (url: string, name: string, isPdf: boolean = false) => {
    setViewerImage({ url, name, isPdf });
    setViewerOpen(true);
  };

  // Filter key documents (PAN and Aadhaar only)
  const panDoc = documents.find(d => d.document_type?.toLowerCase().includes('pan'));
  const aadhaarDoc = documents.find(d => 
    d.document_type?.toLowerCase().includes('aadhaar') || 
    d.document_type?.toLowerCase().includes('aadhar')
  );

  const keyDocs = [panDoc, aadhaarDoc].filter(Boolean) as Document[];

  return (
    <>
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex gap-6">
            {/* Left Side - Photo and Name */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              {/* Profile Photo - Circular */}
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center border-2 border-primary/20 bg-muted">
                {photoUrl ? (
                  <img 
                    src={photoUrl} 
                    alt={applicantName}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => photoUrl && handleViewDocument(photoUrl, 'Applicant Photo')}
                  />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              {/* Name below photo */}
              <div className="text-center max-w-[120px]">
                <h3 className="text-sm font-semibold leading-tight">{applicantName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{panNumber || ''}</p>
              </div>
            </div>

            {/* Right Side - Document Cards */}
            <div className="flex-1 flex gap-3">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : keyDocs.length > 0 ? (
                keyDocs.map(doc => (
                  <DocumentCard 
                    key={doc.id} 
                    document={doc} 
                    onView={handleViewDocument}
                  />
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No documents uploaded
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{viewerImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-[75vh] overflow-auto">
            {viewerImage && (
              viewerImage.isPdf ? (
                <iframe 
                  src={viewerImage.url}
                  title={viewerImage.name}
                  className="w-full h-full border-0"
                />
              ) : (
                <img 
                  src={viewerImage.url} 
                  alt={viewerImage.name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

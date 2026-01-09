import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { User, CreditCard, FileText, CheckCircle, XCircle, Clock, Eye, Loader2 } from "lucide-react";

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

const DocumentThumbnail = ({ 
  document, 
  onView 
}: { 
  document: Document; 
  onView: (url: string, name: string) => void;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const getVerificationBadge = () => {
    switch (document.verification_status) {
      case 'verified':
        return <Badge className="bg-green-500/10 text-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-600 text-xs"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getDocumentLabel = () => {
    const type = document.document_type?.toLowerCase() || '';
    if (type.includes('pan')) return 'PAN Card';
    if (type.includes('aadhaar') || type.includes('aadhar')) return 'Aadhaar Card';
    if (type.includes('photo')) return 'Photo';
    return document.document_type || 'Document';
  };

  const isPdf = document.file_name?.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="relative w-20 h-24 bg-muted rounded overflow-hidden flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : error || !imageUrl ? (
          <FileText className="h-8 w-8 text-muted-foreground" />
        ) : isPdf ? (
          <FileText className="h-8 w-8 text-red-500" />
        ) : (
          <img 
            src={imageUrl} 
            alt={getDocumentLabel()}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        )}
      </div>
      <span className="text-xs font-medium text-center">{getDocumentLabel()}</span>
      {getVerificationBadge()}
      {imageUrl && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs"
          onClick={() => onView(imageUrl, getDocumentLabel())}
        >
          <Eye className="h-3 w-3 mr-1" />View
        </Button>
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
  const [viewerImage, setViewerImage] = useState<{ url: string; name: string } | null>(null);

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

  const handleViewDocument = (url: string, name: string) => {
    setViewerImage({ url, name });
    setViewerOpen(true);
  };

  // Filter key documents
  const panDoc = documents.find(d => d.document_type?.toLowerCase().includes('pan'));
  const aadhaarDoc = documents.find(d => 
    d.document_type?.toLowerCase().includes('aadhaar') || 
    d.document_type?.toLowerCase().includes('aadhar')
  );
  const photoDoc = documents.find(d => d.document_type?.toLowerCase().includes('photo'));

  const keyDocs = [panDoc, aadhaarDoc, photoDoc].filter(Boolean) as Document[];

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="w-28 h-36 bg-muted rounded-lg overflow-hidden flex items-center justify-center border">
                {photoUrl ? (
                  <img 
                    src={photoUrl} 
                    alt={applicantName}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => photoUrl && handleViewDocument(photoUrl, 'Applicant Photo')}
                  />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold truncate">{applicantName}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-2 text-sm">
                <div>
                  <span className="text-muted-foreground">PAN:</span>
                  <span className="ml-1 font-medium">{panNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mobile:</span>
                  <span className="ml-1 font-medium">{mobile || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">DOB:</span>
                  <span className="ml-1 font-medium">{dateOfBirth || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="ml-1 font-medium">{gender || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Document Thumbnails */}
            <div className="flex-shrink-0 hidden lg:flex gap-2">
              {loading ? (
                <div className="flex items-center justify-center w-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : keyDocs.length > 0 ? (
                keyDocs.map(doc => (
                  <DocumentThumbnail 
                    key={doc.id} 
                    document={doc} 
                    onView={handleViewDocument}
                  />
                ))
              ) : (
                <div className="flex items-center text-sm text-muted-foreground">
                  No documents
                </div>
              )}
            </div>
          </div>

          {/* Mobile Document Grid */}
          <div className="lg:hidden mt-4 grid grid-cols-3 gap-2">
            {!loading && keyDocs.map(doc => (
              <DocumentThumbnail 
                key={doc.id} 
                document={doc} 
                onView={handleViewDocument}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewerImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
            {viewerImage && (
              <img 
                src={viewerImage.url} 
                alt={viewerImage.name}
                className="max-w-full max-h-[65vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

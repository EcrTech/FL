import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Eye, 
  RefreshCw, 
  User,
  CreditCard,
  FileText,
  Image,
  Shield,
  Building,
} from "lucide-react";
import { CustomerRelationship, CustomerDocument } from "@/hooks/useCustomerRelationships";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface CustomerCardProps {
  customer: CustomerRelationship;
  onViewDetails: (customer: CustomerRelationship) => void;
  onShareReferralLink: () => void;
}

const scoreColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-red-100 text-red-800 border-red-200",
};

const documentIcons: Record<string, React.ReactNode> = {
  'pan_card': <CreditCard className="h-4 w-4" />,
  'aadhaar_front': <Shield className="h-4 w-4" />,
  'aadhaar_back': <Shield className="h-4 w-4" />,
  'photo': <User className="h-4 w-4" />,
  'bank_statement': <Building className="h-4 w-4" />,
  'default': <FileText className="h-4 w-4" />,
};

const getDocumentIcon = (docType: string) => {
  const type = docType?.toLowerCase() || '';
  if (type.includes('pan')) return documentIcons['pan_card'];
  if (type.includes('aadhaar') && type.includes('front')) return documentIcons['aadhaar_front'];
  if (type.includes('aadhaar')) return documentIcons['aadhaar_back'];
  if (type.includes('photo')) return documentIcons['photo'];
  if (type.includes('bank')) return documentIcons['bank_statement'];
  return documentIcons['default'];
};

const getDocumentLabel = (docType: string) => {
  const type = docType?.toLowerCase() || '';
  if (type.includes('pan')) return 'PAN Card';
  if (type.includes('aadhaar') && type.includes('front')) return 'Aadhaar Front';
  if (type.includes('aadhaar') && type.includes('back')) return 'Aadhaar Back';
  if (type.includes('aadhaar')) return 'Aadhaar';
  if (type.includes('photo')) return 'Photo';
  if (type.includes('bank')) return 'Bank Statement';
  return docType || 'Document';
};

function DocumentThumbnail({ document }: { document: CustomerDocument }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!document.filePath) return;
      
      // Check if it's an image file
      const fileName = document.fileName?.toLowerCase() || document.filePath.toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const isImageFile = imageExtensions.some(ext => fileName.endsWith(ext));
      
      setIsImage(isImageFile);
      
      if (isImageFile) {
        try {
          const { data } = supabase.storage
            .from('loan-documents')
            .getPublicUrl(document.filePath);
          setImageUrl(data.publicUrl);
        } catch (error) {
          console.error('Error loading image:', error);
        }
      }
    };
    
    loadImage();
  }, [document.filePath, document.fileName]);

  const verificationColor = 
    document.verificationStatus === 'verified' ? 'bg-green-500' :
    document.verificationStatus === 'rejected' ? 'bg-red-500' :
    'bg-yellow-500';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative w-14 h-14 rounded-lg border border-border bg-muted/50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors group">
            {isImage && imageUrl ? (
              <img 
                src={imageUrl} 
                alt={getDocumentLabel(document.documentType)}
                className="w-full h-full object-cover"
                onError={() => setIsImage(false)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                {getDocumentIcon(document.documentType)}
                <span className="text-[8px] mt-0.5 truncate max-w-[40px]">
                  {getDocumentLabel(document.documentType).substring(0, 6)}
                </span>
              </div>
            )}
            {/* Verification indicator */}
            <div className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${verificationColor}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{getDocumentLabel(document.documentType)}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {document.verificationStatus || 'Pending verification'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CustomerCard({ customer, onViewDetails, onShareReferralLink }: CustomerCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadAvatar = async () => {
      if (!customer.photoUrl) return;
      
      try {
        const { data } = supabase.storage
          .from('loan-documents')
          .getPublicUrl(customer.photoUrl);
        setAvatarUrl(data.publicUrl);
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };
    
    loadAvatar();
  }, [customer.photoUrl]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get key documents for display (PAN, Aadhaar, Photo)
  const keyDocTypes = ['pan', 'aadhaar', 'photo'];
  const keyDocuments = customer.documents.filter(doc => {
    const type = doc.documentType?.toLowerCase() || '';
    return keyDocTypes.some(key => type.includes(key));
  }).slice(0, 4);

  const initials = customer.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Avatar/Photo */}
          <div className="flex-shrink-0">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={avatarUrl || undefined} alt={customer.name} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Customer Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
                <p className="text-sm text-muted-foreground font-mono">{customer.panNumber}</p>
              </div>
              <Badge className={scoreColors[customer.paymentScore]}>
                {customer.paymentScore}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
              <div>
                <span className="text-muted-foreground">Mobile:</span>
                <p className="font-medium">{customer.mobile}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Loans:</span>
                <p className="font-medium">
                  {customer.totalLoans} 
                  {customer.activeLoans > 0 && (
                    <span className="text-primary ml-1">({customer.activeLoans} active)</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Disbursed:</span>
                <p className="font-medium">{formatCurrency(customer.totalDisbursed)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outstanding:</span>
                <p className={`font-medium ${customer.outstandingAmount > 0 ? 'text-orange-600' : ''}`}>
                  {formatCurrency(customer.outstandingAmount)}
                </p>
              </div>
            </div>

            {/* Document Thumbnails */}
            {keyDocuments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  Documents ({customer.documents.length})
                </p>
                <div className="flex gap-2 flex-wrap">
                  {keyDocuments.map((doc) => (
                    <DocumentThumbnail key={doc.id} document={doc} />
                  ))}
                  {customer.documents.length > 4 && (
                    <div className="w-14 h-14 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-xs">
                      +{customer.documents.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetails(customer)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onShareReferralLink}
              title="Share Referral Link"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>ID: {customer.customerId}</span>
          <span>Aadhaar: {customer.aadhaarNumber}</span>
          <span>
            Last: {customer.lastApplicationDate 
              ? format(new Date(customer.lastApplicationDate), "dd MMM yyyy")
              : "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
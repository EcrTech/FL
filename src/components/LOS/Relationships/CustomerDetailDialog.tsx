import { format } from "date-fns";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  FileText,
  RefreshCw,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  Shield,
  Image,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomerRelationship, CustomerDocument } from "@/hooks/useCustomerRelationships";
import { ApplicationHistoryCard } from "./ApplicationHistoryCard";
import { supabase } from "@/integrations/supabase/client";

interface CustomerDetailDialogProps {
  customer: CustomerRelationship | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const scoreColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-red-100 text-red-800 border-red-200",
};

const getDocumentLabel = (docType: string) => {
  const type = docType?.toLowerCase() || '';
  if (type.includes('pan')) return 'PAN Card';
  if (type.includes('aadhaar') && type.includes('front')) return 'Aadhaar Front';
  if (type.includes('aadhaar') && type.includes('back')) return 'Aadhaar Back';
  if (type.includes('aadhaar')) return 'Aadhaar';
  if (type.includes('photo')) return 'Photo';
  if (type.includes('bank')) return 'Bank Statement';
  if (type.includes('salary')) return 'Salary Slip';
  if (type.includes('address')) return 'Address Proof';
  return docType || 'Document';
};

const getVerificationIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'verified':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-600" />;
  }
};

function DocumentCard({ document }: { document: CustomerDocument }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!document.filePath) return;
      
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

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow">
      {/* Image Preview */}
      <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
        {isImage && imageUrl ? (
          <img 
            src={imageUrl} 
            alt={getDocumentLabel(document.documentType)}
            className="w-full h-full object-cover"
            onError={() => setIsImage(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-1" />
            <span className="text-xs">Document</span>
          </div>
        )}
      </div>
      
      {/* Document Info */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">
            {getDocumentLabel(document.documentType)}
          </p>
          {getVerificationIcon(document.verificationStatus)}
        </div>
        <p className="text-xs text-muted-foreground capitalize mt-1">
          {document.verificationStatus || 'Pending'}
        </p>
      </div>
    </div>
  );
}

export function CustomerDetailDialog({ 
  customer, 
  open, 
  onOpenChange 
}: CustomerDetailDialogProps) {
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadAvatar = async () => {
      if (!customer?.photoUrl) {
        setAvatarUrl(null);
        return;
      }
      
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
  }, [customer?.photoUrl]);

  if (!customer) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCreateReapplication = () => {
    const latestApp = customer.applications[0];
    
    navigate("/los/applications/new", {
      state: {
        prefillData: {
          pan_number: customer.panNumber,
          mobile: customer.mobile,
          name: customer.name,
          email: customer.email,
          isReapplication: true,
          previousApplicationId: latestApp?.applicationId,
        },
      },
    });
    onOpenChange(false);
  };

  // Calculate payment summary
  const paymentSummary = {
    totalEmis: 0,
    paidOnTime: 0,
    paidLate: 0,
    overdue: 0,
    pending: 0,
  };

  customer.applications.forEach(app => {
    app.emiSchedule.forEach(emi => {
      paymentSummary.totalEmis++;
      if (emi.status === 'paid') {
        if (emi.paid_date && new Date(emi.paid_date) <= new Date(emi.due_date)) {
          paymentSummary.paidOnTime++;
        } else {
          paymentSummary.paidLate++;
        }
      } else if (emi.status === 'overdue') {
        paymentSummary.overdue++;
      } else {
        paymentSummary.pending++;
      }
    });
  });

  const initials = customer.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customer Details</span>
            <Button onClick={handleCreateReapplication}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Create Reapplication
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Customer Overview with Photo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  {/* Photo */}
                  <div className="flex-shrink-0">
                    <Avatar className="h-24 w-24 border-2 border-border">
                      <AvatarImage src={avatarUrl || undefined} alt={customer.name} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Info */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Customer ID</p>
                      <p className="font-medium">{customer.customerId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{customer.name}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CreditCard className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">PAN</p>
                        <p className="font-medium font-mono">{customer.panNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Aadhaar</p>
                        <p className="font-medium">{customer.aadhaarNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Mobile</p>
                        <p className="font-medium">{customer.mobile}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{customer.email || "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Score</p>
                      <Badge className={`${scoreColors[customer.paymentScore]} mt-1`}>
                        {customer.paymentScore.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Application</p>
                      <p className="font-medium">
                        {customer.lastApplicationDate 
                          ? format(new Date(customer.lastApplicationDate), "dd MMM yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{customer.totalLoans}</p>
                      <p className="text-xs text-muted-foreground">Total Loans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{customer.activeLoans}</p>
                      <p className="text-xs text-muted-foreground">Active Loans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(customer.totalDisbursed)}</p>
                      <p className="text-xs text-muted-foreground">Total Disbursed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(customer.outstandingAmount)}</p>
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents Section */}
            {customer.documents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Documents ({customer.documents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {customer.documents.map((doc) => (
                      <DocumentCard key={doc.id} document={doc} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Summary */}
            {paymentSummary.totalEmis > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{paymentSummary.totalEmis}</p>
                      <p className="text-xs text-muted-foreground">Total EMIs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{paymentSummary.paidOnTime}</p>
                      <p className="text-xs text-muted-foreground">Paid On Time</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{paymentSummary.paidLate}</p>
                      <p className="text-xs text-muted-foreground">Paid Late</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{paymentSummary.overdue}</p>
                      <p className="text-xs text-muted-foreground">Overdue</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{paymentSummary.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Application History */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application History ({customer.applications.length})
              </h3>
              <div className="space-y-3">
                {customer.applications.map((app) => (
                  <ApplicationHistoryCard key={app.applicationId} application={app} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

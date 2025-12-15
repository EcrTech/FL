import { format } from "date-fns";

interface DocumentHeaderProps {
  companyName: string;
  companyAddress?: string;
  companyCIN?: string;
  logoUrl?: string;
  documentTitle: string;
  documentNumber: string;
  documentDate: Date;
}

export default function DocumentHeader({
  companyName,
  companyAddress,
  companyCIN,
  logoUrl,
  documentTitle,
  documentNumber,
  documentDate,
}: DocumentHeaderProps) {
  return (
    <div className="mb-6">
      {/* Company Header */}
      <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-12 w-auto" />
            ) : (
              <div className="h-12 w-12 bg-primary-foreground/20 rounded-full flex items-center justify-center text-xl font-bold">
                {companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{companyName}</h1>
              {companyCIN && (
                <p className="text-sm opacity-90">CIN: {companyCIN}</p>
              )}
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{documentNumber}</p>
            <p className="opacity-90">{format(documentDate, "dd MMMM yyyy")}</p>
          </div>
        </div>
        {companyAddress && (
          <p className="text-sm opacity-90 mt-2">{companyAddress}</p>
        )}
      </div>
      
      {/* Document Title */}
      <div className="bg-muted border-x border-b border-border p-3 text-center">
        <h2 className="text-lg font-bold text-foreground">{documentTitle}</h2>
      </div>
    </div>
  );
}

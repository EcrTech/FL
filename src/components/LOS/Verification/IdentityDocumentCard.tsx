import { FileText, CheckCircle, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IdentityDocumentCardProps {
  type: string;
  label: string;
  document: {
    id: string;
    file_path: string;
    file_name?: string;
    document_type: string;
  } | undefined;
  onUpload: () => void;
  onView: () => void;
}

export function IdentityDocumentCard({
  type,
  label,
  document,
  onUpload,
  onView,
}: IdentityDocumentCardProps) {
  const isUploaded = !!document;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-3 rounded-lg border-2 transition-all min-w-[120px]",
        isUploaded
          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
          : "border-dashed border-muted-foreground/30 bg-muted/30"
      )}
    >
      {/* Checkmark badge */}
      {isUploaded && (
        <div className="absolute -top-2 -right-2">
          <CheckCircle className="h-5 w-5 text-green-600 fill-white" />
        </div>
      )}

      {/* Document icon */}
      <div
        className={cn(
          "p-2 rounded-lg mb-2",
          isUploaded ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"
        )}
      >
        <FileText
          className={cn(
            "h-8 w-8",
            isUploaded ? "text-orange-600" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Label */}
      <p
        className={cn(
          "text-xs font-medium text-center mb-2",
          isUploaded ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </p>

      {/* File name footer */}
      {isUploaded && document.file_name && (
        <div className="w-full px-2 py-1 bg-muted/50 rounded text-center">
          <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">
            {document.file_name}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1 mt-2">
        {isUploaded ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onView}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onUpload}
            >
              <Upload className="h-3 w-3 mr-1" />
              Replace
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={onUpload}
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload
          </Button>
        )}
      </div>
    </div>
  );
}

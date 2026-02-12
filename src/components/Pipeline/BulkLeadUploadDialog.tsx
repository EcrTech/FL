import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

interface BulkLeadUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onComplete: () => void;
}

interface CsvRow {
  name?: string;
  phone?: string;
  email?: string;
  loan_amount?: string;
  source?: string;
}

interface UploadResult {
  created: number;
  skipped: number;
  errors: string[];
}

const CSV_TEMPLATE = "name,phone,email,loan_amount,source\nJohn Doe,9876543210,john@example.com,50000,website\nJane Smith,9876543211,,25000,";

export function BulkLeadUploadDialog({ open, onOpenChange, orgId, onComplete }: BulkLeadUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setValidationErrors([]);
    setIsUploading(false);
    setProgress(0);
    setResult(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateAndParse = (csvFile: File) => {
    setValidationErrors([]);
    setParsedRows([]);
    setResult(null);

    if (!csvFile.name.endsWith(".csv")) {
      setValidationErrors(["Please upload a CSV file."]);
      return;
    }

    Papa.parse<CsvRow>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const headers = results.meta.fields || [];

        if (!headers.includes("name") || !headers.includes("phone")) {
          errors.push("CSV must include 'name' and 'phone' columns.");
        }

        if (results.data.length === 0) {
          errors.push("CSV file is empty.");
        }

        if (results.data.length > 500) {
          errors.push("Maximum 500 rows allowed per upload.");
        }

        // Validate each row
        const validRows: CsvRow[] = [];
        results.data.forEach((row, i) => {
          if (!row.name?.trim()) {
            errors.push(`Row ${i + 2}: Missing name.`);
          } else if (!row.phone?.trim()) {
            errors.push(`Row ${i + 2}: Missing phone.`);
          } else {
            validRows.push(row);
          }
        });

        // Only show first 10 errors
        setValidationErrors(errors.slice(0, 10));
        if (errors.length > 10) {
          setValidationErrors(prev => [...prev, `...and ${errors.length - 10} more errors.`]);
        }

        if (errors.filter(e => !e.startsWith("Row")).length === 0) {
          setParsedRows(validRows);
        }
        setFile(csvFile);
      },
      error: () => {
        setValidationErrors(["Failed to parse CSV file."]);
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndParse(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndParse(f);
  }, []);

  const splitName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    return {
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" ") || null,
    };
  };

  const processUpload = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    setProgress(0);

    const results: UploadResult = { created: 0, skipped: 0, errors: [] };
    const total = parsedRows.length;

    // Get current user ID for created_by field (required by RLS)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to upload leads");
      setIsUploading(false);
      return;
    }

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const phone = row.phone!.trim().replace(/\D/g, "").slice(-10);
      const { first_name, last_name } = splitName(row.name!);
      const email = row.email?.trim() || null;
      const loanAmount = parseFloat(row.loan_amount || "") || 25000;
      const source = row.source?.trim() || "bulk_upload";

      try {
        // Check for existing contact by phone
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("org_id", orgId)
          .eq("phone", phone)
          .maybeSingle();

        let contactId: string;

        if (existing) {
          contactId = existing.id;
          results.skipped++;
        } else {
          const { data: newContact, error: contactError } = await supabase
            .from("contacts")
            .insert({
              org_id: orgId,
              first_name,
              last_name,
              phone,
              email,
              source: "bulk_upload",
              status: "new",
              created_by: user.id,
            })
            .select("id")
            .single();

          if (contactError) throw contactError;
          contactId = newContact.id;
        }

        // Create loan application
        const appNumber = `BLK-${Date.now()}-${i}`;
        const { error: appError } = await supabase
          .from("loan_applications")
          .insert({
            application_number: appNumber,
            org_id: orgId,
            contact_id: contactId,
            requested_amount: loanAmount,
            tenure_days: 365,
            status: "new",
            current_stage: "lead",
            source,
          });

        if (appError) throw appError;
        results.created++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 2}: ${err.message || "Unknown error"}`);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult(results);
    setIsUploading(false);

    if (results.created > 0) {
      toast.success(`${results.created} lead(s) uploaded successfully`);
      onComplete();
    }
    if (results.errors.length > 0) {
      toast.error(`${results.errors.length} row(s) failed`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Lead Upload</DialogTitle>
          <DialogDescription>Upload a CSV file to import multiple leads at once.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          {/* Drop zone */}
          {!result && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Max 500 rows • Required: name, phone</p>
            </div>
          )}

          {/* File info */}
          {file && !result && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-muted-foreground">{parsedRows.length} valid rows</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={reset}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded p-3 space-y-1">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">Processing... {progress}%</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-muted rounded p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Upload Complete
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>✓ {result.created} lead(s) created</p>
                <p>↻ {result.skipped} existing contact(s) reused</p>
                {result.errors.length > 0 && (
                  <p className="text-destructive">✗ {result.errors.length} error(s)</p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto text-xs text-destructive space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {result ? (
              <Button onClick={() => handleClose(false)} size="sm">Done</Button>
            ) : (
              <Button
                onClick={processUpload}
                disabled={parsedRows.length === 0 || isUploading}
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload {parsedRows.length > 0 ? `${parsedRows.length} Leads` : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

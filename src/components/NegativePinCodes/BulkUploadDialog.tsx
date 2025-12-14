import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ParsedRow {
  pincode: string;
  reason?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadDialog({ open, onOpenChange }: Props) {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const parseCSV = (text: string): { data: ParsedRow[]; errors: string[] } => {
    const lines = text.split("\n").filter(line => line.trim());
    const data: ParsedRow[] = [];
    const errors: string[] = [];

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes("pincode") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map(p => p.trim().replace(/"/g, ""));
      const pincode = parts[0];
      const reason = parts[1] || "";

      if (!pincode) continue;

      // Validate pincode format
      if (!/^\d{6}$/.test(pincode)) {
        errors.push(`Line ${i + 1}: Invalid pin code "${pincode}" (must be 6 digits)`);
        continue;
      }

      data.push({ pincode, reason });
    }

    return { data, errors };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      notify.error("Invalid file", "Please upload a CSV file");
      return;
    }

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { data, errors } = parseCSV(text);
      setParsedData(data);
      setErrors(errors);
    };
    reader.readAsText(selectedFile);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || parsedData.length === 0) return;

      const batchSize = 50;
      const total = parsedData.length;
      let processed = 0;

      for (let i = 0; i < total; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        const records = batch.map(row => ({
          org_id: orgId,
          area_type: "pincode",
          area_value: row.pincode,
          reason: row.reason || "Negative area - bulk import",
          is_active: true,
        }));

        const { error } = await supabase
          .from("loan_negative_areas")
          .upsert(records, { 
            onConflict: "org_id,area_type,area_value",
            ignoreDuplicates: true 
          });

        if (error) throw error;

        processed += batch.length;
        setUploadProgress(Math.round((processed / total) * 100));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negative-areas"] });
      notify.success("Upload complete", `${parsedData.length} pin codes imported`);
      handleClose();
    },
    onError: () => {
      notify.error("Upload failed", "Failed to import pin codes");
    },
  });

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setUploadProgress(0);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = "pincode,reason\n800001,High default rate\n834001,Remote area";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "negative_pincodes_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Pin Codes</DialogTitle>
          <DialogDescription>
            Upload a CSV file with pin codes to block. Required column: pincode. Optional: reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {parsedData.length} valid pin codes found
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-muted-foreground">CSV files only</p>
              </>
            )}
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">{errors.length} errors found:</p>
                <ul className="text-sm list-disc pl-4 max-h-24 overflow-y-auto">
                  {errors.slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {errors.length > 5 && (
                    <li>...and {errors.length - 5} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {parsedData.length > 0 && errors.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Ready to import {parsedData.length} pin codes
              </AlertDescription>
            </Alert>
          )}

          {uploadMutation.isPending && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-center text-muted-foreground">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={parsedData.length === 0 || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Uploading..." : `Import ${parsedData.length} Pin Codes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

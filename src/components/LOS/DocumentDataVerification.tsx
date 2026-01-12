import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DocumentDataVerificationProps {
  applicationId: string;
}

interface ExtractedField {
  source: string;
  value: string | null;
}

interface FieldComparison {
  field: string;
  label: string;
  values: ExtractedField[];
  matchStatus: "match" | "partial" | "mismatch" | "insufficient";
}

// Normalize strings for comparison
const normalize = (str: string | null | undefined): string => {
  if (!str) return "";
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, "").trim();
};

// Check if two strings are similar (fuzzy match)
const isSimilar = (a: string, b: string): boolean => {
  const normA = normalize(a);
  const normB = normalize(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // Check if one contains the other
  if (normA.includes(normB) || normB.includes(normA)) return true;
  return false;
};

// Format date for display
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

export default function DocumentDataVerification({ applicationId }: DocumentDataVerificationProps) {
  const { data: documents = [] } = useQuery({
    queryKey: ["loan-documents", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", applicationId);
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_applicants(*)")
        .eq("id", applicationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ["loan-verifications", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_verifications")
        .select("*")
        .eq("loan_application_id", applicationId);
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const fieldComparisons = useMemo((): FieldComparison[] => {
    const primaryApplicant = application?.loan_applicants?.[0];

    // Get OCR data from documents
    const getOcrData = (docType: string) => {
      const doc = documents.find((d) => d.document_type === docType);
      return doc?.ocr_data as Record<string, any> | null;
    };

    // Get verification data from verifications table
    const getVerificationData = (verType: string) => {
      const ver = verifications.find((v: any) => v.verification_type === verType);
      return ver?.response_data as Record<string, any> | null;
    };

    // Merge document OCR data with verification responses (same logic as ApplicationDetail)
    const panDocData = getOcrData("pan_card");
    const panVerData = getVerificationData("pan");
    const panData: Record<string, any> | null = panDocData || panVerData
      ? {
          ...panVerData,
          ...panDocData,
          name: panDocData?.name || (panVerData as any)?.name_on_pan || panVerData?.name,
          pan_number:
            panDocData?.pan_number ||
            (panVerData as any)?.pan_number ||
            (panVerData as any)?.pan,
          father_name: panDocData?.father_name || panVerData?.father_name,
          dob: panDocData?.dob || panVerData?.dob,
        }
      : null;

    const aadhaarDocData = getOcrData("aadhaar_card");
    const aadhaarVerData = getVerificationData("aadhaar");
    const aadhaarData: Record<string, any> | null = aadhaarDocData || aadhaarVerData
      ? {
          ...aadhaarVerData,
          ...aadhaarDocData,
          address:
            aadhaarDocData?.address ||
            aadhaarVerData?.verified_address ||
            aadhaarVerData?.address?.combined ||
            aadhaarVerData?.address,
        }
      : null;

    const salaryData =
      getOcrData("salary_slip_1") ||
      getOcrData("salary_slip_2") ||
      getOcrData("salary_slip_3");
    const form16Data = getOcrData("form_16_year_1") || getOcrData("form_16_year_2");

    // Build comparison fields
    const fields: FieldComparison[] = [
      {
        field: "name",
        label: "Full Name",
        values: [
          {
            source: "Application",
            value: primaryApplicant
              ? `${primaryApplicant.first_name || ""} ${primaryApplicant.last_name || ""}`.trim()
              : null,
          },
          { source: "PAN Card", value: panData?.name || null },
          { source: "Aadhaar", value: aadhaarData?.name || null },
          { source: "Salary Slip", value: salaryData?.employee_name || null },
          { source: "Form 16", value: form16Data?.employee_name || null },
        ],
        matchStatus: "insufficient",
      },
      {
        field: "dob",
        label: "Date of Birth",
        values: [
          { source: "Application", value: (primaryApplicant?.dob as string) || null },
          { source: "PAN Card", value: panData?.dob || null },
          { source: "Aadhaar", value: aadhaarData?.dob || null },
        ],
        matchStatus: "insufficient",
      },
      {
        field: "pan",
        label: "PAN Number",
        values: [
          { source: "Application", value: (primaryApplicant?.pan_number as string) || null },
          { source: "PAN Card", value: panData?.pan_number || null },
          { source: "Form 16", value: form16Data?.pan || null },
        ],
        matchStatus: "insufficient",
      },
      {
        field: "address",
        label: "Address",
        values: [
          {
            source: "Application",
            value:
              primaryApplicant?.current_address && typeof primaryApplicant.current_address === "object"
                ? Object.values(primaryApplicant.current_address as Record<string, string>)
                    .filter(Boolean)
                    .join(", ")
                : ((primaryApplicant?.current_address as string) || null),
          },
          { source: "Aadhaar", value: aadhaarData?.address || null },
        ],
        matchStatus: "insufficient",
      },
      {
        field: "employer",
        label: "Employer Name",
        values: [
          { source: "Salary Slip", value: salaryData?.employer_name || null },
          { source: "Form 16", value: form16Data?.employer_name || null },
        ],
        matchStatus: "insufficient",
      },
    ];

    // Calculate match status for each field
    return fields.map((field) => {
      const nonEmptyValues = field.values.filter((v) => v.value && v.value.trim() !== "");

      if (nonEmptyValues.length < 2) {
        return { ...field, matchStatus: "insufficient" as const };
      }

      // Check if all values match
      const firstValue = nonEmptyValues[0].value!;
      const allMatch = nonEmptyValues.every((v) => normalize(v.value) === normalize(firstValue));
      const anyMatch = nonEmptyValues.some((v, i) => i > 0 && isSimilar(v.value!, firstValue));

      if (allMatch) {
        return { ...field, matchStatus: "match" as const };
      } else if (anyMatch) {
        return { ...field, matchStatus: "partial" as const };
      } else {
        return { ...field, matchStatus: "mismatch" as const };
      }
    });
  }, [documents, application, verifications]);

  const getMatchIcon = (status: string) => {
    switch (status) {
      case "match":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "mismatch":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMatchBadge = (status: string) => {
    switch (status) {
      case "match":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Match</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Partial</Badge>;
      case "mismatch":
        return <Badge variant="destructive">Mismatch</Badge>;
      default:
        return <Badge variant="outline">Insufficient Data</Badge>;
    }
  };

  const hasAnyParsedData = documents.some((d) => d.ocr_data && Object.keys(d.ocr_data as object).length > 0);

  if (!hasAnyParsedData) {
    return (
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Document Data Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No parsed document data available. Upload and parse documents to see cross-verification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center justify-between">
            Document Data Verification
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {fieldComparisons.filter((f) => f.matchStatus === "match").length} Matched
              </Badge>
              {fieldComparisons.filter((f) => f.matchStatus === "mismatch").length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {fieldComparisons.filter((f) => f.matchStatus === "mismatch").length} Mismatches
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[15%]">Field</TableHead>
                <TableHead className="w-[17%]">Application</TableHead>
                <TableHead className="w-[17%]">PAN Card</TableHead>
                <TableHead className="w-[17%]">Aadhaar</TableHead>
                <TableHead className="w-[17%]">Salary/Form 16</TableHead>
                <TableHead className="w-[17%] text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldComparisons.map((comparison) => (
                <TableRow key={comparison.field}>
                  <TableCell className="font-medium text-sm py-2">{comparison.label}</TableCell>
                  {comparison.values.slice(0, 4).map((val, idx) => (
                    <TableCell key={idx} className="text-sm py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block max-w-[150px]">
                            {comparison.field === "dob" ? formatDate(val.value) : val.value || "-"}
                          </span>
                        </TooltipTrigger>
                        {val.value && (
                          <TooltipContent>
                            <p>{val.source}: {comparison.field === "dob" ? formatDate(val.value) : val.value}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TableCell>
                  ))}
                  <TableCell className="text-center py-2">
                    <div className="flex items-center justify-center gap-2">
                      {getMatchIcon(comparison.matchStatus)}
                      {getMatchBadge(comparison.matchStatus)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
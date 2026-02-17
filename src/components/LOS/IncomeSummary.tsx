import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IncomeSummaryProps {
  applicationId: string;
  orgId: string;
}

interface SalarySlipData {
  month: string;
  gross_salary: number;
  net_salary: number;
  basic_salary: number;
  hra: number;
  pf_deduction: number;
  tds: number;
  other_deductions: number;
  is_manual?: boolean;
}

interface AnnualIncomeData {
  year: string;
  source: string;
  gross_income: number;
  taxable_income: number;
  tax_paid: number;
  is_manual?: boolean;
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const EMPTY_SALARY: SalarySlipData = {
  month: "",
  gross_salary: 0,
  net_salary: 0,
  basic_salary: 0,
  hra: 0,
  pf_deduction: 0,
  tds: 0,
  other_deductions: 0,
  is_manual: true,
};

const EMPTY_ANNUAL: AnnualIncomeData = {
  year: "",
  source: "Manual",
  gross_income: 0,
  taxable_income: 0,
  tax_paid: 0,
  is_manual: true,
};

export default function IncomeSummary({ applicationId, orgId }: IncomeSummaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCalculating, setIsCalculating] = useState(false);
  const [manualSalarySlips, setManualSalarySlips] = useState<SalarySlipData[]>([]);
  const [manualAnnualIncomes, setManualAnnualIncomes] = useState<AnnualIncomeData[]>([]);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [showAnnualForm, setShowAnnualForm] = useState(false);

  const { data: documents = [], refetch: refetchDocuments, isLoading: isLoadingDocs } = useQuery({
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
    staleTime: 0,
  });

  const { data: incomeSummary } = useQuery({
    queryKey: ["income-summary", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_income_summaries")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  // Extract salary slip data from OCR documents
  const ocrSalarySlips = useMemo((): SalarySlipData[] => {
    const slips: SalarySlipData[] = [];
    ["salary_slip_1", "salary_slip_2", "salary_slip_3"].forEach((docType) => {
      const doc = documents.find((d) => d.document_type === docType);
      const ocr = doc?.ocr_data as Record<string, any> | null;
      if (ocr && !ocr.parse_error) {
        slips.push({
          month: ocr.month || docType.replace("salary_slip_", "Month "),
          gross_salary: Number(ocr.gross_salary) || 0,
          net_salary: Number(ocr.net_salary) || 0,
          basic_salary: Number(ocr.basic_salary) || 0,
          hra: Number(ocr.hra) || 0,
          pf_deduction: Number(ocr.pf_deduction) || 0,
          tds: Number(ocr.tds) || 0,
          other_deductions: Number(ocr.other_deductions) || 0,
        });
      }
    });
    return slips;
  }, [documents]);

  // Combine OCR + manual salary slips
  const salarySlips = useMemo(() => [...ocrSalarySlips, ...manualSalarySlips], [ocrSalarySlips, manualSalarySlips]);

  // Extract annual income from OCR
  const ocrAnnualIncomes = useMemo((): AnnualIncomeData[] => {
    const incomes: AnnualIncomeData[] = [];
    const form16Y1 = documents.find((d) => d.document_type === "form_16_year_1")?.ocr_data as Record<string, any> | null;
    if (form16Y1 && !form16Y1.parse_error) {
      incomes.push({
        year: form16Y1.assessment_year || "Year 1",
        source: "Form 16",
        gross_income: Number(form16Y1.gross_salary) || 0,
        taxable_income: Number(form16Y1.taxable_income) || 0,
        tax_paid: Number(form16Y1.tax_deducted) || 0,
      });
    }
    const form16Y2 = documents.find((d) => d.document_type === "form_16_year_2")?.ocr_data as Record<string, any> | null;
    if (form16Y2 && !form16Y2.parse_error) {
      incomes.push({
        year: form16Y2.assessment_year || "Year 2",
        source: "Form 16",
        gross_income: Number(form16Y2.gross_salary) || 0,
        taxable_income: Number(form16Y2.taxable_income) || 0,
        tax_paid: Number(form16Y2.tax_deducted) || 0,
      });
    }
    if (!form16Y1) {
      const itrY1 = documents.find((d) => d.document_type === "itr_year_1")?.ocr_data as Record<string, any> | null;
      if (itrY1 && !itrY1.parse_error) {
        incomes.push({
          year: itrY1.assessment_year || "Year 1",
          source: "ITR",
          gross_income: Number(itrY1.gross_total_income) || 0,
          taxable_income: Number(itrY1.taxable_income) || 0,
          tax_paid: Number(itrY1.tax_paid) || 0,
        });
      }
    }
    if (!form16Y2) {
      const itrY2 = documents.find((d) => d.document_type === "itr_year_2")?.ocr_data as Record<string, any> | null;
      if (itrY2 && !itrY2.parse_error) {
        incomes.push({
          year: itrY2.assessment_year || "Year 2",
          source: "ITR",
          gross_income: Number(itrY2.gross_total_income) || 0,
          taxable_income: Number(itrY2.taxable_income) || 0,
          tax_paid: Number(itrY2.tax_paid) || 0,
        });
      }
    }
    return incomes;
  }, [documents]);

  // Combine OCR + manual annual incomes
  const annualIncomes = useMemo(() => [...ocrAnnualIncomes, ...manualAnnualIncomes], [ocrAnnualIncomes, manualAnnualIncomes]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const avgMonthlyGross = salarySlips.length > 0
      ? salarySlips.reduce((sum, s) => sum + s.gross_salary, 0) / salarySlips.length
      : 0;
    const avgMonthlyNet = salarySlips.length > 0
      ? salarySlips.reduce((sum, s) => sum + s.net_salary, 0) / salarySlips.length
      : 0;
    const avgAnnualIncome = annualIncomes.length > 0
      ? annualIncomes.reduce((sum, a) => sum + a.gross_income, 0) / annualIncomes.length
      : 0;
    let yoyGrowth: number | null = null;
    if (annualIncomes.length >= 2) {
      const sorted = [...annualIncomes].sort((a, b) => a.year.localeCompare(b.year));
      const olderYear = sorted[0].gross_income;
      const newerYear = sorted[sorted.length - 1].gross_income;
      if (olderYear > 0) {
        yoyGrowth = ((newerYear - olderYear) / olderYear) * 100;
      }
    }
    let stabilityScore = "N/A";
    if (salarySlips.length >= 2) {
      const variance = salarySlips.reduce((sum, s) =>
        sum + Math.pow(s.gross_salary - avgMonthlyGross, 2), 0
      ) / salarySlips.length;
      const stdDev = Math.sqrt(variance);
      const cv = avgMonthlyGross > 0 ? (stdDev / avgMonthlyGross) * 100 : 0;
      if (cv < 5) stabilityScore = "High";
      else if (cv < 15) stabilityScore = "Medium";
      else stabilityScore = "Low";
    }
    return { avgMonthlyGross, avgMonthlyNet, avgAnnualIncome, yoyGrowth, stabilityScore };
  }, [salarySlips, annualIncomes]);

  // Save summary to database
  const saveMutation = useMutation({
    mutationFn: async () => {
      const summaryData = {
        loan_application_id: applicationId,
        org_id: orgId,
        monthly_gross_salary: summaryMetrics.avgMonthlyGross,
        monthly_net_salary: summaryMetrics.avgMonthlyNet,
        average_monthly_income: summaryMetrics.avgMonthlyNet,
        annual_average_income: summaryMetrics.avgAnnualIncome,
        income_growth_percentage: summaryMetrics.yoyGrowth,
        income_stability_score: summaryMetrics.stabilityScore,
        salary_slip_details: JSON.parse(JSON.stringify(salarySlips)),
        year_1_label: annualIncomes[0]?.year || null,
        year_1_gross_income: annualIncomes[0]?.gross_income || null,
        year_1_taxable_income: annualIncomes[0]?.taxable_income || null,
        year_1_tax_paid: annualIncomes[0]?.tax_paid || null,
        year_1_source: annualIncomes[0]?.source || null,
        year_2_label: annualIncomes[1]?.year || null,
        year_2_gross_income: annualIncomes[1]?.gross_income || null,
        year_2_taxable_income: annualIncomes[1]?.taxable_income || null,
        year_2_tax_paid: annualIncomes[1]?.tax_paid || null,
        year_2_source: annualIncomes[1]?.source || null,
        source_documents: documents.filter((d) => d.ocr_data).map((d) => d.id),
      };

      const { error } = await supabase
        .from("loan_income_summaries")
        .upsert(summaryData as any, { onConflict: "loan_application_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income-summary", applicationId] });
      toast({ title: "Income summary saved" });
      setIsCalculating(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      setIsCalculating(false);
    },
  });

  const handleCalculate = () => {
    setIsCalculating(true);
    saveMutation.mutate();
  };

  // Manual salary slip handlers
  const addManualSalarySlip = () => {
    setManualSalarySlips((prev) => [...prev, { ...EMPTY_SALARY }]);
    setShowSalaryForm(true);
  };

  const updateManualSalarySlip = (index: number, field: keyof SalarySlipData, value: string | number) => {
    setManualSalarySlips((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: typeof value === "string" && field !== "month" ? Number(value) || 0 : value };
      return updated;
    });
  };

  const removeManualSalarySlip = (index: number) => {
    setManualSalarySlips((prev) => prev.filter((_, i) => i !== index));
  };

  // Manual annual income handlers
  const addManualAnnualIncome = () => {
    setManualAnnualIncomes((prev) => [...prev, { ...EMPTY_ANNUAL }]);
    setShowAnnualForm(true);
  };

  const updateManualAnnualIncome = (index: number, field: keyof AnnualIncomeData, value: string | number) => {
    setManualAnnualIncomes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: typeof value === "string" && field !== "year" && field !== "source" ? Number(value) || 0 : value };
      return updated;
    });
  };

  const removeManualAnnualIncome = (index: number) => {
    setManualAnnualIncomes((prev) => prev.filter((_, i) => i !== index));
  };

  const hasData = salarySlips.length > 0 || annualIncomes.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Income Summary</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDocuments()}
            disabled={isLoadingDocs}
          >
            {isLoadingDocs ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {hasData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalculate}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-1" />
              )}
              Save Summary
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards - only show when data exists */}
      {hasData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Avg Monthly (Net)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(summaryMetrics.avgMonthlyNet)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Annual Average</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(summaryMetrics.avgAnnualIncome)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">YoY Growth</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold flex items-center gap-2">
                {summaryMetrics.yoyGrowth !== null ? (
                  <>
                    {summaryMetrics.yoyGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    {summaryMetrics.yoyGrowth.toFixed(1)}%
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    N/A
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Stability</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <Badge
                className={
                  summaryMetrics.stabilityScore === "High"
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : summaryMetrics.stabilityScore === "Medium"
                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                    : "bg-muted text-muted-foreground"
                }
              >
                {summaryMetrics.stabilityScore}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Income Table */}
      <Card>
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Monthly Income (Salary Slips)</CardTitle>
          <Button variant="outline" size="sm" onClick={addManualSalarySlip}>
            <Plus className="h-4 w-4 mr-1" />
            Add Manually
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {salarySlips.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">HRA</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ocrSalarySlips.map((slip, idx) => (
                  <TableRow key={`ocr-${idx}`}>
                    <TableCell className="font-medium">
                      {slip.month}
                      <Badge variant="outline" className="ml-2 text-[10px] py-0">OCR</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(slip.gross_salary)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(slip.basic_salary)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(slip.hra)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(slip.pf_deduction)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(slip.tds)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(slip.net_salary)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
                {manualSalarySlips.map((slip, idx) => (
                  <TableRow key={`manual-${idx}`} className="bg-primary/5">
                    <TableCell>
                      <Input
                        value={slip.month}
                        onChange={(e) => updateManualSalarySlip(idx, "month", e.target.value)}
                        placeholder="e.g. Jan 2026"
                        className="h-8 text-sm w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={slip.gross_salary || ""}
                        onChange={(e) => updateManualSalarySlip(idx, "gross_salary", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={slip.basic_salary || ""}
                        onChange={(e) => updateManualSalarySlip(idx, "basic_salary", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={slip.hra || ""}
                        onChange={(e) => updateManualSalarySlip(idx, "hra", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={slip.pf_deduction || ""}
                        onChange={(e) => updateManualSalarySlip(idx, "pf_deduction", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={slip.tds || ""}
                        onChange={(e) => updateManualSalarySlip(idx, "tds", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={slip.net_salary || ""}
                        onChange={(e) => updateManualSalarySlip(idx, "net_salary", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeManualSalarySlip(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {salarySlips.length > 0 && (
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold">Average</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(summaryMetrics.avgMonthlyGross)}</TableCell>
                    <TableCell colSpan={4}></TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(summaryMetrics.avgMonthlyNet)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No salary slip data available. Upload salary slips for auto-extraction or add entries manually.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual Income Table */}
      <Card>
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Annual Income (Form 16 / ITR)</CardTitle>
          <Button variant="outline" size="sm" onClick={addManualAnnualIncome}>
            <Plus className="h-4 w-4 mr-1" />
            Add Manually
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {annualIncomes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment Year</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Gross Income</TableHead>
                  <TableHead className="text-right">Taxable Income</TableHead>
                  <TableHead className="text-right">Tax Paid</TableHead>
                  <TableHead className="text-right">Net Income</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ocrAnnualIncomes.map((income, idx) => (
                  <TableRow key={`ocr-annual-${idx}`}>
                    <TableCell className="font-medium">
                      {income.year}
                      <Badge variant="outline" className="ml-2 text-[10px] py-0">OCR</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{income.source}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(income.gross_income)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(income.taxable_income)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(income.tax_paid)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(income.gross_income - income.tax_paid)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
                {manualAnnualIncomes.map((income, idx) => (
                  <TableRow key={`manual-annual-${idx}`} className="bg-primary/5">
                    <TableCell>
                      <Input
                        value={income.year}
                        onChange={(e) => updateManualAnnualIncome(idx, "year", e.target.value)}
                        placeholder="e.g. AY 2025-26"
                        className="h-8 text-sm w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Manual</Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={income.gross_income || ""}
                        onChange={(e) => updateManualAnnualIncome(idx, "gross_income", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={income.taxable_income || ""}
                        onChange={(e) => updateManualAnnualIncome(idx, "taxable_income", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={income.tax_paid || ""}
                        onChange={(e) => updateManualAnnualIncome(idx, "tax_paid", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm text-right w-28"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(income.gross_income - income.tax_paid)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeManualAnnualIncome(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No annual income data available. Upload Form 16/ITR for auto-extraction or add entries manually.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

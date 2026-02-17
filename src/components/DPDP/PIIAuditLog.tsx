import { useState } from "react";
import { useDPDPAuditLog, DPDPAuditLogEntry, AuditLogFilters } from "@/hooks/useDPDPAuditLog";
import { DataTable, Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

interface PIIAuditLogProps {
  orgId: string | undefined;
}

export function PIIAuditLog({ orgId }: PIIAuditLogProps) {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const { data: logs = [], isLoading } = useDPDPAuditLog(orgId, filters);

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ["Date", "User ID", "Table", "Column", "Purpose", "Contact ID", "Applicant ID"];
    const rows = logs.map((log) => [
      new Date(log.accessed_at).toISOString(),
      log.user_id || "",
      log.table_name,
      log.column_name || "",
      log.purpose || "",
      log.contact_id || "",
      log.applicant_id || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pii-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<DPDPAuditLogEntry>[] = [
    {
      header: "Date & Time",
      accessor: (row) => new Date(row.accessed_at).toLocaleString(),
    },
    {
      header: "User ID",
      accessor: (row) => (
        <span className="text-xs font-mono">{row.user_id ? row.user_id.slice(0, 8) + "..." : "System"}</span>
      ),
    },
    { header: "Table", accessor: "table_name" },
    {
      header: "Columns",
      accessor: (row) => row.column_name || "—",
    },
    {
      header: "Purpose",
      accessor: (row) => row.purpose || "—",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium">Start Date</label>
          <Input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
            className="w-40"
          />
        </div>
        <div>
          <label className="text-xs font-medium">End Date</label>
          <Input
            type="date"
            value={filters.endDate || ""}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
            className="w-40"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Table</label>
          <Select
            value={filters.tableName || "all"}
            onValueChange={(v) => setFilters({ ...filters, tableName: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              <SelectItem value="contacts">contacts</SelectItem>
              <SelectItem value="loan_applicants">loan_applicants</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={logs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No PII access records found"
      />
    </div>
  );
}

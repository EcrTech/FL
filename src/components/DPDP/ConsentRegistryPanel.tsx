import { useState } from "react";
import { useDPDPConsent, DPDPConsentRecord } from "@/hooks/useDPDPConsent";
import { DataTable, Column } from "@/components/common/DataTable";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface ConsentRegistryPanelProps {
  orgId: string | undefined;
}

export function ConsentRegistryPanel({ orgId }: ConsentRegistryPanelProps) {
  const [search, setSearch] = useState("");
  const { data: records = [], isLoading } = useDPDPConsent(orgId, search || undefined);

  const columns: Column<DPDPConsentRecord>[] = [
    {
      header: "Date",
      accessor: (row) => new Date(row.consented_at).toLocaleString(),
    },
    {
      header: "Identifier",
      accessor: "user_identifier",
    },
    {
      header: "Purpose",
      accessor: "purpose",
    },
    {
      header: "Version",
      accessor: "consent_version",
    },
    {
      header: "Status",
      accessor: (row) => (
        <Badge className={row.withdrawn_at ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
          {row.withdrawn_at ? "Withdrawn" : "Active"}
        </Badge>
      ),
    },
    {
      header: "IP Address",
      accessor: (row) => (
        <span className="text-xs font-mono">{row.ip_address || "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by phone or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        data={records}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No consent records found"
      />
    </div>
  );
}

import { useState } from "react";
import { useDPDPDataRequests, DPDPDataRequest } from "@/hooks/useDPDPDataRequests";
import { DataTable, Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, Clock, XCircle, PlayCircle } from "lucide-react";

interface DataRequestsPanelProps {
  orgId: string | undefined;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  access: "Data Access",
  erasure: "Data Erasure",
  correction: "Data Correction",
  nomination: "Nomination",
  grievance: "Grievance",
};

export function DataRequestsPanel({ orgId }: DataRequestsPanelProps) {
  const { user } = useAuth();
  const { data: requests = [], isLoading, updateStatus } = useDPDPDataRequests(orgId);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    request: DPDPDataRequest | null;
    action: string;
  }>({ open: false, request: null, action: "" });
  const [adminNotes, setAdminNotes] = useState("");

  const isOverdue = (req: DPDPDataRequest) => {
    return (
      ["pending", "in_progress"].includes(req.status) &&
      new Date(req.due_date) < new Date()
    );
  };

  const handleAction = (request: DPDPDataRequest, action: string) => {
    setActionDialog({ open: true, request, action });
    setAdminNotes(request.admin_notes || "");
  };

  const confirmAction = () => {
    if (!actionDialog.request) return;
    updateStatus.mutate({
      id: actionDialog.request.id,
      status: actionDialog.action,
      admin_notes: adminNotes,
      handled_by: user?.id,
    });
    setActionDialog({ open: false, request: null, action: "" });
    setAdminNotes("");
  };

  const columns: Column<DPDPDataRequest>[] = [
    {
      header: "Date",
      accessor: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      header: "Requester",
      accessor: (row) => (
        <div>
          <div className="font-medium">{row.requester_name}</div>
          <div className="text-xs text-muted-foreground">{row.requester_email}</div>
        </div>
      ),
    },
    {
      header: "Type",
      accessor: (row) => typeLabels[row.request_type] || row.request_type,
    },
    {
      header: "Status",
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Badge className={statusColors[row.status]}>{row.status.replace("_", " ")}</Badge>
          {isOverdue(row) && (
            <Badge variant="destructive" className="text-xs">OVERDUE</Badge>
          )}
        </div>
      ),
    },
    {
      header: "Due Date",
      accessor: (row) => (
        <span className={isOverdue(row) ? "text-red-600 font-medium" : ""}>
          {new Date(row.due_date).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        data={requests}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No data rights requests yet"
        renderActions={(row) => (
          <div className="flex gap-1">
            {row.status === "pending" && (
              <Button size="sm" variant="outline" onClick={() => handleAction(row, "in_progress")}>
                <PlayCircle className="h-3 w-3 mr-1" /> Start
              </Button>
            )}
            {["pending", "in_progress"].includes(row.status) && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleAction(row, "completed")}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Complete
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAction(row, "rejected")}>
                  <XCircle className="h-3 w-3 mr-1" /> Reject
                </Button>
              </>
            )}
          </div>
        )}
      />

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, request: null, action: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "in_progress" && "Mark as In Progress"}
              {actionDialog.action === "completed" && "Complete Request"}
              {actionDialog.action === "rejected" && "Reject Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {actionDialog.request && (
              <div className="text-sm">
                <p><strong>Requester:</strong> {actionDialog.request.requester_name}</p>
                <p><strong>Type:</strong> {typeLabels[actionDialog.request.request_type]}</p>
                {actionDialog.request.description && (
                  <p><strong>Description:</strong> {actionDialog.request.description}</p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Admin Notes</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about how this request was handled..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, request: null, action: "" })}>
              Cancel
            </Button>
            <Button onClick={confirmAction} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

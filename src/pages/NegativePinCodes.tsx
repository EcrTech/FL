import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/common/DataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AddEditNegativeAreaDialog } from "@/components/NegativePinCodes/AddEditNegativeAreaDialog";
import { BulkUploadDialog } from "@/components/NegativePinCodes/BulkUploadDialog";
import { Plus, Upload, Search, Trash2, Edit, MapPinOff } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";

interface NegativeArea {
  id: string;
  org_id: string;
  area_type: string;
  area_value: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

export default function NegativePinCodes() {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingArea, setEditingArea] = useState<NegativeArea | null>(null);
  const [deletingArea, setDeletingArea] = useState<NegativeArea | null>(null);

  const { data: negativeAreas, isLoading } = useQuery({
    queryKey: ["negative-areas", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("loan_negative_areas")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as NegativeArea[];
    },
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("loan_negative_areas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negative-areas"] });
      notify.success("Deleted", "Negative area removed successfully");
      setDeletingArea(null);
    },
    onError: () => {
      notify.error("Error", "Failed to delete negative area");
    },
  });

  const filteredAreas = negativeAreas?.filter(area =>
    area.area_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    area.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const columns: Column<NegativeArea>[] = [
    {
      header: "Pin Code",
      accessor: "area_value",
    },
    {
      header: "Type",
      accessor: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.area_type}
        </Badge>
      ),
    },
    {
      header: "Reason",
      accessor: (row) => row.reason || "-",
    },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.is_active ? "default" : "secondary"}>
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Added On",
      accessor: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const renderActions = (area: NegativeArea) => (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditingArea(area)}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDeletingArea(area)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPinOff className="h-6 w-6" />
              Negative Pin Codes
            </h1>
            <p className="text-muted-foreground">
              Manage blocked areas for loan applications
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pin Code
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pin codes or reasons..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">
                {filteredAreas.length} pin codes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredAreas}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No negative pin codes configured"
              renderActions={renderActions}
            />
          </CardContent>
        </Card>
      </div>

      <AddEditNegativeAreaDialog
        open={showAddDialog || !!editingArea}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingArea(null);
          }
        }}
        editingArea={editingArea}
      />

      <BulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
      />

      <ConfirmDialog
        open={!!deletingArea}
        onOpenChange={(open) => !open && setDeletingArea(null)}
        title="Delete Negative Area"
        description={`Are you sure you want to delete pin code "${deletingArea?.area_value}"? This action cannot be undone.`}
        onConfirm={() => deletingArea && deleteMutation.mutate(deletingArea.id)}
        confirmText="Delete"
        variant="destructive"
      />
    </DashboardLayout>
  );
}

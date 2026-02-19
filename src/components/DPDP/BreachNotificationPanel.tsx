import { useState } from "react";
import { useDPDPBreachNotifications } from "@/hooks/useDPDPBreachNotifications";
import { DataTable, Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert, Plus } from "lucide-react";
import type { DPDPBreachNotification } from "@/hooks/useDPDPBreachNotifications";

interface BreachNotificationPanelProps {
  orgId: string | undefined;
}

export function BreachNotificationPanel({ orgId }: BreachNotificationPanelProps) {
  const { user } = useAuth();
  const { data: breaches = [], isLoading, create } = useDPDPBreachNotifications(orgId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    impact: "",
    remedial_steps: "",
    contact_info: "dpo@in-sync.co.in",
    affected_count: 0,
    notified_board: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !user?.id) return;
    create.mutate({
      org_id: orgId,
      triggered_by: user.id,
      ...form,
    });
    setForm({
      title: "",
      description: "",
      impact: "",
      remedial_steps: "",
      contact_info: "dpo@in-sync.co.in",
      affected_count: 0,
      notified_board: false,
    });
    setShowForm(false);
  };

  const columns: Column<DPDPBreachNotification>[] = [
    {
      header: "Date",
      accessor: (row) => new Date(row.triggered_at).toLocaleDateString(),
    },
    { header: "Title", accessor: "title" },
    {
      header: "Affected",
      accessor: (row) => row.affected_count.toString(),
    },
    {
      header: "Board Notified",
      accessor: (row) => (
        <Badge className={row.notified_board ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
          {row.notified_board ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      header: "Impact",
      accessor: (row) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {row.impact || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Breach Notifications</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          File Breach Notification
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              File New Breach Notification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Brief description of the breach"
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed description of the breach incident"
                  required
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Impact Assessment</Label>
                  <Textarea
                    value={form.impact}
                    onChange={(e) => setForm({ ...form, impact: e.target.value })}
                    placeholder="What data was affected and potential consequences"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Remedial Steps Taken</Label>
                  <Textarea
                    value={form.remedial_steps}
                    onChange={(e) => setForm({ ...form, remedial_steps: e.target.value })}
                    placeholder="Actions taken to mitigate the breach"
                    rows={2}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Affected Individuals Count</Label>
                  <Input
                    type="number"
                    value={form.affected_count}
                    onChange={(e) => setForm({ ...form, affected_count: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                <div>
                  <Label>DPO Contact Info</Label>
                  <Input
                    value={form.contact_info}
                    onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={form.notified_board}
                    onCheckedChange={(checked) => setForm({ ...form, notified_board: checked })}
                  />
                  <Label>Data Protection Board Notified</Label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Filing..." : "File Notification"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable
        data={breaches}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No breach notifications filed"
      />
    </div>
  );
}

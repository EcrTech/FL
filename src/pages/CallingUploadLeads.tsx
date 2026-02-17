import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Plus, Phone, MessageCircle, Eye, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import { WhatsAppChatDialog } from "@/components/LOS/Relationships/WhatsAppChatDialog";
import { useUnreadWhatsApp } from "@/hooks/useUnreadWhatsApp";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Papa from "papaparse";

export default function CallingUploadLeads() {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // WhatsApp state
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappContact, setWhatsappContact] = useState<{ id: string; name: string; phone: string } | null>(null);

  // Fetch all calling_upload leads from DB
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["calling-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, phone, email, source, created_at, company, city")
        .eq("org_id", orgId)
        .eq("source", "calling_upload")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.first_name?.toLowerCase().includes(q) ||
        l.last_name?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
    );
  }, [leads, search]);

  const handleAddLead = async () => {
    if (!manualName.trim() || !manualPhone.trim()) {
      notify.error("Missing fields", "Name and Phone are required");
      return;
    }
    if (!orgId) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("contacts").insert({
        first_name: manualName.trim(),
        phone: manualPhone.trim(),
        org_id: orgId,
        source: "calling_upload",
        created_by: user?.id || null,
      });
      if (error) throw error;
      notify.success("Lead added", `${manualName.trim()} added successfully`);
      setManualName("");
      setManualPhone("");
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["calling-leads", orgId] });
    } catch (err: any) {
      notify.error("Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: { first_name: string; phone: string; org_id: string; source: string }[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const name = row["Name"] || row["name"] || row["NAME"] || "";
          const phone = row["Phone"] || row["phone"] || row["Number"] || row["number"] || row["PHONE"] || row["NUMBER"] || row["Mobile"] || row["mobile"] || "";
          if (name.trim() && phone.trim()) {
            rows.push({ first_name: name.trim(), phone: phone.trim(), org_id: orgId, source: "calling_upload" });
          }
        }
        if (rows.length === 0) {
          notify.error("No valid rows", "CSV must have 'Name' and 'Phone'/'Number' columns");
          return;
        }
        try {
          const { error } = await supabase.from("contacts").insert(rows);
          if (error) throw error;
          notify.success("Uploaded", `${rows.length} leads imported`);
          queryClient.invalidateQueries({ queryKey: ["calling-leads", orgId] });
        } catch (err: any) {
          notify.error("Upload failed", err.message);
        }
      },
      error: () => notify.error("Parse error", "Could not read the CSV file"),
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Leads</h1>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Lead
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {search ? "No leads match your search" : "No leads yet. Add or upload leads to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.first_name} {lead.last_name || ""}
                    </TableCell>
                    <TableCell>{lead.phone}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {lead.source || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          asChild
                        >
                          <a href={`tel:${lead.phone}`} title="Call">
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                        <WhatsAppLeadButton
                          phone={lead.phone}
                          onClick={() => {
                            setWhatsappContact({ id: lead.id, name: lead.first_name, phone: lead.phone });
                            setWhatsappOpen(true);
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => navigate(`/calling/leads/${lead.id}`)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />

      {/* Add Lead Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" placeholder="Lead name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone">Phone Number</Label>
              <Input id="add-phone" placeholder="Phone number" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLead} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Dialog */}
      {whatsappContact && (
        <WhatsAppChatDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          contactId={whatsappContact.id}
          contactName={whatsappContact.name}
          phoneNumber={whatsappContact.phone}
        />
      )}
    </DashboardLayout>
  );
}

function WhatsAppLeadButton({ phone, onClick }: { phone: string; onClick: () => void }) {
  const { data: unread = 0 } = useUnreadWhatsApp(phone);
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-green-600 hover:text-green-700 relative"
      onClick={onClick}
      title="WhatsApp"
    >
      <MessageCircle className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Button>
  );
}

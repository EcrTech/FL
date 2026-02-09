import { useState, useRef } from "react";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Trash2, FileSpreadsheet, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import Papa from "papaparse";

interface LeadEntry {
  name: string;
  phone: string;
}

export default function CallingUploadLeads() {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addManualLead = () => {
    if (!manualName.trim() || !manualPhone.trim()) {
      notify.error("Missing fields", "Both Name and Number are required");
      return;
    }
    setLeads((prev) => [...prev, { name: manualName.trim(), phone: manualPhone.trim() }]);
    setManualName("");
    setManualPhone("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addManualLead();
    }
  };

  const removeLead = (index: number) => {
    setLeads((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: LeadEntry[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const name = row["Name"] || row["name"] || row["NAME"] || "";
          const phone = row["Phone"] || row["phone"] || row["Number"] || row["number"] || row["PHONE"] || row["NUMBER"] || row["Mobile"] || row["mobile"] || "";
          if (name.trim() && phone.trim()) {
            parsed.push({ name: name.trim(), phone: phone.trim() });
          }
        }
        if (parsed.length === 0) {
          notify.error("No valid rows", "CSV must have 'Name' and 'Phone'/'Number' columns");
        } else {
          setLeads((prev) => [...prev, ...parsed]);
          notify.success("CSV loaded", `${parsed.length} leads added to the list`);
        }
      },
      error: () => {
        notify.error("Parse error", "Could not read the CSV file");
      },
    });

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitLeads = async () => {
    if (leads.length === 0) {
      notify.error("No leads", "Add at least one lead before uploading");
      return;
    }
    if (!orgId) {
      notify.error("Error", "Organization not found");
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const rows = leads.map((lead) => ({
        first_name: lead.name,
        phone: lead.phone,
        org_id: orgId,
        source: "calling_upload",
        created_by: user?.id || null,
      }));

      const { error } = await supabase.from("contacts").insert(rows);
      if (error) throw error;

      notify.success("Uploaded", `${leads.length} leads uploaded successfully`);
      setLeads([]);
    } catch (err: any) {
      notify.error("Upload failed", err.message || "Something went wrong");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Upload Calling Leads</h1>
          <p className="text-muted-foreground">Add leads manually or upload a CSV for the calling team</p>
        </div>

        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Lead Manually
            </CardTitle>
            <CardDescription>Enter name and phone number, then press Add or hit Enter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="lead-name">Name</Label>
                <Input
                  id="lead-name"
                  placeholder="Lead name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="lead-phone">Phone Number</Label>
                <Input
                  id="lead-phone"
                  placeholder="Phone number"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addManualLead} variant="secondary">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CSV Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload CSV
            </CardTitle>
            <CardDescription>
              CSV should have <strong>Name</strong> and <strong>Phone</strong> (or Number) columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Choose CSV File
            </Button>
          </CardContent>
        </Card>

        {/* Leads Preview Table */}
        {leads.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Leads Preview ({leads.length})</CardTitle>
                <CardDescription>Review before uploading</CardDescription>
              </div>
              <Button onClick={submitLeads} disabled={isUploading}>
                {isUploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Upload {leads.length} Leads</>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{lead.name}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeLead(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { Loader2, Search, Phone, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";
import { useOrgContext } from "@/hooks/useOrgContext";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  stage_order: number;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  pipeline_stage_id: string | null;
  job_title?: string | null;
  source?: string | null;
  status?: string | null;
}

const STAGE_FILTERS = ["all", "Lead", "Application", "Sanction", "Disbursed", "Collection"];

export default function PipelineBoard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [callingContactId, setCallingContactId] = useState<string | null>(null);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    pipeline_stage_id: "",
    source: ""
  });
  
  const notify = useNotification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId } = useOrgContext();
  
  const tablePagination = usePagination({ defaultPageSize: 50 });

  const { data: stagesData } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, color, stage_order")
        .eq("is_active", true)
        .order("stage_order");
      if (error) throw error;
      return data as PipelineStage[];
    },
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['leads-contacts', stageFilter, tablePagination.currentPage, tablePagination.pageSize, stagesData],
    queryFn: async () => {
      const offset = (tablePagination.currentPage - 1) * tablePagination.pageSize;
      
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company, pipeline_stage_id, job_title, source, status, created_at", { count: 'exact' })
        .order("created_at", { ascending: false });
      
      // Apply stage filter
      if (stageFilter !== "all" && stagesData) {
        const stage = stagesData.find(s => s.name === stageFilter);
        if (stage) {
          query = query.eq("pipeline_stage_id", stage.id);
        }
      }
      
      query = query.range(offset, offset + tablePagination.pageSize - 1);
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Contact[], count: count || 0 };
    },
    enabled: !!stagesData,
  });

  // Create new lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (leadData: typeof newLead) => {
      if (!orgId) throw new Error("No organization context");
      
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          first_name: leadData.first_name,
          last_name: leadData.last_name || null,
          email: leadData.email || null,
          phone: leadData.phone || null,
          company: leadData.company || null,
          pipeline_stage_id: leadData.pipeline_stage_id || null,
          source: leadData.source || null,
          org_id: orgId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      notify.success("Lead created", "New lead has been added successfully");
      queryClient.invalidateQueries({ queryKey: ['leads-contacts'] });
      setShowNewLeadDialog(false);
      setNewLead({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company: "",
        pipeline_stage_id: "",
        source: ""
      });
    },
    onError: (error: any) => {
      notify.error("Error creating lead", error.message);
    }
  });

  useEffect(() => {
    if (contactsData) {
      setContacts(contactsData.data);
      setAllContacts(contactsData.data);
      tablePagination.setTotalRecords(contactsData.count);
    }
  }, [contactsData]);

  // Reset to page 1 when stage filter changes
  useEffect(() => {
    tablePagination.setPage(1);
  }, [stageFilter]);

  const stages = stagesData || [];
  const loading = !stagesData || contactsLoading;

  const handleCall = async (contact: Contact, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!contact.phone) {
      notify.error("No phone number", "This contact doesn't have a phone number");
      return;
    }

    setCallingContactId(contact.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();

      if (!profile?.phone) {
        notify.error("Phone number required", "Please add your phone number in profile settings");
        return;
      }

      const { data, error } = await supabase.functions.invoke('exotel-make-call', {
        body: {
          contactId: contact.id,
          agentPhoneNumber: profile.phone,
          customerPhoneNumber: contact.phone,
        },
      });

      if (error) throw error;

      notify.success("Call initiated", `Calling ${contact.first_name} ${contact.last_name || ''}`);
    } catch (error: any) {
      notify.error("Call failed", error.message);
    } finally {
      setCallingContactId(null);
    }
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) {
      setContacts(allContacts);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { 
          searchQuery: searchQuery.trim(),
          contacts: allContacts
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const filteredContactIds = data.filteredContactIds || [];
      const filtered = allContacts.filter(c => filteredContactIds.includes(c.id));
      setContacts(filtered);
      
      notify.success("Search complete", `Found ${filtered.length} matching leads`);
    } catch (error: any) {
      notify.error("Search failed", error);
      setContacts(allContacts);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setContacts(allContacts);
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.first_name.trim()) {
      notify.error("First name required", "Please enter a first name");
      return;
    }
    createLeadMutation.mutate(newLead);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading leads..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">View and manage your leads</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowNewLeadDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Lead
            </Button>
            <Button onClick={() => navigate('/pipeline/advanced-search')} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Advanced Search
            </Button>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <Tabs value={stageFilter} onValueChange={setStageFilter} className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            {STAGE_FILTERS.map((stage) => (
              <TabsTrigger key={stage} value={stage} className="capitalize">
                {stage === "all" ? "All Leads" : stage}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* AI Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search leads using AI (e.g., 'designation Manager, company in Mumbai, age 30-40')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSearching) {
                      handleAiSearch();
                    }
                  }}
                  disabled={isSearching}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Search by: designation, company, location (city/state/country), source, or combine criteria
                </p>
              </div>
              <Button 
                onClick={handleAiSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    AI Search
                  </>
                )}
              </Button>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={handleClearSearch}
                  disabled={isSearching}
                >
                  Clear
                </Button>
              )}
            </div>
            
            {/* Active Filter Indicator */}
            {searchQuery && contacts.length !== allContacts.length && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  Showing {contacts.length} of {allContacts.length} leads
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="h-6 text-xs"
                >
                  Remove filter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Pipeline Stage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map(contact => {
                  const stage = stages.find(s => s.id === contact.pipeline_stage_id);
                  return (
                    <TableRow
                      key={contact.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                          {contact.job_title && (
                            <p className="text-xs text-muted-foreground">{contact.job_title}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.email && <p className="text-sm">{contact.email}</p>}
                          {contact.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {stage ? (
                          <Badge 
                            variant="outline" 
                            style={{ borderColor: stage.color, color: stage.color }}
                          >
                            {stage.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Unassigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleCall(contact, e)}
                          disabled={!contact.phone || callingContactId === contact.id}
                        >
                          {callingContactId === contact.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {contacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {tablePagination.totalRecords > tablePagination.pageSize && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={tablePagination.currentPage}
                  totalPages={tablePagination.totalPages}
                  pageSize={tablePagination.pageSize}
                  totalRecords={tablePagination.totalRecords}
                  startRecord={tablePagination.startRecord}
                  endRecord={tablePagination.endRecord}
                  onPageChange={tablePagination.setPage}
                  onPageSizeChange={tablePagination.setPageSize}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Lead Dialog */}
      <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLead} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={newLead.first_name}
                  onChange={(e) => setNewLead(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={newLead.last_name}
                  onChange={(e) => setNewLead(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newLead.phone}
                onChange={(e) => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={newLead.company}
                onChange={(e) => setNewLead(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Acme Corp"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
              <Select
                value={newLead.pipeline_stage_id}
                onValueChange={(value) => setNewLead(prev => ({ ...prev, pipeline_stage_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={newLead.source}
                onChange={(e) => setNewLead(prev => ({ ...prev, source: e.target.value }))}
                placeholder="Website, Referral, etc."
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowNewLeadDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLeadMutation.isPending}>
                {createLeadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Lead"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

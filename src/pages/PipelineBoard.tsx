import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { Loader2, Search, Phone, Plus, Sparkles } from "lucide-react";
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
import { differenceInHours } from "date-fns";
import { toast } from "sonner";

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
  created_at?: string;
}

interface Filters {
  name: string;
  company: string;
  phone: string;
  statusFilter: string;
}

const STATUS_FILTERS = ["all", "new", "approved", "rejected", "in_progress"];

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "in_progress", label: "In-progress" },
];

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  new: "New",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In-progress",
};

export default function PipelineBoard() {
  const [filters, setFilters] = useState<Filters>({
    name: "",
    company: "",
    phone: "",
    statusFilter: "all"
  });
  const [callingContactId, setCallingContactId] = useState<string | null>(null);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    pipeline_stage_id: "",
    source: "",
    status: "new"
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

  // Set default stage to "Lead" when stages are loaded
  useEffect(() => {
    if (stagesData && !newLead.pipeline_stage_id) {
      const leadStage = stagesData.find(s => s.name === "Lead");
      if (leadStage) {
        setNewLead(prev => ({ ...prev, pipeline_stage_id: leadStage.id }));
      }
    }
  }, [stagesData]);

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['leads-contacts', filters, tablePagination.currentPage, tablePagination.pageSize],
    queryFn: async () => {
      const offset = (tablePagination.currentPage - 1) * tablePagination.pageSize;
      
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company, pipeline_stage_id, job_title, source, status, created_at", { count: 'exact' })
        .order("created_at", { ascending: false });
      
      // Apply name filter (searches first_name and last_name)
      if (filters.name.trim()) {
        query = query.or(`first_name.ilike.%${filters.name.trim()}%,last_name.ilike.%${filters.name.trim()}%`);
      }
      
      // Apply company filter
      if (filters.company.trim()) {
        query = query.ilike("company", `%${filters.company.trim()}%`);
      }
      
      // Apply phone filter
      if (filters.phone.trim()) {
        query = query.ilike("phone", `%${filters.phone.trim()}%`);
      }
      
      // Apply status filter
      if (filters.statusFilter !== "all") {
        if (filters.statusFilter === "new") {
          query = query.or("status.eq.new,status.is.null");
        } else {
          query = query.eq("status", filters.statusFilter);
        }
      }
      
      query = query.range(offset, offset + tablePagination.pageSize - 1);
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Contact[], count: count || 0 };
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ contactId, status }: { contactId: string; status: string }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ status })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-contacts'] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    },
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
          status: leadData.status || "new",
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
        source: "",
        status: "new"
      });
    },
    onError: (error: any) => {
      notify.error("Error creating lead", error.message);
    }
  });

  useEffect(() => {
    if (contactsData) {
      tablePagination.setTotalRecords(contactsData.count);
    }
  }, [contactsData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    tablePagination.setPage(1);
  }, [filters]);

  const stages = stagesData || [];
  const contacts = contactsData?.data || [];
  const loading = !stagesData || contactsLoading;

  const isFreshLead = (createdAt?: string) => {
    if (!createdAt) return false;
    return differenceInHours(new Date(), new Date(createdAt)) < 48;
  };

  const handleStatusChange = (contactId: string, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ contactId, status });
  };

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

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      name: "",
      company: "",
      phone: "",
      statusFilter: "all"
    });
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.first_name.trim()) {
      notify.error("First name required", "Please enter a first name");
      return;
    }
    if (!newLead.phone.trim()) {
      notify.error("Phone required", "Please enter a phone number");
      return;
    }
    createLeadMutation.mutate(newLead);
  };

  const hasActiveFilters = filters.name || filters.company || filters.phone || filters.statusFilter !== "all";

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
            <Button onClick={() => navigate('/pipeline/advanced-search')} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Advanced Search
            </Button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <Tabs value={filters.statusFilter} onValueChange={(value) => handleFilterChange("statusFilter", value)} className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            {STATUS_FILTERS.map((status) => (
              <TabsTrigger key={status} value={status} className="capitalize">
                {STATUS_LABELS[status]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Filter Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="filter-name" className="text-xs text-muted-foreground">Name</Label>
                <Input
                  id="filter-name"
                  placeholder="Search by name..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-company" className="text-xs text-muted-foreground">Company</Label>
                <Input
                  id="filter-company"
                  placeholder="Search by company..."
                  value={filters.company}
                  onChange={(e) => handleFilterChange("company", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-phone" className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  id="filter-phone"
                  placeholder="Search by phone..."
                  value={filters.phone}
                  onChange={(e) => handleFilterChange("phone", e.target.value)}
                />
              </div>
            </div>
            
            {hasActiveFilters && (
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {contactsData?.count || 0} results
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-6 text-xs"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>{STATUS_LABELS[filters.statusFilter]} Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map(contact => {
                  const isReferral = contact.source === 'referral_link';
                  const showNewBadge = isReferral || contact.status === "new" || (!contact.status && isFreshLead(contact.created_at));
                  return (
                    <TableRow
                      key={contact.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={(e) => handleCall(contact, e)}
                                disabled={!contact.phone || callingContactId === contact.id}
                              >
                                {callingContactId === contact.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Phone className="h-4 w-4" />
                                )}
                              </Button>
                              {showNewBadge && (
                                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  NEW LEAD
                                </Badge>
                              )}
                            </div>
                            {contact.job_title && (
                              <p className="text-xs text-muted-foreground">{contact.job_title}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>
                        <p className="text-sm">{contact.phone || '-'}</p>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={contact.status || "new"}
                          onValueChange={(value) => handleStatusChange(contact.id, value, { stopPropagation: () => {} } as any)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Set status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {contacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={newLead.phone}
                onChange={(e) => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={newLead.company}
                onChange={(e) => setNewLead(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={newLead.status}
                onValueChange={(value) => setNewLead(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowNewLeadDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLeadMutation.isPending}>
                {createLeadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Lead
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
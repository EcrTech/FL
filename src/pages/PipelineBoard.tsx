import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { Mail, Phone as PhoneIcon, Building, LayoutGrid, Table as TableIcon, Loader2, Search, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  stage_order: number;
  probability: number;
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
  notes?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export default function PipelineBoard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [draggedContact, setDraggedContact] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("board");
  const [callingContactId, setCallingContactId] = useState<string | null>(null);
  const notify = useNotification();
  const navigate = useNavigate();
  
  const tablePagination = usePagination({ defaultPageSize: 25 });

  const { data: stagesData } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("is_active", true)
        .order("stage_order");
      if (error) throw error;
      return data as PipelineStage[];
    },
  });

  const { data: contactsData } = useQuery({
    queryKey: ['pipeline-contacts', activeTab, tablePagination.currentPage, tablePagination.pageSize],
    queryFn: async () => {
      if (activeTab === "board") {
        // Board view: load all contacts
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, company, pipeline_stage_id, job_title, source, status, notes, website, address, city, state, country, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return { data: data as Contact[], count: data?.length || 0 };
      } else {
        // Table view: use pagination
        const offset = (tablePagination.currentPage - 1) * tablePagination.pageSize;
        const { data, error, count } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, company, pipeline_stage_id, job_title, source, status, notes, website, address, city, state, country, created_at", { count: 'exact' })
          .order("created_at", { ascending: false })
          .range(offset, offset + tablePagination.pageSize - 1);
        if (error) throw error;
        return { data: data as Contact[], count: count || 0 };
      }
    },
  });

  useEffect(() => {
    if (contactsData) {
      setContacts(contactsData.data);
      setAllContacts(contactsData.data);
      if (activeTab === "table") {
        tablePagination.setTotalRecords(contactsData.count);
      }
    }
  }, [contactsData, activeTab]);

  const stages = stagesData || [];
  const loading = !stagesData || !contactsData;

  const handleDragStart = (contactId: string) => {
    setDraggedContact(contactId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stageId: string) => {
    if (!draggedContact) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .update({ pipeline_stage_id: stageId })
        .eq("id", draggedContact);

      if (error) throw error;

      // Update local state
      setContacts(prev =>
        prev.map(contact =>
          contact.id === draggedContact
            ? { ...contact, pipeline_stage_id: stageId }
            : contact
        )
      );

      notify.success("Contact moved", "Contact has been moved to new stage");
    } catch (error: any) {
      notify.error("Error", error);
    } finally {
      setDraggedContact(null);
    }
  };

  const getContactsInStage = (stageId: string) => {
    return contacts.filter(contact => contact.pipeline_stage_id === stageId);
  };

  const getContactsWithoutStage = () => {
    return contacts.filter(contact => !contact.pipeline_stage_id);
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

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) {
      setContacts(allContacts);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Starting AI search with query:', searchQuery);
      console.log('Total contacts to search:', allContacts.length);
      
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { 
          searchQuery: searchQuery.trim(),
          contacts: allContacts
        }
      });

      console.log('AI search response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        console.error('Data error:', data.error);
        throw new Error(data.error);
      }

      // Filter contacts based on AI response
      const filteredContactIds = data.filteredContactIds || [];
      console.log('Filtered contact IDs:', filteredContactIds);
      
      const filtered = allContacts.filter(c => filteredContactIds.includes(c.id));
      console.log('Filtered contacts:', filtered.length);
      
      setContacts(filtered);
      
      notify.success("Search complete", `Found ${filtered.length} matching contacts`);
    } catch (error: any) {
      console.error('Search error:', error);
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

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading pipeline..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pipeline Board</h1>
            <p className="text-muted-foreground">View and manage your sales pipeline</p>
          </div>
          <Button onClick={() => navigate('/pipeline/advanced-search')} variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Advanced Search
          </Button>
        </div>

        {/* AI Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search contacts using AI (e.g., 'designation Manager, company in Mumbai, age 30-40')"
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
                  Showing {contacts.length} of {allContacts.length} contacts
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


        <Tabs defaultValue="table" className="w-full">
          <TabsList>
            <TabsTrigger value="board">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Board View
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableIcon className="h-4 w-4 mr-2" />
              Table View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-6">
            <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Unassigned column */}
          <div
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop("")}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Unassigned</span>
                  <Badge variant="secondary">{getContactsWithoutStage().length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {getContactsWithoutStage().map(contact => (
                  <Card
                    key={contact.id}
                    draggable
                     onDragStart={() => handleDragStart(contact.id)}
                     className="cursor-move hover:shadow-md transition-shadow animate-fade-in"
                     onClick={() => navigate(`/contacts/${contact.id}`)}
                   >
                     <CardContent className="p-3">
                       <p className="font-medium text-sm">
                         {contact.first_name} {contact.last_name}
                       </p>
                       {contact.company && (
                         <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                           <Building className="h-3 w-3" />
                           {contact.company}
                         </div>
                       )}
                       <div className="flex gap-2 mt-2">
                         {contact.email && (
                           <Mail className="h-3 w-3 text-muted-foreground" />
                         )}
                         {contact.phone && (
                           <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                         )}
                       </div>
                     </CardContent>
                   </Card>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Stage columns */}
          {stages.map(stage => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
            >
              <Card className="h-full" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{stage.name}</span>
                    <Badge variant="secondary">{getContactsInStage(stage.id).length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {stage.probability}% probability
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {getContactsInStage(stage.id).map(contact => (
                    <Card
                       key={contact.id}
                       draggable
                       onDragStart={() => handleDragStart(contact.id)}
                       className="cursor-move hover:shadow-md transition-shadow animate-fade-in"
                       onClick={() => navigate(`/contacts/${contact.id}`)}
                     >
                       <CardContent className="p-3">
                         <p className="font-medium text-sm">
                           {contact.first_name} {contact.last_name}
                         </p>
                         {contact.company && (
                           <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                             <Building className="h-3 w-3" />
                             {contact.company}
                           </div>
                         )}
                         <div className="flex gap-2 mt-2">
                           {contact.email && (
                             <Mail className="h-3 w-3 text-muted-foreground" />
                           )}
                           {contact.phone && (
                             <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                           )}
                         </div>
                       </CardContent>
                     </Card>
                  ))}
                </CardContent>
              </Card>
            </div>
            ))}
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Pipeline Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Pipeline Stage</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map(contact => {
                      const stage = stages.find(s => s.id === contact.pipeline_stage_id);
                      return (
                        <TableRow
                          key={contact.id}
                          className="hover:bg-muted/50"
                        >
                          <TableCell 
                            className="font-medium cursor-pointer"
                            onClick={() => navigate(`/contacts/${contact.id}`)}
                          >
                            {contact.first_name} {contact.last_name}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            {contact.company && (
                              <div className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {contact.company}
                              </div>
                            )}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            <div className="flex flex-col gap-1 text-sm">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <PhoneIcon className="h-3 w-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            {stage ? (
                              <Badge style={{ backgroundColor: stage.color }}>
                                {stage.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Unassigned</Badge>
                            )}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            {stage ? `${stage.probability}%` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleCall(contact, e)}
                              disabled={callingContactId === contact.id || !contact.phone}
                            >
                              {callingContactId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Phone className="h-4 w-4 mr-1" />
                                  Call
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {tablePagination.totalRecords > tablePagination.pageSize && activeTab === "table" && (
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
        )}
      </div>
    </DashboardLayout>
  );
}

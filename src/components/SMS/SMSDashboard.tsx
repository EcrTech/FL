 import { useState } from "react";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Badge } from "@/components/ui/badge";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { useOrgContext } from "@/hooks/useOrgContext";
 import { useRealtimeSync } from "@/hooks/useRealtimeSync";
 import { useNotification } from "@/hooks/useNotification";
 import { format } from "date-fns";
 import { Search, Download, RefreshCw, MessageSquare, CheckCircle, XCircle, Clock, Send, Settings } from "lucide-react";
 import { exportToCSV, ExportColumn, formatDateForExport } from "@/utils/exportUtils";
 import { Link } from "react-router-dom";
 
 interface SmsMessage {
   id: string;
   phone_number: string;
   message_content: string;
   status: string;
   trigger_type: string;
   sent_at: string | null;
   delivered_at: string | null;
   created_at: string;
   error_message: string | null;
   contact: {
     first_name: string;
     last_name: string | null;
   } | null;
 }
 
 interface SmsStats {
   total: number;
   sent: number;
   delivered: number;
   failed: number;
   pending: number;
 }
 
 export function SMSDashboard() {
   const { orgId } = useOrgContext();
   const notify = useNotification();
   const [searchQuery, setSearchQuery] = useState("");
 
   // Fetch SMS statistics
   const { data: stats = { total: 0, sent: 0, delivered: 0, failed: 0, pending: 0 }, refetch: refetchStats } = useQuery({
     queryKey: ['sms-stats', orgId],
     queryFn: async (): Promise<SmsStats> => {
       const { data, error } = await supabase
         .from('sms_messages')
         .select('status')
         .eq('org_id', orgId);
 
       if (error) throw error;
 
       const messages = data || [];
       return {
         total: messages.length,
         sent: messages.filter(m => m.status === 'sent').length,
         delivered: messages.filter(m => m.status === 'delivered').length,
         failed: messages.filter(m => m.status === 'failed' || m.status === 'undelivered').length,
         pending: messages.filter(m => m.status === 'pending' || m.status === 'queued').length,
       };
     },
     enabled: !!orgId,
   });
 
   // Fetch recent SMS messages
   const { data: messages = [], isLoading, refetch: refetchMessages } = useQuery({
     queryKey: ['sms-messages', orgId, searchQuery],
     queryFn: async () => {
       let query = supabase
         .from('sms_messages')
         .select(`
           id,
           phone_number,
           message_content,
           status,
           trigger_type,
           sent_at,
           delivered_at,
           created_at,
           error_message,
           contact:contacts(first_name, last_name)
         `)
         .eq('org_id', orgId)
         .order('created_at', { ascending: false })
         .limit(100);
 
       if (searchQuery) {
         query = query.or(`phone_number.ilike.%${searchQuery}%,message_content.ilike.%${searchQuery}%`);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return (data || []) as SmsMessage[];
     },
     enabled: !!orgId,
   });
 
   // Real-time updates
   useRealtimeSync({
     table: 'sms_messages',
     filter: `org_id=eq.${orgId}`,
     onUpdate: () => {
       refetchStats();
       refetchMessages();
     },
     onInsert: () => {
       refetchStats();
       refetchMessages();
     },
     enabled: !!orgId,
   });
 
   const handleRefresh = () => {
     refetchStats();
     refetchMessages();
     notify.success("Refreshed", "Data updated");
   };
 
   const handleExport = () => {
     try {
       const columns: ExportColumn[] = [
         { key: 'phone_number', label: 'Phone Number' },
         { key: 'contact', label: 'Contact Name', format: (v: any) => v ? `${v.first_name} ${v.last_name || ''}`.trim() : 'Unknown' },
         { key: 'message_content', label: 'Message' },
         { key: 'status', label: 'Status' },
         { key: 'trigger_type', label: 'Trigger Type' },
         { key: 'sent_at', label: 'Sent At', format: formatDateForExport },
         { key: 'delivered_at', label: 'Delivered At', format: formatDateForExport },
         { key: 'error_message', label: 'Error' },
       ];
 
       exportToCSV(messages, columns, `sms-messages-${new Date().toISOString().split('T')[0]}`);
       notify.success("Exported", "SMS messages exported to CSV");
     } catch (error) {
       notify.error("Export failed", "Could not export messages");
     }
   };
 
   const getStatusBadge = (status: string) => {
     const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
       pending: { variant: "secondary", icon: Clock },
       queued: { variant: "secondary", icon: Clock },
       sent: { variant: "default", icon: Send },
       delivered: { variant: "default", icon: CheckCircle },
       failed: { variant: "destructive", icon: XCircle },
       undelivered: { variant: "destructive", icon: XCircle },
     };
     const config = variants[status] || { variant: "secondary" as const, icon: Clock };
     const Icon = config.icon;
     return (
       <Badge variant={config.variant} className="gap-1">
         <Icon className="h-3 w-3" />
         {status}
       </Badge>
     );
   };
 
   const getTriggerBadge = (triggerType: string) => {
     const colors: Record<string, string> = {
       manual: "bg-blue-500/10 text-blue-700",
       automation: "bg-purple-500/10 text-purple-700",
       system: "bg-gray-500/10 text-gray-700",
     };
     return (
       <Badge variant="outline" className={colors[triggerType] || colors.system}>
         {triggerType}
       </Badge>
     );
   };
 
   return (
     <div className="space-y-6">
       {/* Stats Cards */}
       <div className="grid gap-4 md:grid-cols-5">
         <Card>
           <CardHeader className="pb-2">
             <CardDescription>Total SMS</CardDescription>
             <CardTitle className="text-3xl">{stats.total}</CardTitle>
           </CardHeader>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardDescription>Sent</CardDescription>
             <CardTitle className="text-3xl text-blue-600">{stats.sent}</CardTitle>
           </CardHeader>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardDescription>Delivered</CardDescription>
             <CardTitle className="text-3xl text-green-600">{stats.delivered}</CardTitle>
           </CardHeader>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardDescription>Failed</CardDescription>
             <CardTitle className="text-3xl text-red-600">{stats.failed}</CardTitle>
           </CardHeader>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardDescription>Pending</CardDescription>
             <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
           </CardHeader>
         </Card>
       </div>
 
       {/* Messages Table */}
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <MessageSquare className="h-5 w-5" />
                 Recent SMS Messages
               </CardTitle>
               <CardDescription>View and track all sent SMS messages</CardDescription>
             </div>
             <div className="flex items-center gap-2">
               <Button variant="outline" asChild>
                 <Link to="/sms-automation-rules">
                   <Settings className="h-4 w-4 mr-2" />
                   Automation Rules
                 </Link>
               </Button>
               <Button variant="outline" size="icon" onClick={handleRefresh}>
                 <RefreshCw className="h-4 w-4" />
               </Button>
               <Button variant="outline" onClick={handleExport}>
                 <Download className="h-4 w-4 mr-2" />
                 Export
               </Button>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           <div className="mb-4">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Search by phone number or message..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-10"
               />
             </div>
           </div>
 
           <ScrollArea className="h-[400px]">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Phone</TableHead>
                   <TableHead>Contact</TableHead>
                   <TableHead className="max-w-[200px]">Message</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Type</TableHead>
                   <TableHead>Sent</TableHead>
                   <TableHead>Error</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {isLoading ? (
                   <TableRow>
                     <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                       Loading messages...
                     </TableCell>
                   </TableRow>
                 ) : messages.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                       No SMS messages found
                     </TableCell>
                   </TableRow>
                 ) : (
                   messages.map((msg) => (
                     <TableRow key={msg.id}>
                       <TableCell className="font-mono text-sm">{msg.phone_number}</TableCell>
                       <TableCell>
                         {msg.contact 
                           ? `${msg.contact.first_name} ${msg.contact.last_name || ''}`.trim()
                           : <span className="text-muted-foreground">Unknown</span>
                         }
                       </TableCell>
                       <TableCell className="max-w-[200px] truncate" title={msg.message_content}>
                         {msg.message_content}
                       </TableCell>
                       <TableCell>{getStatusBadge(msg.status)}</TableCell>
                       <TableCell>{getTriggerBadge(msg.trigger_type)}</TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {msg.sent_at 
                           ? format(new Date(msg.sent_at), 'MMM d, h:mm a')
                           : '-'
                         }
                       </TableCell>
                       <TableCell className="max-w-[150px] truncate text-sm text-red-600" title={msg.error_message || ''}>
                         {msg.error_message || '-'}
                       </TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           </ScrollArea>
         </CardContent>
       </Card>
     </div>
   );
 }
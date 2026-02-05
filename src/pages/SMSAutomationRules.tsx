 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import DashboardLayout from "@/components/Layout/DashboardLayout";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Switch } from "@/components/ui/switch";
 import { Badge } from "@/components/ui/badge";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { useOrgContext } from "@/hooks/useOrgContext";
 import { useNotification } from "@/hooks/useNotification";
 import { LoadingState } from "@/components/common/LoadingState";
 import { Plus, Pencil, Trash2, Zap, Clock, Send, AlertCircle } from "lucide-react";
 import { format } from "date-fns";
 
 interface SmsAutomationRule {
   id: string;
   name: string;
   description: string | null;
   is_active: boolean;
   trigger_type: string;
   trigger_config: Record<string, any>;
   sms_template_id: string | null;
   send_delay_minutes: number;
   max_sends_per_contact: number;
   cooldown_period_days: number;
   priority: number;
   total_triggered: number;
   total_sent: number;
   total_failed: number;
   created_at: string;
 }
 
 interface SmsTemplate {
   id: string;
   template_name: string;
   content: string;
 }
 
 const TRIGGER_TYPES = [
   { value: 'stage_change', label: 'Loan Stage Change', description: 'When loan moves to a new stage' },
   { value: 'disposition_set', label: 'Call Disposition Set', description: 'When a call disposition is recorded' },
   { value: 'emandate_status', label: 'eMandate Status Change', description: 'When eMandate status updates' },
   { value: 'esign_status', label: 'eSign Status Change', description: 'When document is signed' },
   { value: 'loan_approved', label: 'Loan Approved', description: 'When loan is approved' },
   { value: 'loan_disbursed', label: 'Loan Disbursed', description: 'When loan is disbursed' },
   { value: 'document_uploaded', label: 'Document Uploaded', description: 'When document is uploaded' },
 ];
 
 export default function SMSAutomationRules() {
   const { orgId } = useOrgContext();
   const notify = useNotification();
   const queryClient = useQueryClient();
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editingRule, setEditingRule] = useState<SmsAutomationRule | null>(null);
   const [formData, setFormData] = useState({
     name: '',
     description: '',
     trigger_type: 'stage_change',
     sms_template_id: '',
     send_delay_minutes: 0,
     max_sends_per_contact: 1,
     cooldown_period_days: 0,
     priority: 100,
   });
 
   // Fetch rules
   const { data: rules = [], isLoading } = useQuery({
     queryKey: ['sms-automation-rules', orgId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('sms_automation_rules')
         .select('*')
         .eq('org_id', orgId)
         .order('priority', { ascending: false });
 
       if (error) throw error;
       return data as SmsAutomationRule[];
     },
     enabled: !!orgId,
   });
 
   // Fetch SMS templates
   const { data: templates = [] } = useQuery({
     queryKey: ['sms-templates', orgId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('communication_templates')
         .select('id, template_name, content')
         .eq('org_id', orgId)
         .eq('template_type', 'sms')
         .eq('status', 'approved');
 
       if (error) throw error;
       return data as SmsTemplate[];
     },
     enabled: !!orgId,
   });
 
   // Create/Update rule
   const saveMutation = useMutation({
     mutationFn: async (data: typeof formData & { id?: string }) => {
       const ruleData = {
         org_id: orgId,
         name: data.name,
         description: data.description || null,
         trigger_type: data.trigger_type,
         trigger_config: {},
         sms_template_id: data.sms_template_id || null,
         send_delay_minutes: data.send_delay_minutes,
         max_sends_per_contact: data.max_sends_per_contact,
         cooldown_period_days: data.cooldown_period_days,
         priority: data.priority,
       };
 
       if (data.id) {
         const { error } = await supabase
           .from('sms_automation_rules')
           .update(ruleData)
           .eq('id', data.id);
         if (error) throw error;
       } else {
         const { error } = await supabase
           .from('sms_automation_rules')
           .insert(ruleData);
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['sms-automation-rules'] });
       setDialogOpen(false);
       resetForm();
       notify.success("Saved", editingRule ? "Rule updated" : "Rule created");
     },
     onError: (error: any) => {
       notify.error("Error", error.message);
     },
   });
 
   // Toggle active
   const toggleMutation = useMutation({
     mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
       const { error } = await supabase
         .from('sms_automation_rules')
         .update({ is_active })
         .eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['sms-automation-rules'] });
     },
     onError: (error: any) => {
       notify.error("Error", error.message);
     },
   });
 
   // Delete rule
   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('sms_automation_rules')
         .delete()
         .eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['sms-automation-rules'] });
       notify.success("Deleted", "Rule deleted");
     },
     onError: (error: any) => {
       notify.error("Error", error.message);
     },
   });
 
   const resetForm = () => {
     setFormData({
       name: '',
       description: '',
       trigger_type: 'stage_change',
       sms_template_id: '',
       send_delay_minutes: 0,
       max_sends_per_contact: 1,
       cooldown_period_days: 0,
       priority: 100,
     });
     setEditingRule(null);
   };
 
   const handleEdit = (rule: SmsAutomationRule) => {
     setEditingRule(rule);
     setFormData({
       name: rule.name,
       description: rule.description || '',
       trigger_type: rule.trigger_type,
       sms_template_id: rule.sms_template_id || '',
       send_delay_minutes: rule.send_delay_minutes,
       max_sends_per_contact: rule.max_sends_per_contact,
       cooldown_period_days: rule.cooldown_period_days,
       priority: rule.priority,
     });
     setDialogOpen(true);
   };
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!formData.name || !formData.trigger_type) {
       notify.error("Missing fields", "Please fill in required fields");
       return;
     }
     saveMutation.mutate(editingRule ? { ...formData, id: editingRule.id } : formData);
   };
 
   const getTriggerLabel = (type: string) => {
     return TRIGGER_TYPES.find(t => t.value === type)?.label || type;
   };
 
   if (isLoading) {
     return (
       <DashboardLayout>
         <LoadingState message="Loading automation rules..." />
       </DashboardLayout>
     );
   }
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-bold">SMS Automation Rules</h1>
             <p className="text-muted-foreground mt-2">
               Configure automated SMS triggers for loan events
             </p>
           </div>
           <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
             <DialogTrigger asChild>
               <Button>
                 <Plus className="h-4 w-4 mr-2" />
                 Create Rule
               </Button>
             </DialogTrigger>
             <DialogContent className="max-w-lg">
               <DialogHeader>
                 <DialogTitle>{editingRule ? 'Edit Rule' : 'Create SMS Automation Rule'}</DialogTitle>
                 <DialogDescription>
                   Configure when to automatically send SMS notifications
                 </DialogDescription>
               </DialogHeader>
               <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="name">Rule Name *</Label>
                   <Input
                     id="name"
                     value={formData.name}
                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                     placeholder="e.g., Loan Approval SMS"
                   />
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="description">Description</Label>
                   <Textarea
                     id="description"
                     value={formData.description}
                     onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                     placeholder="Describe what this rule does..."
                   />
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="trigger_type">Trigger Event *</Label>
                   <Select value={formData.trigger_type} onValueChange={(v) => setFormData({ ...formData, trigger_type: v })}>
                     <SelectTrigger>
                       <SelectValue placeholder="Select trigger" />
                     </SelectTrigger>
                     <SelectContent>
                       {TRIGGER_TYPES.map((t) => (
                         <SelectItem key={t.value} value={t.value}>
                           <div>
                             <div>{t.label}</div>
                             <div className="text-xs text-muted-foreground">{t.description}</div>
                           </div>
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="template">SMS Template</Label>
                   <Select value={formData.sms_template_id} onValueChange={(v) => setFormData({ ...formData, sms_template_id: v })}>
                     <SelectTrigger>
                       <SelectValue placeholder="Select template" />
                     </SelectTrigger>
                     <SelectContent>
                       {templates.length === 0 ? (
                         <SelectItem value="" disabled>No SMS templates found</SelectItem>
                       ) : (
                         templates.map((t) => (
                           <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                         ))
                       )}
                     </SelectContent>
                   </Select>
                   {templates.length === 0 && (
                     <p className="text-xs text-yellow-600 flex items-center gap-1">
                       <AlertCircle className="h-3 w-3" />
                       Create SMS templates in Templates page first
                     </p>
                   )}
                 </div>
 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="delay">Send Delay (minutes)</Label>
                     <Input
                       id="delay"
                       type="number"
                       min={0}
                       value={formData.send_delay_minutes}
                       onChange={(e) => setFormData({ ...formData, send_delay_minutes: parseInt(e.target.value) || 0 })}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="priority">Priority</Label>
                     <Input
                       id="priority"
                       type="number"
                       value={formData.priority}
                       onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                     />
                   </div>
                 </div>
 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="maxSends">Max Sends/Contact</Label>
                     <Input
                       id="maxSends"
                       type="number"
                       min={1}
                       value={formData.max_sends_per_contact}
                       onChange={(e) => setFormData({ ...formData, max_sends_per_contact: parseInt(e.target.value) || 1 })}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="cooldown">Cooldown (days)</Label>
                     <Input
                       id="cooldown"
                       type="number"
                       min={0}
                       value={formData.cooldown_period_days}
                       onChange={(e) => setFormData({ ...formData, cooldown_period_days: parseInt(e.target.value) || 0 })}
                     />
                   </div>
                 </div>
 
                 <div className="flex justify-end gap-2 pt-4">
                   <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                     Cancel
                   </Button>
                   <Button type="submit" disabled={saveMutation.isPending}>
                     {saveMutation.isPending ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                   </Button>
                 </div>
               </form>
             </DialogContent>
           </Dialog>
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle>Automation Rules</CardTitle>
             <CardDescription>
               {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
             </CardDescription>
           </CardHeader>
           <CardContent>
             {rules.length === 0 ? (
               <div className="text-center py-8 text-muted-foreground">
                 <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                 <p>No automation rules yet</p>
                 <p className="text-sm">Create your first rule to start automating SMS notifications</p>
               </div>
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Rule</TableHead>
                     <TableHead>Trigger</TableHead>
                     <TableHead>Delay</TableHead>
                     <TableHead>Stats</TableHead>
                     <TableHead>Active</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {rules.map((rule) => (
                     <TableRow key={rule.id}>
                       <TableCell>
                         <div>
                           <p className="font-medium">{rule.name}</p>
                           {rule.description && (
                             <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                               {rule.description}
                             </p>
                           )}
                         </div>
                       </TableCell>
                       <TableCell>
                         <Badge variant="outline">
                           <Zap className="h-3 w-3 mr-1" />
                           {getTriggerLabel(rule.trigger_type)}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         {rule.send_delay_minutes > 0 ? (
                           <span className="flex items-center gap-1 text-sm">
                             <Clock className="h-3 w-3" />
                             {rule.send_delay_minutes}m
                           </span>
                         ) : (
                           <span className="text-sm text-muted-foreground">Instant</span>
                         )}
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2 text-sm">
                           <span className="text-muted-foreground">
                             {rule.total_triggered} triggered
                           </span>
                           <span className="text-green-600">{rule.total_sent} sent</span>
                           {rule.total_failed > 0 && (
                             <span className="text-red-600">{rule.total_failed} failed</span>
                           )}
                         </div>
                       </TableCell>
                       <TableCell>
                         <Switch
                           checked={rule.is_active}
                           onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, is_active: checked })}
                         />
                       </TableCell>
                       <TableCell className="text-right">
                         <div className="flex justify-end gap-1">
                           <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                             <Pencil className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="text-destructive"
                             onClick={() => {
                               if (confirm('Delete this rule?')) {
                                 deleteMutation.mutate(rule.id);
                               }
                             }}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
           </CardContent>
         </Card>
       </div>
     </DashboardLayout>
   );
 }
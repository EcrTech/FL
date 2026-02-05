 import { useState, useEffect } from "react";
 import { useOrgContext } from "@/hooks/useOrgContext";
 import { useNotification } from "@/hooks/useNotification";
 import { supabase } from "@/integrations/supabase/client";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Label } from "@/components/ui/label";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Badge } from "@/components/ui/badge";
 import { Loader2, Plus, X } from "lucide-react";
 
 interface SMSTemplate {
   id: string;
   name: string;
   dlt_template_id: string;
   content: string;
   variables: Array<{ dlt_var: string; name: string; description: string }>;
   category: string;
   language: string;
   char_count: number;
   is_active: boolean;
   created_at: string;
   updated_at: string;
 }
 
 interface SMSTemplateDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   template: SMSTemplate | null;
   onSuccess: () => void;
 }
 
 export function SMSTemplateDialog({
   open,
   onOpenChange,
   template,
   onSuccess,
 }: SMSTemplateDialogProps) {
   const { orgId } = useOrgContext();
   const notify = useNotification();
   const [saving, setSaving] = useState(false);
   
   const [name, setName] = useState("");
   const [dltTemplateId, setDltTemplateId] = useState("");
   const [content, setContent] = useState("");
   const [category, setCategory] = useState("transactional");
   const [language, setLanguage] = useState("en");
   const [variables, setVariables] = useState<Array<{ dlt_var: string; name: string; description: string }>>([]);
   
   useEffect(() => {
     if (template) {
       setName(template.name);
       setDltTemplateId(template.dlt_template_id);
       setContent(template.content);
       setCategory(template.category);
       setLanguage(template.language);
       setVariables(template.variables || []);
     } else {
       setName("");
       setDltTemplateId("");
       setContent("");
       setCategory("transactional");
       setLanguage("en");
       setVariables([]);
     }
   }, [template, open]);
   
   // Extract DLT variables from content
   useEffect(() => {
     const matches = content.match(/\{#var\d*#\}/g) || [];
     const uniqueVars = [...new Set(matches)];
     
     // Update variables list while preserving existing mappings
     setVariables(prev => {
       const newVars = uniqueVars.map(dltVar => {
         const cleanVar = dltVar.replace(/[{}#]/g, '');
         const existing = prev.find(v => v.dlt_var === cleanVar);
         return existing || { dlt_var: cleanVar, name: "", description: "" };
       });
       return newVars;
     });
   }, [content]);
   
   const handleVariableChange = (index: number, field: 'name' | 'description', value: string) => {
     setVariables(prev => {
       const updated = [...prev];
       updated[index] = { ...updated[index], [field]: value };
       return updated;
     });
   };
   
   const handleSubmit = async () => {
     if (!name || !dltTemplateId || !content) {
       notify.error("Validation Error", "Please fill in all required fields");
       return;
     }
     
     setSaving(true);
     try {
       const templateData = {
         org_id: orgId,
         name,
         dlt_template_id: dltTemplateId,
         content,
         variables,
         category,
         language,
         char_count: content.length,
         is_active: true,
       };
       
       if (template?.id) {
         const { error } = await supabase
           .from("sms_templates")
           .update(templateData)
           .eq("id", template.id);
         
         if (error) throw error;
         notify.success("Success", "SMS template updated successfully");
       } else {
         const { error } = await supabase
           .from("sms_templates")
           .insert(templateData);
         
         if (error) throw error;
         notify.success("Success", "SMS template created successfully");
       }
       
       onSuccess();
       onOpenChange(false);
     } catch (error: any) {
       console.error("Error saving SMS template:", error);
       notify.error("Error", error.message || "Failed to save SMS template");
     } finally {
       setSaving(false);
     }
   };
   
   const charCount = content.length;
   const segments = Math.ceil(charCount / 160) || 1;
   
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle>
             {template ? "Edit SMS Template" : "Create SMS Template"}
           </DialogTitle>
         </DialogHeader>
         
         <div className="space-y-6">
           {/* Template Name */}
           <div className="space-y-2">
             <Label htmlFor="name">Template Name *</Label>
             <Input
               id="name"
               placeholder="e.g., OTP Verification"
               value={name}
               onChange={(e) => setName(e.target.value)}
             />
           </div>
           
           {/* DLT Template ID */}
           <div className="space-y-2">
             <Label htmlFor="dlt_template_id">DLT Template ID *</Label>
             <Input
               id="dlt_template_id"
               placeholder="e.g., 1607100000000371566"
               value={dltTemplateId}
               onChange={(e) => setDltTemplateId(e.target.value)}
             />
             <p className="text-xs text-muted-foreground">
               Get this from your DLT portal (e.g., TATA Tele, Airtel, etc.)
             </p>
           </div>
           
           {/* Content */}
           <div className="space-y-2">
             <div className="flex items-center justify-between">
               <Label htmlFor="content">Message Content *</Label>
               <div className="flex items-center gap-2 text-xs">
                 <span className={charCount > 160 ? "text-amber-500" : "text-muted-foreground"}>
                   {charCount} characters
                 </span>
                 <Badge variant={segments > 1 ? "secondary" : "outline"}>
                   {segments} segment{segments !== 1 ? 's' : ''}
                 </Badge>
               </div>
             </div>
             <Textarea
               id="content"
               placeholder="Your PaisaaSaarthi OTP is {#var#}. Valid for 10 mins"
               value={content}
               onChange={(e) => setContent(e.target.value)}
               rows={4}
             />
             <p className="text-xs text-muted-foreground">
               Use {`{#var#}`} or {`{#var1#}`}, {`{#var2#}`} for variables. Content must match DLT registration exactly.
             </p>
           </div>
           
           {/* Variables Mapping */}
           {variables.length > 0 && (
             <div className="space-y-3">
               <Label>Variable Mappings</Label>
               <div className="space-y-2">
                 {variables.map((variable, index) => (
                   <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-md">
                     <Badge variant="outline" className="shrink-0">
                       {`{#${variable.dlt_var}#}`}
                     </Badge>
                     <Input
                       placeholder="System variable (e.g., otp)"
                       value={variable.name}
                       onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                       className="flex-1"
                     />
                     <Input
                       placeholder="Description"
                       value={variable.description}
                       onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                       className="flex-1"
                     />
                   </div>
                 ))}
               </div>
               <p className="text-xs text-muted-foreground">
                 Map DLT placeholders to system variables. Use these in automation: {`{{variable_name}}`}
               </p>
             </div>
           )}
           
           {/* Category and Language */}
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="category">Category</Label>
               <Select value={category} onValueChange={setCategory}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="transactional">Transactional</SelectItem>
                   <SelectItem value="promotional">Promotional</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             
             <div className="space-y-2">
               <Label htmlFor="language">Language</Label>
               <Select value={language} onValueChange={setLanguage}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="en">English</SelectItem>
                   <SelectItem value="hi">Hindi</SelectItem>
                   <SelectItem value="mr">Marathi</SelectItem>
                   <SelectItem value="ta">Tamil</SelectItem>
                   <SelectItem value="te">Telugu</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
           
           {/* Actions */}
           <div className="flex justify-end gap-3">
             <Button variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button onClick={handleSubmit} disabled={saving}>
               {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {template ? "Update Template" : "Create Template"}
             </Button>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 }
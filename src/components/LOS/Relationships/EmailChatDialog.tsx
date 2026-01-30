import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Send, 
  CheckCheck, 
  Check, 
  Clock, 
  AlertCircle,
  Loader2,
  Mail,
  Paperclip,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrgContext } from "@/hooks/useOrgContext";

interface EmailMessage {
  id: string;
  direction: string;
  subject: string;
  email_content: string;
  html_content?: string;
  from_email: string;
  to_email: string;
  status: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string | null;
  is_read: boolean | null;
  has_attachments: boolean | null;
  opened_at: string | null;
}

interface EmailChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  email: string;
}

export function EmailChatDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  email,
}: EmailChatDialogProps) {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [composing, setComposing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { orgId } = useOrgContext();
  const [userInfo, setUserInfo] = useState<{ firstName: string; lastName: string; email: string } | null>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch user info
  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserInfo({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: user.email || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  // Fetch existing messages for this email
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_conversations')
        .select('id, direction, subject, email_content, html_content, from_email, to_email, status, sent_at, received_at, created_at, is_read, has_attachments, opened_at')
        .or(`to_email.eq.${email},from_email.eq.${email}`)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching emails:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  }, [email, orgId]);

  // Send email via edge function
  const sendEmail = async () => {
    if (!subject.trim() || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: subject.trim(),
          htmlContent: newMessage.replace(/\n/g, '<br>'),
          contactId: contactId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send email');
      }

      toast({
        title: "Email sent",
        description: `Email sent successfully to ${contactName}`,
      });

      setSubject("");
      setNewMessage("");
      setComposing(false);
      
      // Refresh messages
      await fetchMessages();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!open) {
      setComposing(false);
      return;
    }

    fetchMessages();
    fetchUserInfo();
  }, [open, fetchMessages]);

  // Real-time subscription for new emails
  useEffect(() => {
    if (!open || !orgId) return;

    const channel = supabase
      .channel(`email-chat-${email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_conversations',
        },
        (payload) => {
          console.log('[Realtime] Email change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newEmail = payload.new as EmailMessage;
            // Only add if relevant to this conversation
            if (newEmail.to_email === email || newEmail.from_email === email) {
              setMessages(prev => {
                if (prev.some(m => m.id === newEmail.id)) return prev;
                return [...prev, newEmail];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => m.id === payload.new.id ? payload.new as EmailMessage : m)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to email chat:', email);
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from email chat');
      supabase.removeChannel(channel);
    };
  }, [open, email, orgId]);

  const getStatusIcon = (message: EmailMessage) => {
    if (message.opened_at) {
      return <span title="Opened"><Eye className="h-3 w-3 text-blue-500" /></span>;
    }
    switch (message.status) {
      case 'delivered':
        return <span title="Delivered"><CheckCheck className="h-3 w-3 text-muted-foreground" /></span>;
      case 'sent':
        return <span title="Sent"><Check className="h-3 w-3 text-muted-foreground" /></span>;
      case 'failed':
        return <span title="Failed"><AlertCircle className="h-3 w-3 text-red-500" /></span>;
      case 'scheduled':
        return <span title="Scheduled"><Clock className="h-3 w-3 text-orange-500" /></span>;
      default:
        return <span title="Pending"><Clock className="h-3 w-3 text-muted-foreground" /></span>;
    }
  };

  const initials = contactName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Strip HTML tags for preview
  const stripHtml = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-blue-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/30">
              <AvatarFallback className="bg-blue-700 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-white font-semibold">
                {contactName}
              </DialogTitle>
              <div className="flex items-center gap-1 text-blue-100 text-sm">
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{email}</span>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-500 text-white border-0">
              {messages.length} emails
            </Badge>
          </div>
        </DialogHeader>

        {/* Email List Area */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 bg-slate-50 dark:bg-slate-800"
        >
          <div className="p-4 space-y-3 min-h-full">
            {loading ? (
              <div className="flex items-center justify-center h-full py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground text-sm">
                <Mail className="h-10 w-10 mb-2 opacity-50" />
                <p>No email history with {contactName}</p>
                <p className="text-xs">Click "New Email" to start a conversation</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%]">
                    <div
                      className={`rounded-lg px-3 py-2 shadow-sm ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-100 dark:bg-blue-900 text-foreground'
                          : 'bg-white dark:bg-slate-700 text-foreground'
                      }`}
                    >
                      {/* Subject Line */}
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                        {msg.subject}
                      </p>
                      
                      {/* Email Content Preview */}
                      <p className="text-sm whitespace-pre-wrap line-clamp-4">
                        {stripHtml(msg.email_content || msg.html_content || '')}
                      </p>
                      
                      {/* Attachment indicator */}
                      {msg.has_attachments && (
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          <span className="text-xs">Has attachments</span>
                        </div>
                      )}
                      
                      {/* Footer with timestamp and status */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">
                          {msg.sent_at || msg.received_at || msg.created_at
                            ? format(new Date(msg.sent_at || msg.received_at || msg.created_at!), "MMM d, HH:mm")
                            : ""}
                        </span>
                        {msg.direction === 'outbound' && (
                          <div className="flex items-center gap-1">
                            {getStatusIcon(msg)}
                            {msg.opened_at && (
                              <span className="text-[10px] text-blue-500">Opened</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Sending indicator */}
            {sending && (
              <div className="flex justify-end">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Sending...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Compose Area */}
        <div className="p-3 border-t bg-background">
          {!composing ? (
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => setComposing(true)}
            >
              <Mail className="h-4 w-4 mr-2" />
              New Email
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
              />
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
              {userInfo && (
                <p className="text-[10px] text-muted-foreground">
                  Sending as: {userInfo.firstName} {userInfo.lastName} ({userInfo.email})
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setComposing(false);
                    setSubject("");
                    setNewMessage("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={sendEmail}
                  disabled={!subject.trim() || !newMessage.trim() || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

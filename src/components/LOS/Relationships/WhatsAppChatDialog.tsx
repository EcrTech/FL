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
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppMessage {
  id: string;
  direction: string;
  message_content: string;
  sent_at: string | null;
  status: string;
  phone_number: string;
  created_at: string | null;
}

interface WhatsAppChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  phoneNumber: string;
}

const CONVERSATION_TEMPLATE = {
  name: "conversation",
  language: "en",
  content: `Hello

I have a few clarifications to seek about your application. Are you available now?

team PaisaaSaarthi`,
};

export function WhatsAppChatDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  phoneNumber,
}: WhatsAppChatDialogProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [autoSendTriggered, setAutoSendTriggered] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Format phone number for queries
  const formattedPhone = phoneNumber.replace(/[^\d]/g, '').startsWith('+') 
    ? phoneNumber.replace(/[^\d+]/g, '')
    : '+' + phoneNumber.replace(/[^\d]/g, '');

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

  // Fetch existing messages
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, message_content, sent_at, status, phone_number, created_at')
        .eq('phone_number', formattedPhone)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [formattedPhone]);

  // Send the conversation template
  const sendConversationTemplate = useCallback(async () => {
    if (sending || autoSendTriggered) return;
    
    setAutoSendTriggered(true);
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          contactId,
          phoneNumber: formattedPhone,
          templateName: CONVERSATION_TEMPLATE.name,
          message: CONVERSATION_TEMPLATE.content,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send message');
      }

      toast({
        title: "Message sent",
        description: "Conversation template sent successfully",
      });

      // Refresh messages to show the sent one
      await fetchMessages();
    } catch (error) {
      console.error('Error sending template:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [contactId, formattedPhone, sending, autoSendTriggered, toast, fetchMessages]);

  // Check if session window is active (24 hours from last inbound message)
  const isSessionActive = useCallback(() => {
    const lastInbound = messages
      .filter(m => m.direction === 'inbound')
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    
    if (!lastInbound?.created_at) return false;
    
    const lastInboundTime = new Date(lastInbound.created_at).getTime();
    const now = Date.now();
    const hoursDiff = (now - lastInboundTime) / (1000 * 60 * 60);
    
    return hoursDiff < 24;
  }, [messages]);

  // Send a follow-up message (within session window)
  const sendFollowUpMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    if (!isSessionActive()) {
      toast({
        title: "Session expired",
        description: "You can only send free-form messages within 24 hours of receiving a reply",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          contactId,
          phoneNumber: formattedPhone,
          message: newMessage.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send message');
      }

      setNewMessage("");
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Initial load and auto-send logic
  useEffect(() => {
    if (!open) {
      setAutoSendTriggered(false);
      return;
    }

    const initChat = async () => {
      const existingMessages = await fetchMessages();
      
      // Auto-send template if no messages exist
      if (existingMessages && existingMessages.length === 0 && !autoSendTriggered) {
        await sendConversationTemplate();
      }
    };

    initChat();
  }, [open, fetchMessages, sendConversationTemplate, autoSendTriggered]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`whatsapp-chat-${formattedPhone}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `phone_number=eq.${formattedPhone}`,
        },
        (payload) => {
          console.log('[Realtime] WhatsApp message change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as WhatsAppMessage;
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => m.id === payload.new.id ? payload.new as WhatsAppMessage : m)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to WhatsApp chat:', formattedPhone);
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from WhatsApp chat');
      supabase.removeChannel(channel);
    };
  }, [open, formattedPhone]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const initials = contactName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-green-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/30">
              <AvatarFallback className="bg-green-700 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-white font-semibold">
                {contactName}
              </DialogTitle>
              <div className="flex items-center gap-1 text-green-100 text-sm">
                <Phone className="h-3 w-3" />
                <span>{phoneNumber}</span>
              </div>
            </div>
            {isSessionActive() && (
              <Badge variant="secondary" className="bg-green-500 text-white border-0">
                Session Active
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Chat Area */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 bg-[#e5ddd5] dark:bg-slate-800"
        >
          <div className="p-4 space-y-3 min-h-full">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Starting conversation...
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-[#dcf8c6] dark:bg-green-700 text-foreground'
                        : 'bg-white dark:bg-slate-700 text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message_content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {msg.sent_at || msg.created_at
                          ? format(new Date(msg.sent_at || msg.created_at!), "HH:mm")
                          : ""}
                      </span>
                      {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Sending indicator */}
            {sending && (
              <div className="flex justify-end">
                <div className="bg-[#dcf8c6] dark:bg-green-700 rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Sending...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder={
                isSessionActive()
                  ? "Type a message..."
                  : "Session expired - waiting for reply"
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendFollowUpMessage();
                }
              }}
              disabled={!isSessionActive() || sending}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={sendFollowUpMessage}
              disabled={!newMessage.trim() || !isSessionActive() || sending}
              className="bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!isSessionActive() && messages.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Free-form messages can only be sent within 24 hours of receiving a reply
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

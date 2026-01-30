import { useState, useEffect, useRef, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Phone, 
  PhoneOff,
  PhoneCall,
  PhoneMissed,
  Loader2,
  Clock,
  Play,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useQuery } from "@tanstack/react-query";
import { CallRecordingPlayer } from "@/components/Contact/CallRecordingPlayer";

interface CallLog {
  id: string;
  exotel_call_sid: string;
  call_type: string;
  direction: string;
  from_number: string;
  to_number: string;
  status: string;
  call_duration: number | null;
  recording_url: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  disposition_id: string | null;
  sub_disposition_id: string | null;
  agent_id: string | null;
  agent?: {
    first_name: string;
    last_name: string | null;
  };
  call_disposition?: {
    name: string;
  };
  call_sub_disposition?: {
    name: string;
  };
}

interface CallChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantId: string;
  applicationId: string;
  applicantName: string;
  phoneNumber: string;
}

export function CallChatDialog({
  open,
  onOpenChange,
  applicantId,
  applicationId,
  applicantName,
  phoneNumber,
}: CallChatDialogProps) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [activeCallStatus, setActiveCallStatus] = useState<string | null>(null);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [showDispositionForm, setShowDispositionForm] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [selectedSubDisposition, setSelectedSubDisposition] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [savingDisposition, setSavingDisposition] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { orgId } = useOrgContext();

  // Format phone number
  const formatPhoneForQuery = (phone: string) => {
    let digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }
    return '+' + digits;
  };
  
  const formattedPhone = formatPhoneForQuery(phoneNumber);

  // Fetch user profile for calling
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-calling"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("profiles")
        .select("calling_enabled, phone, first_name, last_name")
        .eq("id", user.id)
        .single();
      
      return data;
    },
    enabled: open,
  });

  // Fetch call dispositions
  const { data: dispositions = [] } = useQuery({
    queryKey: ["call-dispositions", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("call_dispositions")
        .select("id, name, category")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!orgId && open,
  });

  // Fetch sub-dispositions based on selected disposition
  const { data: subDispositions = [] } = useQuery({
    queryKey: ["call-sub-dispositions", selectedDisposition],
    queryFn: async () => {
      const { data } = await supabase
        .from("call_sub_dispositions")
        .select("id, name")
        .eq("disposition_id", selectedDisposition)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!selectedDisposition,
  });

  // Check if Exotel is configured
  const { data: exotelConfigured } = useQuery({
    queryKey: ["exotel-configured", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("exotel_settings")
        .select("id")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!orgId && open,
  });

  // Fetch call history
  const fetchCallLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          id, exotel_call_sid, call_type, direction, from_number, to_number, 
          status, call_duration, recording_url, notes, started_at, ended_at, created_at,
          disposition_id, sub_disposition_id, agent_id,
          agent:profiles!call_logs_agent_id_fkey(first_name, last_name),
          call_disposition:call_dispositions!call_logs_disposition_id_fkey(name),
          call_sub_disposition:call_sub_dispositions!call_logs_sub_disposition_id_fkey(name)
        `)
        .eq('org_id', orgId)
        .or(`to_number.eq.${formattedPhone},from_number.eq.${formattedPhone}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching call logs:', error);
        return;
      }

      setCallLogs(data || []);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, formattedPhone]);

  // Make a call
  const initiateCall = async () => {
    if (!userProfile?.phone || calling) return;

    setCalling(true);
    setActiveCallStatus('initiating');

    try {
      const { data, error } = await supabase.functions.invoke('exotel-make-call', {
        body: {
          customerPhoneNumber: formattedPhone,
          agentPhoneNumber: userProfile.phone,
          loanApplicationId: applicationId,
          applicantId: applicantId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to initiate call');
      }

      setActiveCallSid(data.exotelCallSid);
      toast({
        title: "Call initiated",
        description: "Your phone will ring shortly",
      });

      // Start timer after a brief delay
      setTimeout(() => {
        setActiveCallStatus('ringing');
      }, 2000);

    } catch (error) {
      console.error('Error initiating call:', error);
      toast({
        title: "Failed to call",
        description: error instanceof Error ? error.message : "Could not initiate call",
        variant: "destructive",
      });
      setCalling(false);
      setActiveCallStatus(null);
    }
  };

  // Subscribe to call session updates
  useEffect(() => {
    if (!open || !activeCallSid) return;

    const channel = supabase
      .channel(`call-session-${activeCallSid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_call_sessions',
          filter: `exotel_call_sid=eq.${activeCallSid}`,
        },
        (payload) => {
          console.log('[Realtime] Call session update:', payload);
          const session = payload.new as any;
          setActiveCallStatus(session.status);

          if (session.status === 'connected') {
            // Start call timer
            timerRef.current = setInterval(() => {
              setCallTimer(prev => prev + 1);
            }, 1000);
          }

          if (session.status === 'ended') {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            setCalling(false);
            setShowDispositionForm(true);
            fetchCallLogs();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [open, activeCallSid, fetchCallLogs]);

  // Initial load
  useEffect(() => {
    if (open) {
      fetchCallLogs();
      setActiveCallStatus(null);
      setActiveCallSid(null);
      setCallTimer(0);
      setShowDispositionForm(false);
    }
  }, [open, fetchCallLogs]);

  // Save disposition
  const saveDisposition = async () => {
    if (!activeCallSid || savingDisposition) return;

    setSavingDisposition(true);
    try {
      const { error } = await supabase
        .from('call_logs')
        .update({
          disposition_id: selectedDisposition || null,
          sub_disposition_id: selectedSubDisposition || null,
          notes: callNotes || null,
        })
        .eq('exotel_call_sid', activeCallSid);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Call disposition saved successfully",
      });

      setShowDispositionForm(false);
      setSelectedDisposition("");
      setSelectedSubDisposition("");
      setCallNotes("");
      setActiveCallSid(null);
      fetchCallLogs();

    } catch (error) {
      console.error('Error saving disposition:', error);
      toast({
        title: "Error",
        description: "Failed to save disposition",
        variant: "destructive",
      });
    } finally {
      setSavingDisposition(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'busy':
      case 'no-answer':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">No Answer</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const initials = applicantName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const canCall = userProfile?.calling_enabled && userProfile?.phone && exotelConfigured;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-emerald-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/30">
              <AvatarFallback className="bg-emerald-700 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-white font-semibold">
                {applicantName}
              </DialogTitle>
              <div className="flex items-center gap-1 text-emerald-100 text-sm">
                <Phone className="h-3 w-3" />
                <span>{phoneNumber}</span>
              </div>
            </div>
            {activeCallStatus && (
              <Badge variant="secondary" className="bg-emerald-500 text-white border-0 animate-pulse">
                {activeCallStatus === 'connected' ? `Connected ${formatDuration(callTimer)}` : activeCallStatus}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Active Call or Disposition Panel */}
        {(calling || showDispositionForm) && (
          <div className="p-4 border-b bg-muted/50">
            {calling && (
              <div className="flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full ${
                  activeCallStatus === 'connected' 
                    ? 'bg-green-100 dark:bg-green-900' 
                    : 'bg-emerald-100 dark:bg-emerald-900'
                }`}>
                  {activeCallStatus === 'connected' ? (
                    <PhoneCall className="h-8 w-8 text-green-600 animate-pulse" />
                  ) : activeCallStatus === 'ringing' ? (
                    <Phone className="h-8 w-8 text-emerald-600 animate-bounce" />
                  ) : (
                    <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-medium">
                    {activeCallStatus === 'connected' 
                      ? formatDuration(callTimer)
                      : activeCallStatus === 'ringing'
                      ? 'Ringing...'
                      : 'Connecting...'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activeCallStatus === 'connected' 
                      ? 'Call in progress'
                      : 'Your phone will ring first'}
                  </p>
                </div>
              </div>
            )}

            {showDispositionForm && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-medium">Call ended - Add disposition</p>
                </div>
                
                <div>
                  <Label className="text-xs">Disposition</Label>
                  <Select value={selectedDisposition} onValueChange={setSelectedDisposition}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select disposition" />
                    </SelectTrigger>
                    <SelectContent>
                      {dispositions.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subDispositions.length > 0 && (
                  <div>
                    <Label className="text-xs">Sub-disposition</Label>
                    <Select value={selectedSubDisposition} onValueChange={setSelectedSubDisposition}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select sub-disposition" />
                      </SelectTrigger>
                      <SelectContent>
                        {subDispositions.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    placeholder="Add call notes..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setShowDispositionForm(false);
                      setActiveCallSid(null);
                    }}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={saveDisposition}
                    disabled={savingDisposition}
                  >
                    {savingDisposition && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Call History */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 bg-slate-50 dark:bg-slate-800">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : callLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
                <Phone className="h-10 w-10 mb-2 opacity-50" />
                <p>No call history with {applicantName}</p>
              </div>
            ) : (
              callLogs.map((call) => (
                <div
                  key={call.id}
                  className="bg-white dark:bg-slate-700 rounded-lg p-3 shadow-sm border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {call.status === 'completed' ? (
                        <PhoneCall className="h-4 w-4 text-green-500" />
                      ) : call.status === 'busy' || call.status === 'no-answer' ? (
                        <PhoneMissed className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <PhoneOff className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {call.direction === 'outgoing-api' ? 'Outgoing' : 'Incoming'} Call
                        </p>
                        {call.agent && (
                          <p className="text-xs text-muted-foreground">
                            By {call.agent.first_name} {call.agent.last_name || ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(call.status)}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {call.started_at ? format(new Date(call.started_at), "MMM d, HH:mm") : 'N/A'}
                    </span>
                    {call.call_duration && (
                      <span>Duration: {formatDuration(call.call_duration)}</span>
                    )}
                  </div>

                  {call.call_disposition && (
                    <div className="mt-2 text-xs">
                      <Badge variant="outline" className="text-xs">
                        {call.call_disposition.name}
                        {call.call_sub_disposition && ` - ${call.call_sub_disposition.name}`}
                      </Badge>
                    </div>
                  )}

                  {call.notes && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      "{call.notes}"
                    </p>
                  )}

                  {call.recording_url && (
                    <div className="mt-2">
                      <CallRecordingPlayer callLogId={call.id} variant="outline" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Call Button */}
        <div className="p-3 border-t bg-background">
          {!canCall ? (
            <div className="text-center">
              {!exotelConfigured && (
                <p className="text-sm text-muted-foreground mb-2">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Calling not configured for this organization
                </p>
              )}
              {!userProfile?.calling_enabled && (
                <p className="text-sm text-muted-foreground mb-2">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Calling not enabled for your account
                </p>
              )}
              {!userProfile?.phone && (
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Add your phone number in profile settings
                </p>
              )}
            </div>
          ) : (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={initiateCall}
              disabled={calling}
            >
              {calling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {activeCallStatus || 'Connecting...'}
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Call {applicantName}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

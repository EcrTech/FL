import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Clock, TrendingUp, Users, PhoneCall, CheckCircle, XCircle, Activity, Search, Download, User, Calendar, FileText } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { LoadingState } from "@/components/common/LoadingState";

interface AgentStats {
  agent_id: string;
  agent_name: string;
  total_calls: number;
  total_duration: number;
  positive_calls: number;
  negative_calls: number;
  conversion_rate: number;
  avg_call_duration: number;
}

interface DispositionStats {
  disposition_name: string;
  count: number;
  category: string;
}

interface DashboardStats {
  total_calls: number;
  total_duration: number;
  avg_duration: number;
  total_agents: number;
  positive_rate: number;
}

interface UserType {
  id: string;
  first_name: string;
  last_name: string;
}

interface CallLog {
  id: string;
  contact_id: string | null;
  agent_id: string | null;
  exotel_call_sid: string;
  call_type: string;
  from_number: string;
  to_number: string;
  status: string;
  call_duration: number | null;
  conversation_duration: number | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  disposition_id: string | null;
  contacts?: {
    first_name: string;
    last_name: string | null;
  };
  call_dispositions?: {
    name: string;
    category: string;
  };
}

export default function CallingDashboard() {
  const { orgId, isLoading: orgLoading } = useOrgContext();
  const [timeRange, setTimeRange] = useState("7");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const notify = useNotification();

  // Fetch users using React Query
  const { data: users = [] } = useQuery({
    queryKey: ['dashboard-users', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("org_id", orgId!)
        .order("first_name");

      if (error) throw error;
      return (data || []) as UserType[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch team members when user selection changes
  useEffect(() => {
    if (selectedUser !== "all" && orgId) {
      fetchTeamMembers(selectedUser);
    } else {
      setTeamMemberIds([]);
    }
  }, [selectedUser, orgId]);

  const fetchTeamMembers = async (userId: string) => {
    try {
      const { data: managedTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("manager_id", userId);

      if (managedTeams && managedTeams.length > 0) {
        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("user_id")
          .in("team_id", managedTeams.map(t => t.id));

        if (teamMembers) {
          const memberIds = teamMembers.map(tm => tm.user_id);
          setTeamMemberIds([userId, ...memberIds]);
          return;
        }
      }
      setTeamMemberIds([userId]);
    } catch (error: any) {
      notify.error("Error loading team", error);
      setTeamMemberIds([userId]);
    }
  };

  // Fetch active calls count
  const { data: activeCallsCount = 0 } = useQuery({
    queryKey: ['active-calls', orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("agent_call_sessions")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .in("status", ["initiating", "ringing", "connected"]);

      return count || 0;
    },
    enabled: !!orgId,
    refetchInterval: 20000,
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['calling-dashboard', orgId, timeRange, selectedUser, teamMemberIds],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));

      let callLogsQuery = supabase
        .from("call_logs")
        .select(`
          *,
          profiles!call_logs_agent_id_fkey(id, first_name, last_name),
          call_dispositions(name, category)
        `)
        .eq("org_id", orgId!)
        .gte("created_at", daysAgo.toISOString())
        .not("conversation_duration", "is", null);

      if (selectedUser !== "all" && teamMemberIds.length > 0) {
        callLogsQuery = callLogsQuery.in("agent_id", teamMemberIds);
      }

      const { data: callLogs, error } = await callLogsQuery;
      if (error) throw error;

      const activities = callLogs?.map(log => ({
        ...log,
        created_by: log.agent_id,
        call_duration: log.conversation_duration,
      })) || [];

      // Calculate overall stats
      const totalCalls = activities?.length || 0;
      const totalDuration = activities?.reduce((sum, a) => sum + (a.call_duration || 0), 0) || 0;
      const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
      
      const uniqueAgents = new Set(activities?.map(a => a.created_by).filter(Boolean));
      const totalAgents = uniqueAgents.size;

      const positiveCallsCount = activities?.filter(a => 
        a.call_dispositions?.category === "positive"
      ).length || 0;
      const positiveRate = totalCalls > 0 ? Math.round((positiveCallsCount / totalCalls) * 100) : 0;

      const stats: DashboardStats = {
        total_calls: totalCalls,
        total_duration: totalDuration,
        avg_duration: avgDuration,
        total_agents: totalAgents,
        positive_rate: positiveRate,
      };

      // Calculate agent statistics
      const agentMap = new Map<string, AgentStats>();
      
      activities?.forEach((activity: any) => {
        if (!activity.created_by || !activity.profiles) return;
        
        const agentId = activity.created_by;
        const agentName = `${activity.profiles.first_name} ${activity.profiles.last_name}`;
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agent_id: agentId,
            agent_name: agentName,
            total_calls: 0,
            total_duration: 0,
            positive_calls: 0,
            negative_calls: 0,
            conversion_rate: 0,
            avg_call_duration: 0,
          });
        }
        
        const agentStats = agentMap.get(agentId)!;
        agentStats.total_calls++;
        agentStats.total_duration += activity.call_duration || 0;
        
        if (activity.call_dispositions?.category === "positive") {
          agentStats.positive_calls++;
        } else if (activity.call_dispositions?.category === "negative") {
          agentStats.negative_calls++;
        }
      });

      const agentStatsArray = Array.from(agentMap.values()).map(agentStats => ({
        ...agentStats,
        avg_call_duration: agentStats.total_calls > 0 
          ? Math.round(agentStats.total_duration / agentStats.total_calls) 
          : 0,
        conversion_rate: agentStats.total_calls > 0 
          ? Math.round((agentStats.positive_calls / agentStats.total_calls) * 100) 
          : 0,
      }));

      agentStatsArray.sort((a, b) => b.total_calls - a.total_calls);

      // Calculate disposition statistics
      const dispositionMap = new Map<string, DispositionStats>();
      
      activities?.forEach((activity: any) => {
        if (!activity.call_dispositions) return;
        
        const dispositionName = activity.call_dispositions.name;
        const category = activity.call_dispositions.category;
        
        if (!dispositionMap.has(dispositionName)) {
          dispositionMap.set(dispositionName, {
            disposition_name: dispositionName,
            count: 0,
            category: category || "neutral",
          });
        }
        
        dispositionMap.get(dispositionName)!.count++;
      });

      const dispositionStatsArray = Array.from(dispositionMap.values());
      dispositionStatsArray.sort((a, b) => b.count - a.count);

      return {
        stats,
        agentStats: agentStatsArray,
        dispositionStats: dispositionStatsArray,
      };
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
    refetchInterval: 20000,
  });

  // Fetch call logs for the logs tab
  const { data: callLogs = [] } = useQuery({
    queryKey: ['dashboard-call-logs', orgId, timeRange, callTypeFilter, selectedUser, teamMemberIds],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));

      let query = supabase
        .from('call_logs')
        .select(`
          *,
          contacts (first_name, last_name),
          call_dispositions (name, category)
        `)
        .eq('org_id', orgId!)
        .gte('created_at', daysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (callTypeFilter !== 'all') {
        query = query.eq('call_type', callTypeFilter);
      }

      if (selectedUser !== "all" && teamMemberIds.length > 0) {
        query = query.in("agent_id", teamMemberIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CallLog[];
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
    refetchInterval: 20000,
  });

  const loading = orgLoading || dashboardLoading;
  const dashboardStats = dashboardData?.stats || {
    total_calls: 0,
    total_duration: 0,
    avg_duration: 0,
    total_agents: 0,
    positive_rate: 0,
  };
  const agentStats = dashboardData?.agentStats || [];
  const dispositionStats = dashboardData?.dispositionStats || [];

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "positive":
        return "default";
      case "negative":
        return "destructive";
      case "follow_up":
        return "secondary";
      default:
        return "outline";
    }
  };

  const exportCallLogs = () => {
    notify.info("Export initiated", "Call logs export will be available once API is integrated");
  };

  const filteredLogs = callLogs.filter((log) => {
    const contactName = log.contacts 
      ? `${log.contacts.first_name} ${log.contacts.last_name || ''}`.toLowerCase()
      : '';

    const matchesSearch =
      contactName.includes(searchQuery.toLowerCase()) ||
      log.from_number.includes(searchQuery) ||
      log.to_number.includes(searchQuery);

    return matchesSearch;
  });

  if (orgLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading dashboard..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Calling Dashboard</h1>
            <p className="text-muted-foreground">Monitor real-time call performance and detailed logs</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 Hours</SelectItem>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="h-4 w-4 mr-2" />
              Call Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
              <Activity className="h-4 w-4 text-green-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCallsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.total_calls}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(dashboardStats.avg_duration)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.positive_rate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.total_agents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(dashboardStats.total_duration)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Agent Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>Individual agent statistics and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : agentStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No call data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-center">Calls</TableHead>
                        <TableHead className="text-center">Avg Duration</TableHead>
                        <TableHead className="text-center">Success Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentStats.map((agent) => (
                        <TableRow key={agent.agent_id}>
                          <TableCell className="font-medium">{agent.agent_name}</TableCell>
                          <TableCell className="text-center">{agent.total_calls}</TableCell>
                          <TableCell className="text-center">{formatDuration(agent.avg_call_duration)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={agent.conversion_rate >= 50 ? "default" : "secondary"}>
                              {agent.conversion_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Dispositions */}
          <Card>
            <CardHeader>
              <CardTitle>Call Dispositions</CardTitle>
              <CardDescription>Breakdown of call outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : dispositionStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No disposition data available</p>
              ) : (
                <div className="space-y-3">
                  {dispositionStats.map((disposition) => (
                    <div key={disposition.disposition_name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {disposition.category === "positive" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {disposition.category === "negative" && <XCircle className="h-4 w-4 text-red-500" />}
                        {disposition.category !== "positive" && disposition.category !== "negative" && (
                          <Phone className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{disposition.disposition_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{disposition.count} calls</span>
                        <Badge variant={getCategoryColor(disposition.category)}>
                          {disposition.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Search and filter call logs</CardDescription>
                  </div>
                  <Button onClick={exportCallLogs}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Logs
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={callTypeFilter} onValueChange={setCallTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Call Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Call Types</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Call Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Call Records</CardTitle>
                <CardDescription>
                  {filteredLogs.length} call{filteredLogs.length !== 1 ? "s" : ""} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading call logs...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Phone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No call logs found</h3>
                    <p className="text-muted-foreground mb-4">
                      {callLogs.length === 0
                        ? "Call logs will appear here once you make calls"
                        : "Try adjusting your filters"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Date & Time
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Contact
                            </div>
                          </TableHead>
                          <TableHead>Phone Number</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Duration
                            </div>
                          </TableHead>
                          <TableHead>Disposition</TableHead>
                          <TableHead>Recording</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="text-sm">
                                {log.started_at && format(new Date(log.started_at), "MMM d, yyyy")}
                                <div className="text-xs text-muted-foreground">
                                  {log.started_at && format(new Date(log.started_at), "h:mm a")}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {log.contacts ? `${log.contacts.first_name} ${log.contacts.last_name || ''}` : 'Unknown'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.call_type === 'outbound' ? log.to_number : log.from_number}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  log.call_type === "inbound"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {log.call_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {log.conversation_duration ? formatDuration(log.conversation_duration) : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {log.call_dispositions ? (
                                <Badge variant="outline">{log.call_dispositions.name}</Badge>
                              ) : (
                                <Badge variant="outline" className="opacity-50">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.recording_url ? (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const { data, error } = await supabase.functions.invoke('exotel-get-recording', {
                                        body: { callLogId: log.id }
                                      });
                                      if (error) throw error;
                                      notify.success("Recording loaded", "Playing recording...");
                                    } catch (error: any) {
                                      notify.error("Error", new Error("Failed to load recording"));
                                    }
                                  }}
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  N/A
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
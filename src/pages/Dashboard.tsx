import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Phone, Target, ArrowUpRight, ArrowDownRight, CheckSquare } from "lucide-react";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useOrgContext } from "@/hooks/useOrgContext";
import { LoadingState } from "@/components/common/LoadingState";
import { TaskList } from "@/components/Tasks/TaskList";
import { useTasks } from "@/hooks/useTasks";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalContacts: number;
  activeDeals: number;
  callsToday: number;
  conversionRate: number;
  newContactsThisWeek: number;
  dealsWonThisMonth: number;
  contactGrowth: number;
  dealGrowth: number;
}

interface PipelineData {
  stage: string;
  count: number;
  value: number;
}

interface ActivityData {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
}

const COLORS = ['#01B8AA', '#168980', '#8AD4EB', '#F2C80F', '#A66999', '#FE9666', '#FD625E'];

export default function Dashboard() {
  const { orgId, isLoading: orgLoading } = useOrgContext();
  const queryClient = useQueryClient();

  // Fetch optimized dashboard stats using database function
  const { data: rawStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["dashboard-stats", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      
      console.log('=== DASHBOARD QUERY START ===');
      console.log('[Dashboard] orgId:', orgId);
      console.log('[Dashboard] Calling get_dashboard_stats with p_org_id:', orgId);
      
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: orgId,
      });
      
      console.log('[Dashboard] RPC call completed');
      console.log('[Dashboard] Error:', error);
      console.log('[Dashboard] Data received:', JSON.stringify(data, null, 2));
      console.log('=== DASHBOARD QUERY END ===');
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 0, // Never use stale data - always refetch when org changes
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Fetch pipeline distribution
  const { data: pipelineRaw = [], isLoading: pipelineLoading, refetch: refetchPipeline } = useQuery({
    queryKey: ["pipeline-distribution", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_pipeline_distribution", {
        p_org_id: effectiveOrgId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveOrgId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch activity trends
  const { data: activityRaw = [], isLoading: activitiesLoading, refetch: refetchActivity } = useQuery({
    queryKey: ["activity-trends", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_activity_trends", {
        p_org_id: effectiveOrgId,
        p_days: 7,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveOrgId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch demo stats for this month
  const { data: demoStats } = useQuery({
    queryKey: ["demo-stats", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_demo_stats_this_month", {
        p_org_id: effectiveOrgId,
      });
      if (error) throw error;
      return data?.[0] || { demos_done: 0, demos_upcoming: 0 };
    },
    enabled: !!effectiveOrgId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Listen for org context changes and remove ALL cached queries
  useEffect(() => {
    const handleOrgChange = () => {
      console.log('[Dashboard] Org context change event received, removing all cached queries');
      // Remove ALL cached queries (not just invalidate) to prevent stale data
      queryClient.removeQueries({ queryKey: ["dashboard-stats"] });
      queryClient.removeQueries({ queryKey: ["pipeline-distribution"] });
      queryClient.removeQueries({ queryKey: ["activity-trends"] });
      queryClient.removeQueries({ queryKey: ["demo-stats"] });
    };

    window.addEventListener("orgContextChange", handleOrgChange);
    return () => window.removeEventListener("orgContextChange", handleOrgChange);
  }, [queryClient]);

  // Watch for effectiveOrgId changes and remove old queries
  useEffect(() => {
    if (effectiveOrgId) {
      console.log('[Dashboard] effectiveOrgId changed to:', effectiveOrgId);
      // Remove queries for other orgs to prevent stale data
      queryClient.removeQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            (queryKey[0] === 'dashboard-stats' || 
             queryKey[0] === 'pipeline-distribution' || 
             queryKey[0] === 'activity-trends') &&
            queryKey[1] !== effectiveOrgId
          );
        }
      });
    }
  }, [effectiveOrgId, queryClient]);

  // Fetch tasks for analytics
  const { data: tasksData } = useTasks({ filter: "assigned_to_me" });
  const allTasks = tasksData?.tasks || [];
  const pendingTasksCount = allTasks.filter(t => t.status === "pending").length;
  const inProgressTasksCount = allTasks.filter(t => t.status === "in_progress").length;
  const overdueTasksCount = allTasks.filter(t => t.isOverdue && t.status !== "completed").length;

  const loading = orgLoading || statsLoading || pipelineLoading || activitiesLoading;

  // Process stats from database function
  const stats: DashboardStats = useMemo(() => {
    if (!rawStats) {
      return {
        totalContacts: 0,
        activeDeals: 0,
        callsToday: 0,
        conversionRate: 0,
        newContactsThisWeek: 0,
        dealsWonThisMonth: 0,
        contactGrowth: 0,
        dealGrowth: 0,
      };
    }

    const {
      total_contacts,
      active_deals,
      calls_today,
      prev_month_contacts,
      conversion_rate,
    } = rawStats;

    // Calculate growth percentages
    const currentMonthContacts = total_contacts - prev_month_contacts;
    const contactGrowth =
      prev_month_contacts > 0
        ? Math.round(((currentMonthContacts - prev_month_contacts) / prev_month_contacts) * 100)
        : 0;

    return {
      totalContacts: total_contacts,
      activeDeals: active_deals,
      callsToday: calls_today,
      conversionRate: conversion_rate || 0,
      newContactsThisWeek: 0, // Placeholder
      dealsWonThisMonth: 0, // Placeholder
      contactGrowth,
      dealGrowth: 0, // Placeholder
    };
  }, [rawStats]);

  // Process pipeline data
  const pipelineData: PipelineData[] = useMemo(() => {
    if (!pipelineRaw || pipelineRaw.length === 0) return [];

    return pipelineRaw.map((item: any) => ({
      stage: item.stage_name,
      count: Number(item.contact_count),
      value: Number(item.contact_count),
    }));
  }, [pipelineRaw]);

  // Process activity data
  const activityData: ActivityData[] = useMemo(() => {
    if (!activityRaw || activityRaw.length === 0) return [];

    // Group by date
    const dateMap = new Map<string, { calls: number; emails: number; meetings: number }>();
    
    activityRaw.forEach((item: any) => {
      const date = new Date(item.activity_date).toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
      });
      
      if (!dateMap.has(date)) {
        dateMap.set(date, { calls: 0, emails: 0, meetings: 0 });
      }
      
      const counts = dateMap.get(date)!;
      if (item.activity_type === "call") counts.calls += Number(item.activity_count);
      else if (item.activity_type === "email") counts.emails += Number(item.activity_count);
      else if (item.activity_type === "meeting") counts.meetings += Number(item.activity_count);
    });

    return Array.from(dateMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }, [activityRaw]);

  if (!effectiveOrgId || loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading dashboard data..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time insights into your sales performance</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {stats.contactGrowth >= 0 ? (
                  <>
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">{stats.contactGrowth}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">{Math.abs(stats.contactGrowth)}%</span>
                  </>
                )}
                {' '}from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Demos This Month</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-green-600">{demoStats?.demos_done || 0}</span>
                {" / "}
                <span className="text-blue-600">{demoStats?.demos_upcoming || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Done / Upcoming demos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.callsToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.newContactsThisWeek} new contacts this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{`${stats.conversionRate}%`}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.dealsWonThisMonth} deals won this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Task Analytics Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingTasksCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Waiting to be started
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTasksCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently working on
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overdueTasksCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Need immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* My Tasks Section - Top 5 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Tasks</CardTitle>
                <CardDescription>Your 5 nearest tasks by due date</CardDescription>
              </div>
              <Link to="/tasks">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <TaskList filter="assigned_to_me" limit={5} showCreateButton={false} />
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Distribution</CardTitle>
              <CardDescription>Contacts across pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No pipeline data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pipelineData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ stage, percent }) => `${stage}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Trends</CardTitle>
              <CardDescription>Last 7 days activity breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {activityData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No activity data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="calls" stroke="#01B8AA" strokeWidth={2} />
                    <Line type="monotone" dataKey="emails" stroke="#168980" strokeWidth={2} />
                    <Line type="monotone" dataKey="meetings" stroke="#8AD4EB" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Performance</CardTitle>
            <CardDescription>Activities completed over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            {activityData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No activity data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="#01B8AA" />
                  <Bar dataKey="emails" fill="#168980" />
                  <Bar dataKey="meetings" fill="#8AD4EB" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

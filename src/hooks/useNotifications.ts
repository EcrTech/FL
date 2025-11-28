import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "./useRealtimeSync";
import { useOrgContext } from "./useOrgContext";
import { toast } from "./use-toast";

interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  metadata: any;
  created_at: string;
  expires_at: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { effectiveOrgId } = useOrgContext();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", effectiveOrgId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!effectiveOrgId,
  });

  // Count unread notifications
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications" as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications" as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Real-time subscription for new notifications
  useRealtimeSync({
    table: "notifications",
    onInsert: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      
      // Show toast for new notification
      const notification = payload.new;
      if (notification && !notification.is_read) {
        toast({
          title: notification.title,
          description: notification.message,
        });
      }
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    enabled: !!effectiveOrgId,
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the count of unread inbound WhatsApp messages for a given phone number.
 * Phone number is normalized to +91XXXXXXXXXX format.
 */
export function useUnreadWhatsApp(phoneNumber: string | undefined) {
  const formatPhone = (phone: string) => {
    let digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) digits = '91' + digits;
    return '+' + digits;
  };

  const formattedPhone = phoneNumber ? formatPhone(phoneNumber) : '';

  return useQuery({
    queryKey: ["unread-whatsapp", formattedPhone],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("phone_number", formattedPhone)
        .eq("direction", "inbound")
        .eq("is_read", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!formattedPhone,
    refetchInterval: 30000, // Poll every 30s for updates
  });
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OperatorNotification {
  id: string;
  event_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export function useOperatorNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OperatorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('operator_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const typed = data as unknown as OperatorNotification[];
        setNotifications(typed);
        setUnreadCount(typed.filter(n => !n.read).length);
      }
    } catch (err) {
      console.warn('[OpsNotifications] Fetch failed:', err);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('operator-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'operator_notifications',
        }, (payload) => {
          try {
            const newNotif = payload.new as unknown as OperatorNotification;
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
          } catch (e) {
            console.warn('[OpsNotifications] Realtime parse error:', e);
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('[OpsNotifications] Realtime subscription failed:', err);
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await supabase
        .from('operator_notifications')
        .update({ read: true })
        .eq('id', id);
    } catch {}
    
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await supabase
        .from('operator_notifications')
        .update({ read: true })
        .eq('read', false);
    } catch {}
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}

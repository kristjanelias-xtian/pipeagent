import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLogRow } from '@pipeagent/shared';

export function useRecentActivity(connectionId: string | null | undefined) {
  const [activities, setActivities] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    if (!connectionId) return;

    supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (data) setActivities(data as ActivityLogRow[]);
      });

    const channel = supabase
      .channel(`home-activity-${connectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          setActivities((prev) =>
            [payload.new as ActivityLogRow, ...prev].slice(0, 15),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connectionId]);

  return activities;
}

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { messageService } from '../services/messageService';

export function useUnreadMessagesCount(userId?: string) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      const unread = await messageService.getUnreadCount(userId);
      setCount(unread);
    } catch {
      setCount(0);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [refresh]),
  );

  return {
    unreadCount: count,
    refresh,
  };
}

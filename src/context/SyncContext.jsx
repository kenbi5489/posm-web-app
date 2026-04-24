import React, { createContext, useContext, useRef } from 'react';
import { useSync } from '../hooks/useSync';
import { useAuth } from './AuthContext';

const SyncContext = createContext(null);

/**
 * SyncProvider wraps the ENTIRE app (inside AuthProvider) so useSync() is
 * instantiated EXACTLY ONCE.  All components that previously called
 * useSync(user) directly were creating duplicate instances that raced against
 * the module-level `syncInProgress` flag, causing the lock to never release
 * and the app to freeze on first load.
 */
export const SyncProvider = ({ children }) => {
  const { user } = useAuth();
  const sync = useSync(user);
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
};

export const useSyncContext = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider');
  return ctx;
};

import { create } from 'zustand';

interface NotificationState {
  liveAlertCount: number;
  incrementAlerts: () => void;
  resetAlerts: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  liveAlertCount: 0,
  incrementAlerts: () =>
    set((state) => ({
      liveAlertCount: state.liveAlertCount + 1,
    })),
  resetAlerts: () => set({ liveAlertCount: 0 }),
}));

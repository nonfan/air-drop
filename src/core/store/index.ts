import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Device } from '../types/device';
import { Transfer } from '../services/transfer/TransferManager';
import { Settings, HistoryItem } from '../types/common';

interface AppState {
  // Device state
  devices: Device[];
  currentDevice: Device | null;
  
  // Transfer state
  transfers: Transfer[];
  
  // History
  history: HistoryItem[];
  
  // Settings
  settings: Settings;
  
  // UI state
  ui: {
    isConnected: boolean;
    isTransferring: boolean;
    selectedView: 'transfer' | 'history' | 'settings';
  };
  
  // Device Actions
  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  setCurrentDevice: (device: Device | null) => void;
  updateDevice: (deviceId: string, updates: Partial<Device>) => void;
  
  // Transfer Actions
  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (id: string, updates: Partial<Transfer>) => void;
  removeTransfer: (id: string) => void;
  clearCompletedTransfers: () => void;
  
  // History Actions
  addHistoryItem: (item: HistoryItem) => void;
  clearHistory: () => void;
  
  // Settings Actions
  updateSettings: (settings: Partial<Settings>) => void;
  
  // UI Actions
  setConnected: (connected: boolean) => void;
  setTransferring: (transferring: boolean) => void;
  setSelectedView: (view: 'transfer' | 'history' | 'settings') => void;
}


export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        devices: [],
        currentDevice: null,
        transfers: [],
        history: [],
        settings: {
          deviceName: 'My Device',
          downloadPath: '',
          autoAccept: false,
          showNotifications: true,
          theme: 'system',
          autoLaunch: false
        },
        ui: {
          isConnected: false,
          isTransferring: false,
          selectedView: 'transfer'
        },
        
        // Device Actions
        addDevice: (device) => set((state) => {
          const exists = state.devices.find(d => d.id === device.id);
          if (exists) {
            return {
              devices: state.devices.map(d => d.id === device.id ? device : d)
            };
          }
          return {
            devices: [...state.devices, device]
          };
        }),
        
        removeDevice: (deviceId) => set((state) => ({
          devices: state.devices.filter(d => d.id !== deviceId),
          currentDevice: state.currentDevice?.id === deviceId ? null : state.currentDevice
        })),
        
        setCurrentDevice: (device) => set({ currentDevice: device }),
        
        updateDevice: (deviceId, updates) => set((state) => ({
          devices: state.devices.map(d => 
            d.id === deviceId ? { ...d, ...updates } : d
          )
        })),
        
        // Transfer Actions
        addTransfer: (transfer) => set((state) => ({
          transfers: [...state.transfers, transfer]
        })),
        
        updateTransfer: (id, updates) => set((state) => ({
          transfers: state.transfers.map(t => 
            t.id === id ? { ...t, ...updates } : t
          )
        })),
        
        removeTransfer: (id) => set((state) => ({
          transfers: state.transfers.filter(t => t.id !== id)
        })),
        
        clearCompletedTransfers: () => set((state) => ({
          transfers: state.transfers.filter(t => 
            t.status !== 'completed' && t.status !== 'failed'
          )
        })),
        
        // History Actions
        addHistoryItem: (item) => set((state) => ({
          history: [item, ...state.history]
        })),
        
        clearHistory: () => set({ history: [] }),
        
        // Settings Actions
        updateSettings: (settings) => set((state) => ({
          settings: { ...state.settings, ...settings }
        })),
        
        // UI Actions
        setConnected: (connected) => set((state) => ({
          ui: { ...state.ui, isConnected: connected }
        })),
        
        setTransferring: (transferring) => set((state) => ({
          ui: { ...state.ui, isTransferring: transferring }
        })),
        
        setSelectedView: (view) => set((state) => ({
          ui: { ...state.ui, selectedView: view }
        }))
      }),
      {
        name: 'airdrop-storage',
        partialize: (state) => ({
          settings: state.settings,
          history: state.history
        })
      }
    )
  )
);

import { create } from "zustand";
import { nextRetryDecision } from "@/lib/bluetooth/reconnect-engine";
import type { BluetoothDevice, DeviceMap, RetryState } from "@/lib/bluetooth/types";

type DeviceStore = {
  bluetoothOn: boolean;
  devicesById: DeviceMap;
  nearbyIds: string[];
  connectedIds: string[];
  retryStateById: Record<string, RetryState>;
  setBluetoothOn: (value: boolean) => void;
  upsertNearbyDevice: (payload: { id: string; name: string; rssi?: number | null }) => void;
  upsertConnectedDevice: (payload: { id: string; name: string; rssi?: number | null }) => void;
  setDeviceState: (id: string, state: BluetoothDevice["state"], lastError?: string) => void;
  setBattery: (id: string, battery?: number) => void;
  toggleFavorite: (id: string) => void;
  queueReconnect: (id: string) => RetryState;
  resetReconnect: (id: string) => void;
};

function mergeConnectedIds(devicesById: DeviceMap): string[] {
  return Object.values(devicesById)
    .filter((device) => device.state === "connected")
    .map((device) => device.id);
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  bluetoothOn: true,
  devicesById: {},
  nearbyIds: [],
  connectedIds: [],
  retryStateById: {},

  setBluetoothOn: (value) => set({ bluetoothOn: value }),

  upsertNearbyDevice: ({ id, name, rssi }) => {
    const existing = get().devicesById[id];
    const nextDevice: BluetoothDevice = existing
      ? { ...existing, name, rssi: rssi ?? existing.rssi, lastSeenAt: Date.now() }
      : {
          id,
          name,
          rssi: rssi ?? undefined,
          battery: undefined,
          state: "discovering",
          isFavorite: false,
          lastSeenAt: Date.now(),
        };

    const nextDevices = { ...get().devicesById, [id]: nextDevice };
    const nextNearby = get().nearbyIds.includes(id) ? get().nearbyIds : [...get().nearbyIds, id];
    set({
      devicesById: nextDevices,
      nearbyIds: nextNearby,
      connectedIds: mergeConnectedIds(nextDevices),
    });
  },

  upsertConnectedDevice: ({ id, name, rssi }) => {
    const existing = get().devicesById[id];
    const nextDevice: BluetoothDevice = existing
      ? {
          ...existing,
          name,
          rssi: rssi ?? existing.rssi,
          state: "connected",
          lastSeenAt: Date.now(),
          lastError: undefined,
        }
      : {
          id,
          name,
          rssi: rssi ?? undefined,
          battery: undefined,
          state: "connected",
          isFavorite: false,
          lastSeenAt: Date.now(),
        };

    const nextDevices = { ...get().devicesById, [id]: nextDevice };
    const nextNearby = get().nearbyIds.includes(id) ? get().nearbyIds : [...get().nearbyIds, id];
    set({
      devicesById: nextDevices,
      nearbyIds: nextNearby,
      connectedIds: mergeConnectedIds(nextDevices),
    });
  },

  setDeviceState: (id, state, lastError) => {
    const existing = get().devicesById[id];
    if (!existing) return;

    const nextDevices = {
      ...get().devicesById,
      [id]: {
        ...existing,
        state,
        lastError,
      },
    };

    set({ devicesById: nextDevices, connectedIds: mergeConnectedIds(nextDevices) });
  },

  setBattery: (id, battery) => {
    const existing = get().devicesById[id];
    if (!existing) return;

    set({
      devicesById: {
        ...get().devicesById,
        [id]: {
          ...existing,
          battery,
        },
      },
    });
  },

  toggleFavorite: (id) => {
    const existing = get().devicesById[id];
    if (!existing) return;

    set({
      devicesById: {
        ...get().devicesById,
        [id]: {
          ...existing,
          isFavorite: !existing.isFavorite,
        },
      },
    });
  },

  queueReconnect: (id) => {
    const current = get().retryStateById[id]?.attempts ?? 0;
    const decision = nextRetryDecision(current);

    const nextRetry: RetryState = {
      attempts: decision.attempts,
      nextRetryInMs: decision.nextRetryInMs,
    };

    set({
      retryStateById: {
        ...get().retryStateById,
        [id]: nextRetry,
      },
    });

    return nextRetry;
  },

  resetReconnect: (id) => {
    const next = { ...get().retryStateById };
    delete next[id];
    set({ retryStateById: next });
  },
}));

export function useDeviceSelectors() {
  const devicesById = useDeviceStore((state) => state.devicesById);
  const connectedIds = useDeviceStore((state) => state.connectedIds);

  const connectedDevices = connectedIds
    .map((id) => devicesById[id])
    .filter((device): device is BluetoothDevice => Boolean(device));

  const averageBattery = connectedDevices.length
    ? Math.round(
        connectedDevices.reduce((sum, device) => sum + (device.battery ?? 0), 0) / connectedDevices.length,
      )
    : 0;

  const lowBatteryDevices = connectedDevices.filter(
    (device) => typeof device.battery === "number" && device.battery < 25,
  );

  const unstableDevices = Object.values(devicesById).filter((device) => device.state === "reconnecting");

  return { connectedDevices, averageBattery, lowBatteryDevices, unstableDevices };
}


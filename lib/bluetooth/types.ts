export type DeviceLifecycleState =
  | "discovering"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "disconnected";

export type BluetoothDevice = {
  id: string;
  name: string;
  rssi?: number;
  battery?: number;
  state: DeviceLifecycleState;
  isFavorite: boolean;
  lastSeenAt: number;
  lastError?: string;
};

export type RetryState = {
  attempts: number;
  nextRetryInMs: number;
};

export type DeviceMap = Record<string, BluetoothDevice>;


import { BleManager, Device } from "react-native-ble-plx";

export type DiscoveredDevice = {
  id: string;
  name: string;
  rssi?: number | null;
};

export type AdapterState =
  | "Unknown"
  | "Resetting"
  | "Unsupported"
  | "Unauthorized"
  | "PoweredOff"
  | "PoweredOn";

const commonServiceUuids = [
  "1800",
  "1801",
  "180A",
  "180F",
  "180D",
  "1812",
];

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (manager) return manager;

  try {
    manager = new BleManager();
    return manager;
  } catch {
    throw new Error(
      "BLE native module is unavailable. Use an Android development build, not Expo Go.",
    );
  }
}

export function startScan(onDevice: (device: DiscoveredDevice) => void): () => void {
  const bleManager = getManager();

  bleManager.startDeviceScan(null, null, (error, device) => {
    if (error || !device) {
      return;
    }

    onDevice({
      id: device.id,
      name: device.name ?? device.localName ?? "Unknown BLE Device",
      rssi: device.rssi,
    });
  });

  return () => bleManager.stopDeviceScan();
}

export async function connectToDevice(id: string): Promise<Device> {
  const bleManager = getManager();
  const connected = await bleManager.connectToDevice(id, { autoConnect: false });
  return connected.discoverAllServicesAndCharacteristics();
}

export async function disconnectFromDevice(id: string): Promise<void> {
  const bleManager = getManager();
  await bleManager.cancelDeviceConnection(id);
}

export async function listConnectedDevices(): Promise<DiscoveredDevice[]> {
  const bleManager = getManager();
  const allBySystem = await bleManager.connectedDevices([]);
  const commonOnly = await bleManager.connectedDevices(commonServiceUuids);
  const merged = [...allBySystem, ...commonOnly];
  const unique = merged.filter(
    (device, index, self) => self.findIndex((d) => d.id === device.id) === index,
  );

  return unique.map((device) => ({
    id: device.id,
    name: device.name ?? device.localName ?? "Connected BLE Device",
    rssi: device.rssi,
  }));
}

export async function getAdapterState(): Promise<AdapterState> {
  const bleManager = getManager();
  return (await bleManager.state()) as AdapterState;
}

export function monitorAdapterState(
  onChange: (state: AdapterState) => void,
): () => void {
  const bleManager = getManager();
  const sub = bleManager.onStateChange((state) => onChange(state as AdapterState), true);
  return () => sub.remove();
}

export function monitorUnexpectedDisconnect(
  id: string,
  onDisconnect: (errorMessage?: string) => void,
): () => void {
  const bleManager = getManager();
  const subscription = bleManager.onDeviceDisconnected(id, (error) => {
    onDisconnect(error?.message);
  });

  return () => subscription.remove();
}

import { BleManager, Device } from "react-native-ble-plx";

export type DiscoveredDevice = {
  id: string;
  name: string;
  rssi?: number | null;
};

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

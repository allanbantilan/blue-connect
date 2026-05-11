import { Platform } from "react-native";

type ClassicDeviceRaw = {
  id?: string;
  address?: string;
  name?: string;
  bonded?: boolean;
  connected?: boolean;
  deviceClass?: number;
};

export type ClassicPairedDevice = {
  id: string;
  name: string;
  connected: boolean;
};

function getClassicModule(): any {
  // Lazy require to avoid crash on unsupported runtimes.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require("react-native-bluetooth-classic");
  return module?.default ?? module;
}

export async function listPairedClassicDevices(): Promise<ClassicPairedDevice[]> {
  if (Platform.OS !== "android") {
    return [];
  }

  let classic: any;
  try {
    classic = getClassicModule();
  } catch {
    throw new Error("Classic Bluetooth module unavailable in this build.");
  }

  if (!classic?.getBondedDevices) {
    throw new Error("Classic Bluetooth API not available in this build.");
  }

  const bonded: ClassicDeviceRaw[] = await classic.getBondedDevices();
  const connectedList: ClassicDeviceRaw[] = classic.getConnectedDevices
    ? await classic.getConnectedDevices()
    : [];
  const connectedIds = new Set(
    connectedList.map((device) => device.address ?? device.id).filter(Boolean),
  );

  return bonded.map((device) => ({
    id: device.address ?? device.id ?? Math.random().toString(36).slice(2),
    name: device.name ?? "Paired Bluetooth Device",
    connected: Boolean(device.connected) || connectedIds.has(device.address ?? device.id),
  }));
}

export async function connectPairedClassicDevice(deviceId: string): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("Classic device connect is Android only.");
  }

  let classic: any;
  try {
    classic = getClassicModule();
  } catch {
    throw new Error("Classic Bluetooth module unavailable in this build.");
  }

  if (!classic?.connectToDevice) {
    throw new Error("Classic Bluetooth connect API is not available in this build.");
  }

  await classic.connectToDevice(deviceId);
}

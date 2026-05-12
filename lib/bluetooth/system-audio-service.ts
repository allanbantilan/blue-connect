import { NativeModules, Platform } from "react-native";

type NativeAudioOutput = {
  name?: string;
  address?: string;
  type?: number;
};

export type SystemAudioOutput = {
  id: string;
  name: string;
  address?: string;
};

type AudioModule = {
  getActiveBluetoothAudioOutputs: () => Promise<NativeAudioOutput[]>;
  getConnectedProfileDevices: () => Promise<
    { name?: string; address?: string; profile?: number }[]
  >;
  getBondedDeviceBatteryLevels: () => Promise<
    { name?: string; address?: string; battery?: number }[]
  >;
  pairDevice: (address: string) => Promise<boolean>;
};

function getAudioModule(): AudioModule | null {
  if (Platform.OS !== "android") return null;
  return NativeModules.SystemAudioDevices ?? null;
}

export function getSystemAudioDebugStatus() {
  const module = getAudioModule();
  return {
    modulePresent: Boolean(module),
    hasAudioOutputsMethod: Boolean(module?.getActiveBluetoothAudioOutputs),
    hasProfileMethod: Boolean(module?.getConnectedProfileDevices),
    hasBatteryMethod: Boolean(module?.getBondedDeviceBatteryLevels),
  };
}

export async function listActiveBluetoothAudioOutputs(): Promise<SystemAudioOutput[]> {
  const module = getAudioModule();
  if (!module?.getActiveBluetoothAudioOutputs) {
    return [];
  }

  const outputs = await module.getActiveBluetoothAudioOutputs();
  return outputs.map((output, index) => {
    const name = output.name?.trim() || "Bluetooth Audio Device";
    const address = output.address?.trim();
    return {
      id: address ? `audio:${address}` : `audio:${name}:${index}`,
      name,
      address,
    };
  });
}

export async function listConnectedProfileDevices(): Promise<SystemAudioOutput[]> {
  const module = getAudioModule();
  if (!module?.getConnectedProfileDevices) {
    return [];
  }

  const devices = await module.getConnectedProfileDevices();
  return devices.map((device, index) => {
    const name = device.name?.trim() || "Bluetooth Device";
    const address = device.address?.trim();
    return {
      id: address ? `profile:${address}` : `profile:${name}:${index}`,
      name,
      address,
    };
  });
}

export async function listBondedDeviceBatteryLevels(): Promise<
  { id: string; name: string; address?: string; battery?: number }[]
> {
  const module = getAudioModule();
  if (!module?.getBondedDeviceBatteryLevels) {
    return [];
  }

  const devices = await module.getBondedDeviceBatteryLevels();
  return devices.map((device, index) => {
    const name = device.name?.trim() || "Bluetooth Device";
    const address = device.address?.trim();
    return {
      id: address ? `battery:${address}` : `battery:${name}:${index}`,
      name,
      address,
      battery:
        typeof device.battery === "number" && device.battery >= 0 && device.battery <= 100
          ? device.battery
          : undefined,
    };
  });
}

export async function pairBluetoothDevice(address: string): Promise<boolean> {
  const module = getAudioModule();
  if (!module?.pairDevice) {
    throw new Error("Pair API is not available in this build.");
  }

  return Boolean(await module.pairDevice(address));
}

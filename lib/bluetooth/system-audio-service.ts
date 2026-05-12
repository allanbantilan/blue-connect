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
};

function getAudioModule(): AudioModule | null {
  if (Platform.OS !== "android") return null;
  return NativeModules.SystemAudioDevices ?? null;
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

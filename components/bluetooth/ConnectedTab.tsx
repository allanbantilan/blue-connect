import { Pressable, Text, View } from "react-native";

type ConnectedDevice = {
  id: string;
  name: string;
  state: string;
  battery?: number;
};

type ActiveSystemDevice = {
  id: string;
  name: string;
};

type RetryState = {
  attempts: number;
  nextRetryInMs: number;
};

type ConnectedTabProps = {
  connectedDevices: ConnectedDevice[];
  activeSystemDevices: ActiveSystemDevice[];
  lowBatteryCount: number;
  unstableCount: number;
  retryStateById: Record<string, RetryState>;
  onDisconnect: (id: string) => void;
  batteryText: (value?: number) => string;
  connectedAudioDeviceCount: number;
  onOpenAudioSharing: () => void;
  audioSharingSupportLabel: string;
};

export function ConnectedTab({
  connectedDevices,
  activeSystemDevices,
  lowBatteryCount,
  unstableCount,
  retryStateById,
  onDisconnect,
  batteryText,
  connectedAudioDeviceCount,
  onOpenAudioSharing,
  audioSharingSupportLabel,
}: ConnectedTabProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">Connected Smart Devices</Text>
        <Text className="text-xs font-semibold text-slate-300">
          Unstable: {unstableCount} | Low battery: {lowBatteryCount}
        </Text>
      </View>

      <View className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-3">
        <Text className="text-sm font-bold text-white">Audio Sharing</Text>
        <View className="mt-2 gap-1">
          <Text className="text-xs text-cyan-100">
            Devices: <Text className="font-semibold">{connectedAudioDeviceCount}</Text>
          </Text>
          <Text className="text-xs text-cyan-100">
            Support: <Text className="font-semibold">{audioSharingSupportLabel}</Text>
          </Text>
        </View>
        <Pressable
          onPress={onOpenAudioSharing}
          className="mt-2 self-start rounded-lg bg-cyan-300 px-2.5 py-1.5"
        >
          <Text className="text-[11px] font-bold text-slate-900">
            Open Audio Settings
          </Text>
        </Pressable>
      </View>

      {connectedDevices.length === 0 ? (
        <View className="rounded-2xl border border-white/15 bg-slate-900/50 p-4">
          <Text className="text-sm text-slate-200">No devices connected yet.</Text>
        </View>
      ) : null}

      <View className="gap-3">
        {connectedDevices.map((device) => (
          <View
            key={device.id}
            className="rounded-2xl border border-emerald-200/20 bg-emerald-300/10 p-3"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-sm font-bold text-white">{device.name}</Text>
                <Text className="mt-1 text-xs text-emerald-100">State: {device.state}</Text>
                <Text className="mt-1 text-xs text-emerald-100">
                  Battery: {batteryText(device.battery)}
                </Text>
                {retryStateById[device.id] ? (
                  <Text className="mt-1 text-xs text-amber-200">
                    Retry #{retryStateById[device.id].attempts} in {retryStateById[device.id].nextRetryInMs}ms
                  </Text>
                ) : null}
              </View>
              <View className="gap-2">
                <Pressable
                  onPress={() => onDisconnect(device.id)}
                  className="rounded-lg bg-white/20 px-2.5 py-1.5"
                >
                  <Text className="text-[11px] font-bold text-white">Disconnect</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {activeSystemDevices.map((device) => (
          <View
            key={`sys-${device.id}`}
            className="rounded-2xl border border-violet-200/20 bg-violet-300/10 p-3"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-sm font-bold text-white">{device.name}</Text>
                <Text className="mt-1 text-xs text-violet-100">State: connected</Text>
                <Text className="mt-1 text-xs text-violet-100">Battery: unavailable</Text>
              </View>
              <View className="rounded-full bg-white/20 px-2.5 py-1">
                <Text className="text-[11px] font-bold text-white">System</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

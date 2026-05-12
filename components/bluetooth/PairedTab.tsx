import { Pressable, Text, View } from "react-native";

type PairedDevice = {
  id: string;
  name: string;
  connected: boolean;
  battery?: number;
};

type PairedTabProps = {
  pairedDevices: PairedDevice[];
  onOpenSettings: () => void;
};

export function PairedTab({ pairedDevices, onOpenSettings }: PairedTabProps) {
  return (
    <>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">Paired Devices</Text>
        <Text className="text-xs font-semibold text-slate-300">{pairedDevices.length} paired</Text>
      </View>

      {pairedDevices.length === 0 ? (
        <View className="rounded-2xl border border-white/15 bg-slate-900/50 p-4">
          <Text className="text-sm text-slate-200">No paired classic devices found.</Text>
        </View>
      ) : null}

      <View className="gap-3">
        {pairedDevices.map((device) => (
          <View
            key={device.id}
            className="rounded-2xl border border-violet-200/20 bg-violet-300/10 p-3"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-sm font-bold text-white">{device.name}</Text>
                <Text className="mt-1 text-xs text-violet-100">
                  Status: {device.connected ? "Active" : "Inactive"}
                </Text>
                <Text className="mt-1 text-xs text-violet-100">
                  Battery:{" "}
                  {typeof device.battery === "number" ? `${device.battery}%` : "Unavailable"}
                </Text>
              </View>
              <View className="items-end gap-2">
                <View className="shrink-0 self-start rounded-full bg-white/20 px-2.5 py-1">
                  <Text className="text-[11px] font-bold text-white">
                    {device.connected ? "Active" : "Inactive"}
                  </Text>
                </View>
                {!device.connected ? (
                  <Pressable
                    onPress={onOpenSettings}
                    className="rounded-lg bg-cyan-300 px-2.5 py-1.5"
                  >
                    <Text className="text-[11px] font-bold text-slate-900">
                      Connect in Settings
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

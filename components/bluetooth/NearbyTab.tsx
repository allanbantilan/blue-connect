import { Pressable, Text, View } from "react-native";

type NearbyDevice = {
  id: string;
  name: string;
  rssi?: number;
  state: string;
  lastError?: string;
};

type NearbyTabProps = {
  nearbyDevices: NearbyDevice[];
  busyById: Record<string, boolean>;
  onScan: () => void;
  onConnectOrDisconnect: (id: string, canConnect: boolean) => void;
};

export function NearbyTab({
  nearbyDevices,
  busyById,
  onScan,
  onConnectOrDisconnect,
}: NearbyTabProps) {
  return (
    <>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">Nearby Devices</Text>
        <Pressable
          onPress={onScan}
          className="rounded-lg border border-cyan-200/30 px-3 py-2"
        >
          <Text className="text-xs font-bold text-cyan-100">Scan</Text>
        </Pressable>
      </View>

      <View className="gap-3">
        {nearbyDevices.map((device) => {
          const isBusy = busyById[device.id];
          const canConnect = device.state !== "connected";

          return (
            <View
              key={device.id}
              className="rounded-2xl border border-white/15 bg-white/10 p-3"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="text-sm font-bold text-white">{device.name}</Text>
                  <Text className="mt-1 text-xs text-slate-300">RSSI: {device.rssi ?? "n/a"}</Text>
                  <Text className="mt-1 text-xs text-slate-300">State: {device.state}</Text>
                  {device.lastError ? (
                    <Text className="mt-1 text-xs text-rose-200">Error: {device.lastError}</Text>
                  ) : null}
                </View>
                <Pressable
                  disabled={isBusy}
                  onPress={() => onConnectOrDisconnect(device.id, canConnect)}
                  className="rounded-lg bg-cyan-300 px-2.5 py-1.5 disabled:opacity-60"
                >
                  <Text className="text-[11px] font-bold text-slate-900">
                    {isBusy ? "Working..." : canConnect ? "Connect" : "Disconnect"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

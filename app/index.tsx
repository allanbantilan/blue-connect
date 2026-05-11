import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  connectToDevice,
  disconnectFromDevice,
  monitorUnexpectedDisconnect,
  startScan,
} from "@/lib/bluetooth/service";
import { useDeviceSelectors, useDeviceStore } from "@/store/device-store";

type PermissionState = "idle" | "granted" | "denied";

const demoDevices = [
  { id: "demo-1", name: "Pulse Band", rssi: -51 },
  { id: "demo-2", name: "Nano Buds", rssi: -64 },
  { id: "demo-3", name: "TypeBoard Mini", rssi: -58 },
];

export default function Index() {
  const bluetoothOn = useDeviceStore((state) => state.bluetoothOn);
  const devicesById = useDeviceStore((state) => state.devicesById);
  const nearbyIds = useDeviceStore((state) => state.nearbyIds);
  const retryStateById = useDeviceStore((state) => state.retryStateById);
  const setBluetoothOn = useDeviceStore((state) => state.setBluetoothOn);
  const upsertNearbyDevice = useDeviceStore((state) => state.upsertNearbyDevice);
  const setDeviceState = useDeviceStore((state) => state.setDeviceState);
  const setBattery = useDeviceStore((state) => state.setBattery);
  const toggleFavorite = useDeviceStore((state) => state.toggleFavorite);
  const queueReconnect = useDeviceStore((state) => state.queueReconnect);
  const resetReconnect = useDeviceStore((state) => state.resetReconnect);

  const { connectedDevices, averageBattery, lowBatteryDevices, unstableDevices } =
    useDeviceSelectors();

  const [permission, setPermission] = useState<PermissionState>("idle");
  const [scanActive, setScanActive] = useState(false);
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [bleError, setBleError] = useState<string | null>(null);

  const scanStopRef = useRef<null | (() => void)>(null);
  const reconnectTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const disconnectSubsRef = useRef<Record<string, () => void>>({});

  const batteryHealth = useMemo(() => {
    if (!connectedDevices.length) return "No active devices";
    if (averageBattery > 70) return "Healthy";
    if (averageBattery > 35) return "Stable";
    return "Low";
  }, [averageBattery, connectedDevices.length]);

  const nearbyDevices = nearbyIds.map((id) => devicesById[id]).filter(Boolean);

  useEffect(() => {
    void ensurePermissions();

    const reconnectTimers = reconnectTimersRef.current;
    const disconnectSubs = disconnectSubsRef.current;

    return () => {
      scanStopRef.current?.();
      Object.values(reconnectTimers).forEach((timer) => clearTimeout(timer));
      Object.values(disconnectSubs).forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (!bluetoothOn || permission !== "granted") {
      scanStopRef.current?.();
      scanStopRef.current = null;
      setScanActive(false);
      return;
    }

    if (scanStopRef.current) {
      return;
    }

    try {
      scanStopRef.current = startScan((device) => {
        upsertNearbyDevice({ id: device.id, name: device.name, rssi: device.rssi });
      });
      setScanActive(true);
      setBleError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "BLE scan failed to start.";
      setBleError(message);
      setScanActive(false);
    }
  }, [bluetoothOn, permission, upsertNearbyDevice]);

  async function ensurePermissions() {
    if (Platform.OS !== "android") {
      setPermission("granted");
      return;
    }

    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const granted = permissions.every(
      (permissionName) => result[permissionName] === PermissionsAndroid.RESULTS.GRANTED,
    );

    setPermission(granted ? "granted" : "denied");
  }

  async function connect(id: string) {
    if (busyById[id]) return;

    setBusyById((prev) => ({ ...prev, [id]: true }));
    setDeviceState(id, "connecting");

    try {
      await connectToDevice(id);
      setDeviceState(id, "connected");
      setBattery(id, undefined);
      resetReconnect(id);

      disconnectSubsRef.current[id]?.();
      disconnectSubsRef.current[id] = monitorUnexpectedDisconnect(id, (errorMessage) => {
        setDeviceState(id, "reconnecting", errorMessage);
        scheduleReconnect(id);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connect failed";
      setDeviceState(id, "failed", message);
    } finally {
      setBusyById((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function disconnect(id: string) {
    if (busyById[id]) return;

    setBusyById((prev) => ({ ...prev, [id]: true }));

    try {
      disconnectSubsRef.current[id]?.();
      delete disconnectSubsRef.current[id];

      if (reconnectTimersRef.current[id]) {
        clearTimeout(reconnectTimersRef.current[id]);
        delete reconnectTimersRef.current[id];
      }

      await disconnectFromDevice(id);
      setDeviceState(id, "disconnected");
      resetReconnect(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Disconnect failed";
      setDeviceState(id, "failed", message);
    } finally {
      setBusyById((prev) => ({ ...prev, [id]: false }));
    }
  }

  function scheduleReconnect(id: string) {
    const retry = queueReconnect(id);

    if (!retry.nextRetryInMs) {
      setDeviceState(id, "failed", "Max reconnect attempts reached");
      return;
    }

    if (reconnectTimersRef.current[id]) {
      clearTimeout(reconnectTimersRef.current[id]);
    }

    reconnectTimersRef.current[id] = setTimeout(() => {
      void connect(id);
    }, retry.nextRetryInMs);
  }

  function seedNearbyDemo() {
    demoDevices.forEach((device) => upsertNearbyDevice(device));
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <StatusBar style="light" />
      <View className="absolute -right-24 -top-16 h-80 w-80 rounded-full bg-brand-600/30" />
      <View className="absolute -left-24 top-52 h-80 w-80 rounded-full bg-cyan-400/20" />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
              Blue Connect
            </Text>
            <Text className="mt-1 max-w-[230px] text-3xl font-black text-slate-50">
              Multi BLE Device Manager
            </Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-xs font-semibold text-slate-300">Bluetooth</Text>
            <Switch value={bluetoothOn} onValueChange={setBluetoothOn} />
          </View>
        </View>

        <View className="rounded-3xl border border-white/15 bg-white/10 p-4">
          <Text className="text-xs font-semibold text-slate-300">Live Status</Text>
          <Text className="mt-1 text-4xl font-black text-white">{connectedDevices.length} Active</Text>
          <View className="mt-4 flex-row gap-2">
            <View className="flex-1 rounded-2xl bg-slate-900/70 p-3">
              <Text className="text-xs font-medium text-cyan-200">Battery Health</Text>
              <Text className="mt-1 text-xl font-extrabold text-white">{batteryHealth}</Text>
            </View>
            <View className="flex-1 rounded-2xl bg-slate-900/70 p-3">
              <Text className="text-xs font-medium text-cyan-200">Average Battery</Text>
              <Text className="mt-1 text-xl font-extrabold text-white">{averageBattery}%</Text>
            </View>
          </View>
          <Text className="mt-3 text-xs text-slate-300">
            Scan: {scanActive ? "Running" : "Stopped"} • Permission: {permission}
          </Text>
        </View>

        {permission === "denied" ? (
          <View className="rounded-2xl border border-amber-300/50 bg-amber-200/20 p-4">
            <Text className="text-sm font-bold text-amber-100">Bluetooth permission is required.</Text>
            <Pressable onPress={() => void ensurePermissions()} className="mt-3 rounded-xl bg-amber-300 px-3 py-2">
              <Text className="text-center text-sm font-bold text-slate-900">Grant Permission</Text>
            </Pressable>
          </View>
        ) : null}
        {bleError ? (
          <View className="rounded-2xl border border-rose-300/50 bg-rose-200/20 p-4">
            <Text className="text-sm font-bold text-rose-100">{bleError}</Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Connected Devices</Text>
          <Text className="text-xs font-semibold text-slate-300">
            Unstable: {unstableDevices.length} • Low: {lowBatteryDevices.length}
          </Text>
        </View>

        {connectedDevices.length === 0 ? (
          <View className="rounded-2xl border border-white/15 bg-slate-900/50 p-4">
            <Text className="text-sm text-slate-200">No devices connected yet.</Text>
          </View>
        ) : null}

        {connectedDevices.map((device) => (
          <View key={device.id} className="rounded-2xl border border-emerald-200/20 bg-emerald-300/10 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-white">{device.name}</Text>
                <Text className="mt-1 text-xs text-emerald-100">State: {device.state}</Text>
                <Text className="mt-1 text-xs text-emerald-100">
                  Battery: {typeof device.battery === "number" ? `${device.battery}%` : "Battery unavailable"}
                </Text>
                {retryStateById[device.id] ? (
                  <Text className="mt-1 text-xs text-amber-200">
                    Retry #{retryStateById[device.id].attempts} in {retryStateById[device.id].nextRetryInMs}ms
                  </Text>
                ) : null}
              </View>
              <View className="gap-2">
                <Pressable onPress={() => void disconnect(device.id)} className="rounded-lg bg-white/20 px-3 py-2">
                  <Text className="text-xs font-bold text-white">Disconnect</Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleFavorite(device.id)}
                  className="rounded-lg border border-white/20 px-3 py-2"
                >
                  <Text className="text-xs font-bold text-white">
                    {device.isFavorite ? "Unfavorite" : "Favorite"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Nearby Devices</Text>
          <Pressable onPress={seedNearbyDemo} className="rounded-lg border border-cyan-200/30 px-3 py-2">
            <Text className="text-xs font-bold text-cyan-100">Add Demo Devices</Text>
          </Pressable>
        </View>

        {nearbyDevices.map((device) => {
          const stateLabel = device.state;
          const isBusy = busyById[device.id];
          const canConnect = device.state !== "connected";

          return (
            <View key={device.id} className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold text-white">{device.name}</Text>
                  <Text className="mt-1 text-xs text-slate-300">RSSI: {device.rssi ?? "n/a"}</Text>
                  <Text className="mt-1 text-xs text-slate-300">State: {stateLabel}</Text>
                  {device.lastError ? (
                    <Text className="mt-1 text-xs text-rose-200">Error: {device.lastError}</Text>
                  ) : null}
                </View>
                <Pressable
                  disabled={isBusy}
                  onPress={() => (canConnect ? void connect(device.id) : void disconnect(device.id))}
                  className="rounded-lg bg-cyan-300 px-3 py-2 disabled:opacity-60"
                >
                  <Text className="text-xs font-bold text-slate-900">
                    {isBusy ? "Working..." : canConnect ? "Connect" : "Disconnect"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

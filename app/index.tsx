import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  PanResponder,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  connectToDevice,
  disconnectFromDevice,
  getAdapterState,
  listConnectedDevices,
  monitorAdapterState,
  monitorUnexpectedDisconnect,
  startScan,
  type AdapterState,
} from "@/lib/bluetooth/service";
import {
  listPairedClassicDevices,
  type ClassicPairedDevice,
} from "@/lib/bluetooth/classic-service";
import { useDeviceSelectors, useDeviceStore } from "@/store/device-store";

type PermissionState = "idle" | "granted" | "denied";
type ViewTab = "smart" | "audio" | "nearby";
const tabOrder: ViewTab[] = ["smart", "audio", "nearby"];

export default function Index() {
  const devicesById = useDeviceStore((state) => state.devicesById);
  const nearbyIds = useDeviceStore((state) => state.nearbyIds);
  const retryStateById = useDeviceStore((state) => state.retryStateById);
  const upsertNearbyDevice = useDeviceStore((state) => state.upsertNearbyDevice);
  const upsertConnectedDevice = useDeviceStore((state) => state.upsertConnectedDevice);
  const setDeviceState = useDeviceStore((state) => state.setDeviceState);
  const setBattery = useDeviceStore((state) => state.setBattery);
  const queueReconnect = useDeviceStore((state) => state.queueReconnect);
  const resetReconnect = useDeviceStore((state) => state.resetReconnect);

  const { connectedDevices, lowBatteryDevices, unstableDevices } =
    useDeviceSelectors();

  const [permission, setPermission] = useState<PermissionState>("idle");
  const [scanActive, setScanActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [bleError, setBleError] = useState<string | null>(null);
  const [classicError, setClassicError] = useState<string | null>(null);
  const [adapterState, setAdapterState] = useState<AdapterState>("Unknown");
  const [classicPairedDevices, setClassicPairedDevices] = useState<
    ClassicPairedDevice[]
  >([]);
  const [activeTab, setActiveTab] = useState<ViewTab>("smart");

  const scanStopRef = useRef<null | (() => void)>(null);
  const reconnectTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const disconnectSubsRef = useRef<Record<string, () => void>>({});
  const refreshSpin = useRef(new Animated.Value(0)).current;
  const refreshPulse = useRef(new Animated.Value(1)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;
  const activeTabRef = useRef<ViewTab>("smart");

  const nearbyDevices = nearbyIds.map((id) => devicesById[id]).filter(Boolean);

  useEffect(() => {
    activeTabRef.current = activeTab;
    tabAnim.setValue(20);
    Animated.parallel([
      Animated.timing(tabAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, tabAnim]);

  const panResponder = useMemo(
    () =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < 50 || Math.abs(gesture.dx) < Math.abs(gesture.dy)) {
          return;
        }

        const index = tabOrder.indexOf(activeTabRef.current);
        if (gesture.dx < 0 && index < tabOrder.length - 1) {
          setActiveTab(tabOrder[index + 1]);
        } else if (gesture.dx > 0 && index > 0) {
          setActiveTab(tabOrder[index - 1]);
        }
      },
    }),
    [],
  );

  useEffect(() => {
    void ensurePermissions();

    let unsubState: null | (() => void) = null;
    void (async () => {
      try {
        setAdapterState(await getAdapterState());
        unsubState = monitorAdapterState(setAdapterState);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to detect Bluetooth state.";
        setBleError(message);
      }
    })();

    const reconnectTimers = reconnectTimersRef.current;
    const disconnectSubs = disconnectSubsRef.current;

    return () => {
      unsubState?.();
      scanStopRef.current?.();
      Object.values(reconnectTimers).forEach((timer) => clearTimeout(timer));
      Object.values(disconnectSubs).forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (!refreshing) {
      refreshSpin.stopAnimation();
      refreshPulse.stopAnimation();
      refreshSpin.setValue(0);
      refreshPulse.setValue(1);
      return;
    }

    const spinLoop = Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(refreshPulse, {
          toValue: 0.65,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(refreshPulse, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
    );

    spinLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [refreshPulse, refreshSpin, refreshing]);

  useEffect(() => {
    if (permission !== "granted" || adapterState !== "PoweredOn") {
      stopScanning();
      return;
    }

    void (async () => {
      try {
        const devices = await listConnectedDevices();
        devices.forEach((device) => upsertConnectedDevice(device));
      } catch {
        // Ignore preload failures; scanning still works.
      }

      try {
        const paired = await listPairedClassicDevices();
        setClassicPairedDevices(paired);
        setClassicError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load classic paired devices.";
        setClassicError(message);
      }

      stopScanning();
      try {
        scanStopRef.current = startScan((device) => {
          upsertNearbyDevice({
            id: device.id,
            name: device.name,
            rssi: device.rssi,
          });
        });
        setScanActive(true);
        setBleError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Smart device scan failed to start.";
        setBleError(message);
        setScanActive(false);
      }
    })();
  }, [adapterState, permission, upsertConnectedDevice, upsertNearbyDevice]);

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
      (permissionName) =>
        result[permissionName] === PermissionsAndroid.RESULTS.GRANTED,
    );

    setPermission(granted ? "granted" : "denied");
  }

  function stopScanning() {
    scanStopRef.current?.();
    scanStopRef.current = null;
    setScanActive(false);
  }

  function startScanning() {
    if (permission !== "granted" || adapterState !== "PoweredOn") {
      return;
    }

    stopScanning();

    try {
      scanStopRef.current = startScan((device) => {
        upsertNearbyDevice({ id: device.id, name: device.name, rssi: device.rssi });
      });
      setScanActive(true);
      setBleError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Smart device scan failed to start.";
      setBleError(message);
      setScanActive(false);
    }
  }

  async function loadConnectedBle() {
    try {
      const devices = await listConnectedDevices();
      devices.forEach((device) => upsertConnectedDevice(device));
    } catch {
      // Ignore preload failures; scanning still works.
    }
  }

  async function loadClassicPaired() {
    try {
      const paired = await listPairedClassicDevices();
      setClassicPairedDevices(paired);
      setClassicError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load classic paired devices.";
      setClassicError(message);
    }
  }

  async function refreshAll() {
    if (permission !== "granted" || adapterState !== "PoweredOn") {
      return;
    }

    setRefreshing(true);
    await Promise.all([loadConnectedBle(), loadClassicPaired()]);
    startScanning();
    setRefreshing(false);
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
      disconnectSubsRef.current[id] = monitorUnexpectedDisconnect(
        id,
        (errorMessage) => {
          setDeviceState(id, "reconnecting", errorMessage);
          scheduleReconnect(id);
        },
      );
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
      const message =
        error instanceof Error ? error.message : "Disconnect failed";
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

  function batteryText(value?: number) {
    return typeof value === "number" ? `${value}%` : "Battery unavailable";
  }

  async function openBluetoothSettings() {
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS");
        return;
      } catch {
        // Fallback below.
      }
    }

    await Linking.openSettings();
  }

  return (
    <LinearGradient
      colors={["#02040B", "#040A18", "#07142A", "#0A1A34"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
    <SafeAreaView className="flex-1">
      <StatusBar style="light" />
      <View className="absolute -right-24 -top-16 h-80 w-80 rounded-full bg-brand-600/30" />
      <View className="absolute -left-24 top-52 h-80 w-80 rounded-full bg-cyan-400/20" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 14 }}
        {...panResponder.panHandlers}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            tintColor="#a5f3fc"
          />
        }
      >
        <View className="flex-row items-start justify-between">
          <Text className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
            Blue Connect
          </Text>
        </View>

        <View className="rounded-3xl border border-white/15 bg-white/10 p-4">
          <Text className="text-xs font-semibold text-slate-300">Live Status</Text>
          <Text className="mt-1 text-4xl font-black text-white">
            {connectedDevices.length} Active
          </Text>
          <Text className="mt-3 text-xs text-slate-300">
            Scan: {scanActive ? "Running" : "Stopped"} | Permission: {permission}
            {" | "}Adapter: {adapterState}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => setActiveTab("smart")}
            className={`rounded-full px-5 py-3 ${activeTab === "smart" ? "bg-cyan-300" : "bg-white/10"}`}
          >
            <Text className={`text-sm font-extrabold ${activeTab === "smart" ? "text-slate-900" : "text-slate-200"}`}>
              Connected
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("audio")}
            className={`rounded-full px-5 py-3 ${activeTab === "audio" ? "bg-cyan-300" : "bg-white/10"}`}
          >
            <Text className={`text-sm font-extrabold ${activeTab === "audio" ? "text-slate-900" : "text-slate-200"}`}>
              Audio
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("nearby")}
            className={`rounded-full px-5 py-3 ${activeTab === "nearby" ? "bg-cyan-300" : "bg-white/10"}`}
          >
            <Text className={`text-sm font-extrabold ${activeTab === "nearby" ? "text-slate-900" : "text-slate-200"}`}>
              Nearby
            </Text>
          </Pressable>
        </View>
        {refreshing ? (
          <Animated.View
            className="flex-row items-center self-start rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1"
            style={{ opacity: refreshPulse }}
          >
            <Animated.View
              className="mr-2 h-2 w-2 rounded-full bg-cyan-200"
              style={{
                transform: [
                  {
                    rotate: refreshSpin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              }}
            />
            <Text className="text-xs font-semibold text-cyan-100">Refreshing devices...</Text>
          </Animated.View>
        ) : null}

        {adapterState !== "PoweredOn" ? (
          <View className="rounded-2xl border border-amber-300/50 bg-amber-200/20 p-4">
            <Text className="text-sm font-bold text-amber-100">
              Phone Bluetooth is OFF. The app can scan/connect only when Bluetooth
              is ON in system settings.
            </Text>
            <Pressable
              onPress={() => void openBluetoothSettings()}
              className="mt-3 rounded-xl bg-amber-300 px-3 py-2"
            >
              <Text className="text-center text-sm font-bold text-slate-900">
                Open Settings
              </Text>
            </Pressable>
          </View>
        ) : null}

        {permission === "denied" ? (
          <View className="rounded-2xl border border-amber-300/50 bg-amber-200/20 p-4">
            <Text className="text-sm font-bold text-amber-100">
              Bluetooth permission is required.
            </Text>
            <Pressable
              onPress={() => void ensurePermissions()}
              className="mt-3 rounded-xl bg-amber-300 px-3 py-2"
            >
              <Text className="text-center text-sm font-bold text-slate-900">
                Grant Permission
              </Text>
            </Pressable>
          </View>
        ) : null}

        {bleError ? (
          <View className="rounded-2xl border border-rose-300/50 bg-rose-200/20 p-4">
            <Text className="text-sm font-bold text-rose-100">{bleError}</Text>
          </View>
        ) : null}
        {classicError ? (
          <View className="rounded-2xl border border-rose-300/50 bg-rose-200/20 p-4">
            <Text className="text-sm font-bold text-rose-100">{classicError}</Text>
          </View>
        ) : null}

        <Animated.View
          style={{
            opacity: tabAnim.interpolate({
              inputRange: [0, 20],
              outputRange: [1, 0.55],
            }),
            transform: [{ translateX: tabAnim }],
          }}
        >
        {activeTab === "smart" ? (
          <>
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Connected Smart Devices</Text>
          <Text className="text-xs font-semibold text-slate-300">
            Unstable: {unstableDevices.length} | Low battery: {lowBatteryDevices.length}
          </Text>
        </View>

        {connectedDevices.length === 0 ? (
          <View className="rounded-2xl border border-white/15 bg-slate-900/50 p-4">
            <Text className="text-sm text-slate-200">No devices connected yet.</Text>
          </View>
        ) : null}

        {connectedDevices.map((device) => (
          <View
            key={device.id}
            className="rounded-2xl border border-emerald-200/20 bg-emerald-300/10 p-4"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-white">{device.name}</Text>
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
                  onPress={() => void disconnect(device.id)}
                  className="rounded-lg bg-white/20 px-3 py-2"
                >
                  <Text className="text-xs font-bold text-white">Disconnect</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
          </>
        ) : null}

        {activeTab === "audio" ? (
          <>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Classic Paired Devices</Text>
          <Text className="text-xs font-semibold text-slate-300">
            {classicPairedDevices.length} paired
          </Text>
        </View>

        {classicPairedDevices.length === 0 ? (
          <View className="rounded-2xl border border-white/15 bg-slate-900/50 p-4">
            <Text className="text-sm text-slate-200">No paired classic devices found.</Text>
          </View>
        ) : null}

        {classicPairedDevices.map((device) => (
          <View
            key={device.id}
            className="rounded-2xl border border-violet-200/20 bg-violet-300/10 p-4"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-white">{device.name}</Text>
                <Text className="mt-1 text-xs text-violet-100">Type: Classic Bluetooth</Text>
              </View>
              <View className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-xs font-bold text-white">
                  {device.connected ? "Connected" : "Paired"}
                </Text>
              </View>
            </View>
          </View>
        ))}
          </>
        ) : null}

        {activeTab === "nearby" ? (
          <>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Nearby Devices</Text>
          <Pressable
            onPress={startScanning}
            className="rounded-lg border border-cyan-200/30 px-3 py-2"
          >
            <Text className="text-xs font-bold text-cyan-100">Scan</Text>
          </Pressable>
        </View>

        {nearbyDevices.map((device) => {
          const isBusy = busyById[device.id];
          const canConnect = device.state !== "connected";

          return (
            <View key={device.id} className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold text-white">{device.name}</Text>
                  <Text className="mt-1 text-xs text-slate-300">RSSI: {device.rssi ?? "n/a"}</Text>
                  <Text className="mt-1 text-xs text-slate-300">State: {device.state}</Text>
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
          </>
        ) : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

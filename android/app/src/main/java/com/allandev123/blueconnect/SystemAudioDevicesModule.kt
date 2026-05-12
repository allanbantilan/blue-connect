package com.allandev123.blueconnect

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SystemAudioDevicesModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SystemAudioDevices"

  @ReactMethod
  fun getActiveBluetoothAudioOutputs(promise: Promise) {
    try {
      val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
      val result = Arguments.createArray()

      for (device in outputs) {
        if (!isBluetoothOutput(device)) continue
        val entry = Arguments.createMap()
        entry.putString("name", device.productName?.toString() ?: "Bluetooth Audio Device")
        entry.putString("address", device.address)
        entry.putInt("type", device.type)
        result.pushMap(entry)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("AUDIO_OUTPUT_QUERY_FAILED", error)
    }
  }

  @ReactMethod
  fun getConnectedProfileDevices(promise: Promise) {
    try {
      val adapter = BluetoothAdapter.getDefaultAdapter()
      if (adapter == null) {
        promise.resolve(Arguments.createArray())
        return
      }

      val profiles = mutableListOf(BluetoothProfile.A2DP, BluetoothProfile.HEADSET)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) profiles.add(BluetoothProfile.HEARING_AID)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) profiles.add(BluetoothProfile.LE_AUDIO)

      val connectedByAddress = linkedMapOf<String, Pair<String, Int>>()
      var remaining = profiles.size
      var resolved = false

      fun resolveNow() {
        if (resolved) return
        resolved = true
        val output = Arguments.createArray()
        for ((address, pair) in connectedByAddress) {
          val map = Arguments.createMap()
          map.putString("address", address)
          map.putString("name", pair.first)
          map.putInt("profile", pair.second)
          output.pushMap(map)
        }
        promise.resolve(output)
      }

      fun finishOne() {
        remaining -= 1
        if (remaining <= 0) resolveNow()
      }

      Handler(Looper.getMainLooper()).postDelayed({ resolveNow() }, 3500)

      for (profile in profiles) {
        val ok = adapter.getProfileProxy(
          reactContext,
          object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(which: Int, proxy: BluetoothProfile?) {
              try {
                proxy?.connectedDevices?.forEach { device: BluetoothDevice ->
                  val address = device.address ?: return@forEach
                  val name = device.name ?: "Bluetooth Device"
                  if (!connectedByAddress.containsKey(address)) {
                    connectedByAddress[address] = Pair(name, which)
                  }
                }
              } catch (_: Exception) {
              } finally {
                try {
                  if (proxy != null) adapter.closeProfileProxy(which, proxy)
                } catch (_: Exception) {
                }
                finishOne()
              }
            }

            override fun onServiceDisconnected(which: Int) {}
          },
          profile
        )

        if (!ok) finishOne()
      }
    } catch (error: Exception) {
      promise.reject("CONNECTED_PROFILE_QUERY_FAILED", error)
    }
  }

  @ReactMethod
  fun getBondedDeviceBatteryLevels(promise: Promise) {
    try {
      val adapter = BluetoothAdapter.getDefaultAdapter()
      if (adapter == null) {
        promise.resolve(Arguments.createArray())
        return
      }

      val result = Arguments.createArray()
      for (device in adapter.bondedDevices) {
        val batteryLevel = resolveBatteryLevel(device)
        if (batteryLevel < 0 || batteryLevel > 100) {
          continue
        }

        val map = Arguments.createMap()
        map.putString("address", device.address)
        map.putString("name", device.name ?: "Bluetooth Device")
        map.putInt("battery", batteryLevel)
        result.pushMap(map)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("BONDED_BATTERY_QUERY_FAILED", error)
    }
  }

  @ReactMethod
  fun pairDevice(address: String, promise: Promise) {
    try {
      val adapter = BluetoothAdapter.getDefaultAdapter()
      if (adapter == null) {
        promise.reject("NO_BLUETOOTH_ADAPTER", "Bluetooth adapter not available")
        return
      }

      val normalizedAddress = address.trim()
      if (normalizedAddress.isBlank()) {
        promise.reject("INVALID_ADDRESS", "Device address is required")
        return
      }

      val device = adapter.getRemoteDevice(normalizedAddress)
      val alreadyBonded = device.bondState == BluetoothDevice.BOND_BONDED
      if (alreadyBonded) {
        promise.resolve(true)
        return
      }

      val started = device.createBond()
      promise.resolve(started)
    } catch (error: Exception) {
      promise.reject("PAIR_DEVICE_FAILED", error)
    }
  }

  private fun isBluetoothOutput(device: AudioDeviceInfo): Boolean {
    return when (device.type) {
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> true
      AudioDeviceInfo.TYPE_BLE_HEADSET -> true
      AudioDeviceInfo.TYPE_BLE_SPEAKER -> true
      AudioDeviceInfo.TYPE_BLE_BROADCAST -> true
      else -> false
    }
  }

  private fun resolveBatteryLevel(device: BluetoothDevice): Int {
    return try {
      val method = device.javaClass.getMethod("getBatteryLevel")
      val value = method.invoke(device)
      when (value) {
        is Int -> value
        else -> -1
      }
    } catch (_: Exception) {
      -1
    }
  }
}

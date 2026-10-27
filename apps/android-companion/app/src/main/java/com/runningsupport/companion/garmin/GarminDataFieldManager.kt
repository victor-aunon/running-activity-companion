package com.runningsupport.companion.garmin

import android.content.Context
import android.util.Log
import com.garmin.android.connectiq.ConnectIQ
import com.garmin.android.connectiq.IQApp
import com.garmin.android.connectiq.IQDevice
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class GarminDataFieldManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val db = AppDatabase.getDatabase(context)
    private var mockDataSource: MockTelemetryDataSource? = null
    private var telemetryListener: ((JSONObject) -> Boolean)? = null
    private var connectionStateListener: ((Boolean) -> Unit)? = null

    private var connectIQ: ConnectIQ? = null
    private var targetDevice: IQDevice? = null
    private var isSdkReady = false
    private var currentSessionId: String = ""

    private val garminApp = IQApp(GARMIN_APP_UUID)

    fun setTelemetryListener(listener: (JSONObject) -> Boolean) {
        this.telemetryListener = listener
    }

    fun setConnectionStateListener(listener: (Boolean) -> Unit) {
        this.connectionStateListener = listener
    }

    fun start(sessionId: String) {
        currentSessionId = sessionId
        initializeConnectIq()
    }

    fun stop() {
        stopSimulation()
        cleanupConnectIq()
    }

    fun setSimulationMode(enabled: Boolean, sessionId: String) {
        currentSessionId = sessionId
        if (enabled) {
            Log.i(TAG, "Starting MockTelemetryDataSource simulation for session: $sessionId")
            mockDataSource?.stop()
            mockDataSource = MockTelemetryDataSource(sessionId) { snapshot ->
                onBleMessageReceived(sessionId, snapshot)
            }
            mockDataSource?.start(scope)
            connectionStateListener?.invoke(true)
        } else {
            stopSimulation()
            // If service is running, fall back to real watch connection
            if (isSdkReady && targetDevice != null) {
                checkDeviceConnection(targetDevice)
            } else {
                initializeConnectIq()
            }
        }
    }

    private fun stopSimulation() {
        mockDataSource?.stop()
        mockDataSource = null
    }

    private fun initializeConnectIq() {
        if (connectIQ != null && isSdkReady) {
            discoverAndRegisterDevices()
            return
        }

        try {
            val ciq = ConnectIQ.getInstance(context, ConnectIQ.IQConnectType.WIRELESS)
            connectIQ = ciq
            ciq.initialize(context, true, object : ConnectIQ.ConnectIQListener {
                override fun onSdkReady() {
                    Log.i(TAG, "Garmin ConnectIQ SDK Ready")
                    isSdkReady = true
                    discoverAndRegisterDevices()
                }

                override fun onInitializeError(status: ConnectIQ.IQSdkErrorStatus) {
                    Log.e(TAG, "Garmin ConnectIQ SDK initialize error: $status")
                    isSdkReady = false
                    connectionStateListener?.invoke(false)
                }

                override fun onSdkShutDown() {
                    Log.i(TAG, "Garmin ConnectIQ SDK Shut Down")
                    isSdkReady = false
                    connectionStateListener?.invoke(false)
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing Garmin ConnectIQ: ${e.message}", e)
            connectionStateListener?.invoke(false)
        }
    }

    private fun discoverAndRegisterDevices() {
        val ciq = connectIQ ?: return
        if (!isSdkReady) return

        try {
            val connectedList = ciq.connectedDevices ?: emptyList()
            val knownList = ciq.knownDevices ?: emptyList()

            Log.i(TAG, "Garmin Devices: connected=${connectedList.size}, known=${knownList.size}")

            val device = connectedList.firstOrNull() ?: knownList.firstOrNull()
            if (device != null) {
                targetDevice = device
                registerDeviceListeners(device)
            } else {
                Log.w(TAG, "No Garmin devices paired or connected in Garmin Connect Mobile")
                connectionStateListener?.invoke(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error discovering Garmin devices: ${e.message}", e)
        }
    }

    private fun registerDeviceListeners(device: IQDevice) {
        val ciq = connectIQ ?: return
        try {
            // 1. Device hardware/BLE connection status listener
            ciq.registerForDeviceEvents(device) { dev, newStatus ->
                Log.i(TAG, "Garmin device status: ${dev?.friendlyName} -> $newStatus")
                val isConnected = (newStatus == IQDevice.IQDeviceStatus.CONNECTED)
                connectionStateListener?.invoke(isConnected)
                if (isConnected && dev != null) {
                    targetDevice = dev
                    registerAppEvents(dev)
                }
            }

            // Check current status immediately
            checkDeviceConnection(device)

            // 2. Register for DataField application messages
            registerAppEvents(device)
        } catch (e: Exception) {
            Log.e(TAG, "Error registering device events: ${e.message}", e)
        }
    }

    private fun checkDeviceConnection(device: IQDevice?) {
        val ciq = connectIQ ?: return
        val dev = device ?: return
        try {
            val status = ciq.getDeviceStatus(dev)
            val isConnected = (status == IQDevice.IQDeviceStatus.CONNECTED)
            Log.i(TAG, "Initial device status for ${dev.friendlyName}: $status")
            connectionStateListener?.invoke(isConnected)
        } catch (e: Exception) {
            Log.w(TAG, "Could not get device status: ${e.message}")
        }
    }

    private fun registerAppEvents(device: IQDevice) {
        val ciq = connectIQ ?: return
        try {
            ciq.registerForAppEvents(device, garminApp) { dev, app, messageList, status ->
                if (status == ConnectIQ.IQMessageStatus.SUCCESS && messageList != null) {
                    for (msg in messageList) {
                        handleIncomingGarminPayload(msg)
                    }
                } else {
                    Log.w(TAG, "Received message with status: $status")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error registering app events: ${e.message}", e)
        }
    }

    private fun handleIncomingGarminPayload(msg: Any) {
        val json = when (msg) {
            is Map<*, *> -> mapToJson(msg)
            is String -> try { JSONObject(msg) } catch (e: Exception) { null }
            is JSONObject -> msg
            else -> null
        }

        if (json != null) {
            onBleMessageReceived(currentSessionId, json)
        } else {
            Log.w(TAG, "Unrecognized message format from Garmin: ${msg.javaClass.name}")
        }
    }

    fun onBleMessageReceived(sessionId: String, payload: JSONObject) {
        try {
            val type = payload.optString("type")

            // Forward runner gratitude acknowledgment from watch
            if (type == "CHEER_STATUS_UPDATE") {
                telemetryListener?.invoke(payload)
                return
            }

            if (type != "TELEMETRY_SNAPSHOT") return

            if (!payload.has("sessionId") || payload.optString("sessionId").isEmpty()) {
                payload.put("sessionId", sessionId)
            }

            // Forward directly to live listener (e.g. WebSocket gateway)
            val sentLive = telemetryListener?.invoke(payload) ?: false

            val seq = payload.optLong("seq", 0)
            val timestamp = payload.optLong("timestamp", System.currentTimeMillis())

            val coords = payload.optJSONObject("coordinates")
            val lat = coords?.optDouble("lat", 0.0) ?: 0.0
            val lng = coords?.optDouble("lng", 0.0) ?: 0.0
            val elevation = coords?.optDouble("elevationM", 0.0) ?: 0.0
            val gpsQuality = coords?.optInt("gpsQuality", 4) ?: 4

            val metrics = payload.optJSONObject("metrics")
            val heartRate = metrics?.optInt("heartRateBpm", 0) ?: 0
            val speedMps = metrics?.optDouble("speedMps", 0.0) ?: 0.0
            val paceSecPerKm = metrics?.optDouble("paceSecPerKm", 0.0) ?: 0.0
            val cadence = metrics?.optInt("cadenceSpm", 0) ?: 0
            val stepCount = metrics?.optInt("stepCount", 0) ?: 0

            val entity = TelemetryEntity(
                sessionId = sessionId,
                seq = seq,
                timestamp = timestamp,
                latitude = lat,
                longitude = lng,
                elevation = elevation,
                gpsQuality = gpsQuality,
                speedMps = speedMps,
                paceSecPerKm = paceSecPerKm,
                heartRate = heartRate,
                cadence = cadence,
                stepCount = stepCount,
                synced = if (sentLive) 1 else 0
            )

            scope.launch {
                db.telemetryBufferDao().insertTelemetry(entity)
                db.telemetryBufferDao().pruneBufferOverflow(sessionId)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing BLE telemetry payload: ${e.message}", e)
        }
    }

    fun transmitCheerToWatch(cheerPayload: JSONObject, onResult: (Boolean) -> Unit) {
        val ciq = connectIQ
        val device = targetDevice
        if (ciq != null && device != null && isSdkReady) {
            val cheerMap = jsonToMap(cheerPayload)
            Log.i(TAG, "Transmitting cheer to Garmin watch (${device.friendlyName}): ${cheerPayload.optString("body")}")
            try {
                ciq.sendMessage(device, garminApp, cheerMap) { _, _, status ->
                    val success = (status == ConnectIQ.IQMessageStatus.SUCCESS)
                    Log.i(TAG, "Cheer send result: status=$status, success=$success")
                    onResult(success)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending cheer message: ${e.message}", e)
                onResult(false)
            }
        } else {
            Log.w(TAG, "Garmin device not ready/connected, cannot transmit cheer to watch")
            onResult(false)
        }
    }

    private fun cleanupConnectIq() {
        val ciq = connectIQ
        val device = targetDevice
        if (ciq != null && device != null) {
            try {
                ciq.unregisterForApplicationEvents(device, garminApp)
                ciq.unregisterForDeviceEvents(device)
            } catch (e: Exception) {
                Log.w(TAG, "Error unregistering ConnectIQ events: ${e.message}")
            }
        }
        try {
            ciq?.shutdown(context)
        } catch (e: Exception) {
            Log.w(TAG, "Error shutting down ConnectIQ: ${e.message}")
        }
        targetDevice = null
        isSdkReady = false
        connectionStateListener?.invoke(false)
    }

    private fun mapToJson(map: Map<*, *>): JSONObject {
        val json = JSONObject()
        for ((key, value) in map) {
            if (key != null) {
                val keyStr = key.toString()
                when (value) {
                    is Map<*, *> -> json.put(keyStr, mapToJson(value))
                    is List<*> -> json.put(keyStr, listToJsonArray(value))
                    else -> json.put(keyStr, value ?: JSONObject.NULL)
                }
            }
        }
        return json
    }

    private fun listToJsonArray(list: List<*>): JSONArray {
        val array = JSONArray()
        for (item in list) {
            when (item) {
                is Map<*, *> -> array.put(mapToJson(item))
                is List<*> -> array.put(listToJsonArray(item))
                else -> array.put(item ?: JSONObject.NULL)
            }
        }
        return array
    }

    private fun jsonToMap(json: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = json.get(key)
            when (value) {
                is JSONObject -> map[key] = jsonToMap(value)
                is JSONArray -> map[key] = jsonArrayToList(value)
                else -> map[key] = value
            }
        }
        return map
    }

    private fun jsonArrayToList(array: JSONArray): List<Any> {
        val list = mutableListOf<Any>()
        for (i in 0 until array.length()) {
            val value = array.get(i)
            when (value) {
                is JSONObject -> list.add(jsonToMap(value))
                is JSONArray -> list.add(jsonArrayToList(value))
                else -> list.add(value)
            }
        }
        return list
    }

    companion object {
        private const val TAG = "GarminDataFieldManager"
        const val GARMIN_APP_UUID = "b8941031-7e53-488b-a81d-8472506e9021"
    }
}

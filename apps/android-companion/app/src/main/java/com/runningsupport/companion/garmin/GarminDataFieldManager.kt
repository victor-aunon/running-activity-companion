package com.runningsupport.companion.garmin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import androidx.core.content.ContextCompat
import com.garmin.android.connectiq.ConnectIQ
import com.garmin.android.connectiq.IQApp
import com.garmin.android.connectiq.IQDevice
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class GarminDiagnostics(
    val sdkStatus: String = "No iniciado",
    val deviceName: String? = null,
    val deviceId: String? = null,
    val isDeviceConnected: Boolean = false,
    val isAppRegistered: Boolean = false,
    val packetsReceivedCount: Long = 0,
    val lastPacketTimeMs: Long = 0,
    val lastHeartRate: Int = 0,
    val lastPaceSecPerKm: Double = 0.0,
    val lastTestResult: String? = null,
    val logs: List<String> = emptyList()
)

class GarminDataFieldManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val db = AppDatabase.getDatabase(context)
    private var mockDataSource: MockTelemetryDataSource? = null
    private var telemetryListener: ((JSONObject) -> Boolean)? = null
    private var connectionStateListener: ((Boolean) -> Unit)? = null

    private val _diagnosticsState = MutableStateFlow(GarminDiagnostics())
    val diagnosticsState = _diagnosticsState.asStateFlow()

    private var connectIQ: ConnectIQ? = null
    private var targetDevice: IQDevice? = null
    private var isSdkReady = false
    private var currentSessionId: String = ""

    private val garminApp = IQApp(GARMIN_APP_UUID)
    private val timeFormatter = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    fun setTelemetryListener(listener: (JSONObject) -> Boolean) {
        this.telemetryListener = listener
    }

    fun setConnectionStateListener(listener: (Boolean) -> Unit) {
        this.connectionStateListener = listener
    }

    fun start(sessionId: String) {
        currentSessionId = sessionId
        logDiagnostic("Iniciando conexión con Garmin (Sesión: $sessionId)")
        initializeConnectIq()
    }

    fun stop() {
        logDiagnostic("Deteniendo conexión con Garmin")
        stopSimulation()
        cleanupConnectIq()
    }

    fun setSimulationMode(enabled: Boolean, sessionId: String) {
        currentSessionId = sessionId
        if (enabled) {
            logDiagnostic("Iniciando simulación virtual (1 Hz)")
            mockDataSource?.stop()
            mockDataSource = MockTelemetryDataSource(sessionId) { snapshot ->
                onBleMessageReceived(sessionId, snapshot)
            }
            mockDataSource?.start(scope)
            _diagnosticsState.update {
                it.copy(
                    sdkStatus = "Modo Simulación",
                    deviceName = "Simulador Virtual",
                    isDeviceConnected = true,
                    isAppRegistered = true
                )
            }
            connectionStateListener?.invoke(true)
        } else {
            stopSimulation()
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
            logDiagnostic("Inicializando ConnectIQ SDK vía Bluetooth...")
            _diagnosticsState.update { it.copy(sdkStatus = "Inicializando SDK...") }

            val ciq = ConnectIQ.getInstance(context, ConnectIQ.IQConnectType.WIRELESS)
            connectIQ = ciq
            ciq.initialize(context, true, object : ConnectIQ.ConnectIQListener {
                override fun onSdkReady() {
                    logDiagnostic("✓ ConnectIQ SDK listo (Garmin Connect Mobile enlazado)")
                    isSdkReady = true
                    _diagnosticsState.update { it.copy(sdkStatus = "SDK Listo (GCM Conectado)") }
                    discoverAndRegisterDevices()
                }

                override fun onInitializeError(status: ConnectIQ.IQSdkErrorStatus) {
                    val errMsg = "✗ Error al inicializar SDK: $status"
                    logDiagnostic(errMsg)
                    isSdkReady = false
                    _diagnosticsState.update { it.copy(sdkStatus = "Error: $status") }
                    connectionStateListener?.invoke(false)
                }

                override fun onSdkShutDown() {
                    logDiagnostic("ConnectIQ SDK apagado")
                    isSdkReady = false
                    _diagnosticsState.update { it.copy(sdkStatus = "Apagado") }
                    connectionStateListener?.invoke(false)
                }
            })
        } catch (e: Exception) {
            val err = "Excepción al inicializar ConnectIQ: ${e.message}"
            logDiagnostic(err)
            _diagnosticsState.update { it.copy(sdkStatus = "Fallo: ${e.message}") }
            connectionStateListener?.invoke(false)
        }
    }

    private var directReceiver: BroadcastReceiver? = null

    private fun registerDirectBroadcastReceiver() {
        if (directReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                if (intent == null) return
                if (intent.action == "com.garmin.android.connectiq.INCOMING_MESSAGE") {
                    logDiagnostic("⚡ Broadcast INCOMING_MESSAGE interceptado directamente")
                    val extras = intent.extras ?: return
                    val payload = extras.get("com.garmin.android.connectiq.EXTRA_PAYLOAD")
                        ?: extras.get("EXTRA_PAYLOAD")
                    if (payload != null) {
                        handleIncomingGarminPayload(payload)
                    }
                }
            }
        }
        directReceiver = receiver
        val filter = IntentFilter("com.garmin.android.connectiq.INCOMING_MESSAGE")
        try {
            ContextCompat.registerReceiver(
                context,
                receiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            )
            logDiagnostic("✓ BroadcastReceiver directo registrado con RECEIVER_EXPORTED")
        } catch (e: Exception) {
            logDiagnostic("Aviso al registrar broadcast directo: ${e.message}")
        }
    }

    private fun discoverAndRegisterDevices() {
        val ciq = connectIQ ?: return
        if (!isSdkReady) return

        try {
            val connectedList = ciq.connectedDevices ?: emptyList()
            val knownList = ciq.knownDevices ?: emptyList()

            logDiagnostic("Dispositivos Garmin: ${connectedList.size} conectados, ${knownList.size} conocidos")

            val allDevices = (connectedList + knownList).distinctBy { it.deviceIdentifier }
            if (allDevices.isNotEmpty()) {
                val primary = connectedList.firstOrNull() ?: allDevices.first()
                targetDevice = primary
                logDiagnostic("Reloj principal: ${primary.friendlyName} (${primary.deviceIdentifier})")
                _diagnosticsState.update {
                    it.copy(
                        deviceName = primary.friendlyName,
                        deviceId = primary.deviceIdentifier.toString()
                    )
                }
                for (dev in allDevices) {
                    registerDeviceListeners(dev)
                }
                registerDirectBroadcastReceiver()
            } else {
                logDiagnostic("⚠️ No se detectó ningún reloj Garmin enlazado en Garmin Connect")
                _diagnosticsState.update {
                    it.copy(
                        deviceName = "Ninguno",
                        isDeviceConnected = false,
                        isAppRegistered = false
                    )
                }
                connectionStateListener?.invoke(false)
            }
        } catch (e: Exception) {
            logDiagnostic("Error buscando dispositivos: ${e.message}")
        }
    }

    private fun registerDeviceListeners(device: IQDevice) {
        val ciq = connectIQ ?: return
        try {
            ciq.registerForDeviceEvents(device, object : ConnectIQ.IQDeviceEventListener {
                override fun onDeviceStatusChanged(dev: IQDevice?, newStatus: IQDevice.IQDeviceStatus?) {
                    val isConnected = (newStatus == IQDevice.IQDeviceStatus.CONNECTED)
                    logDiagnostic("Estado Bluetooth reloj: ${dev?.friendlyName} -> $newStatus")
                    _diagnosticsState.update { it.copy(isDeviceConnected = isConnected) }
                    connectionStateListener?.invoke(isConnected)

                    if (isConnected && dev != null) {
                        targetDevice = dev
                        registerAppEvents(dev)
                    }
                }
            })

            checkDeviceConnection(device)
            registerAppEvents(device)
        } catch (e: Exception) {
            logDiagnostic("Error registrando eventos del reloj: ${e.message}")
        }
    }

    private fun checkDeviceConnection(device: IQDevice?) {
        val ciq = connectIQ ?: return
        val dev = device ?: return
        try {
            val status = ciq.getDeviceStatus(dev)
            val isConnected = (status == IQDevice.IQDeviceStatus.CONNECTED)
            logDiagnostic("Comprobación estado reloj: ${dev.friendlyName} = $status")
            _diagnosticsState.update { it.copy(isDeviceConnected = isConnected) }
            connectionStateListener?.invoke(isConnected)
        } catch (e: Exception) {
            logDiagnostic("Aviso al consultar estado del dispositivo: ${e.message}")
        }
    }

    private fun registerAppEvents(device: IQDevice) {
        val ciq = connectIQ ?: return
        try {
            logDiagnostic("Registrando listener de la app DataField (${garminApp.applicationId})")

            // Comprobar si GCM reconoce la app instalada en el reloj
            try {
                ciq.getApplicationInfo(GARMIN_APP_UUID, device, object : ConnectIQ.IQApplicationInfoListener {
                    override fun onApplicationInfoReceived(app: IQApp?) {
                        logDiagnostic("✓ App verificada en reloj por GCM: ${app?.displayName ?: "RunningSupport"}")
                    }

                    override fun onApplicationNotInstalled(applicationId: String?) {
                        logDiagnostic("⚠️ GCM indica que la app $applicationId no está en el reloj (verifica que esté instalada)")
                    }
                })
            } catch (e: Exception) {
                logDiagnostic("Aviso getApplicationInfo: ${e.message}")
            }

            ciq.registerForAppEvents(device, garminApp, object : ConnectIQ.IQApplicationEventListener {
                override fun onMessageReceived(dev: IQDevice?, app: IQApp?, messageList: MutableList<Any>?, status: ConnectIQ.IQMessageStatus?) {
                    logDiagnostic("Mensaje ConnectIQ: status=$status, count=${messageList?.size ?: 0}")
                    if (messageList != null && messageList.isNotEmpty()) {
                        for (msg in messageList) {
                            handleIncomingGarminPayload(msg)
                        }
                    }
                }
            })
            _diagnosticsState.update { it.copy(isAppRegistered = true) }
        } catch (e: Exception) {
            logDiagnostic("Error registrando listener DataField: ${e.message}")
        }
    }

    private fun handleIncomingGarminPayload(msg: Any) {
        val json = when (msg) {
            is Map<*, *> -> mapToJson(msg)
            is String -> try { JSONObject(msg) } catch (e: Exception) { null }
            is JSONObject -> msg
            else -> {
                try {
                    JSONObject(msg.toString())
                } catch (e: Exception) {
                    null
                }
            }
        }

        if (json != null) {
            val type = json.optString("type", "UNKNOWN")
            logDiagnostic("✓ Paquete recibido de reloj: type=$type (seq=${json.optLong("seq")})")
            onBleMessageReceived(currentSessionId, json)
        } else {
            logDiagnostic("Formato de mensaje no reconocido: ${msg.javaClass.name}")
        }
    }

    fun onBleMessageReceived(sessionId: String, payload: JSONObject) {
        try {
            val type = payload.optString("type")

            if (type == "CHEER_STATUS_UPDATE") {
                logDiagnostic("✓ Agradecimiento recibido del corredor en el reloj!")
                telemetryListener?.invoke(payload)
                return
            }

            if (type == "SESSION_STATE_CHANGED") {
                logDiagnostic("🏁 Fin de carrera recibido del reloj!")
                if (!payload.has("sessionId") || payload.optString("sessionId").isEmpty()) {
                    payload.put("sessionId", sessionId)
                }
                telemetryListener?.invoke(payload)
                return
            }

            if (type != "TELEMETRY_SNAPSHOT") return

            if (!payload.has("sessionId") || payload.optString("sessionId").isEmpty()) {
                payload.put("sessionId", sessionId)
            }

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
            val totalDistanceM = metrics?.optDouble("totalDistanceM", 0.0) ?: 0.0

            _diagnosticsState.update { current ->
                current.copy(
                    packetsReceivedCount = current.packetsReceivedCount + 1,
                    lastPacketTimeMs = timestamp,
                    lastHeartRate = heartRate,
                    lastPaceSecPerKm = paceSecPerKm
                )
            }

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
                distanceM = totalDistanceM,
                synced = if (sentLive) 1 else 0
            )

            scope.launch {
                db.telemetryBufferDao().insertTelemetry(entity)
                db.telemetryBufferDao().pruneBufferOverflow(sessionId)
            }
        } catch (e: Exception) {
            logDiagnostic("Error procesando telemetría BLE: ${e.message}")
        }
    }

    fun sendTestPingToWatch(onResult: (String) -> Unit) {
        val ciq = connectIQ
        val device = targetDevice

        if (ciq == null) {
            val err = "ConnectIQ SDK no inicializado"
            logDiagnostic(err)
            _diagnosticsState.update { it.copy(lastTestResult = err) }
            onResult(err)
            return
        }

        if (device == null) {
            val err = "No se ha detectado ningún reloj Garmin enlazado"
            logDiagnostic(err)
            _diagnosticsState.update { it.copy(lastTestResult = err) }
            onResult(err)
            return
        }

        if (!isSdkReady) {
            val err = "ConnectIQ SDK no está listo. Comprueba que Garmin Connect Mobile esté abierta."
            logDiagnostic(err)
            _diagnosticsState.update { it.copy(lastTestResult = err) }
            onResult(err)
            return
        }

        val testPayload = JSONObject().apply {
            put("type", "DISPATCH_CHEER")
            put("notificationId", "test-ping-${System.currentTimeMillis()}")
            put("senderName", "Test Companion")
            put("body", "¡Prueba de enlace OK!")
            put("ttlSeconds", 30)
        }

        logDiagnostic("Enviando mensaje de prueba a ${device.friendlyName}...")

        try {
            val cheerMap = jsonToMap(testPayload)
            ciq.sendMessage(device, garminApp, cheerMap, object : ConnectIQ.IQSendMessageListener {
                override fun onMessageStatus(dev: IQDevice?, app: IQApp?, status: ConnectIQ.IQMessageStatus?) {
                    val resultText = if (status == ConnectIQ.IQMessageStatus.SUCCESS) {
                        "✓ ÉXITO: Mensaje entregado al reloj (${dev?.friendlyName})"
                    } else {
                        "✗ ERROR al enviar al reloj: $status"
                    }

                    logDiagnostic("Resultado prueba: $resultText")
                    _diagnosticsState.update { it.copy(lastTestResult = resultText) }
                    onResult(resultText)
                }
            })
        } catch (e: Exception) {
            val err = "Excepción al enviar prueba: ${e.message}"
            logDiagnostic(err)
            _diagnosticsState.update { it.copy(lastTestResult = err) }
            onResult(err)
        }
    }

    fun transmitCheerToWatch(cheerPayload: JSONObject, onResult: (Boolean) -> Unit) {
        val ciq = connectIQ
        val device = targetDevice
        if (ciq != null && device != null && isSdkReady) {
            val cheerMap = jsonToMap(cheerPayload)
            logDiagnostic("Transmitiendo ánimo a ${device.friendlyName}: ${cheerPayload.optString("body")}")
            try {
                ciq.sendMessage(device, garminApp, cheerMap, object : ConnectIQ.IQSendMessageListener {
                    override fun onMessageStatus(dev: IQDevice?, app: IQApp?, status: ConnectIQ.IQMessageStatus?) {
                        val success = (status == ConnectIQ.IQMessageStatus.SUCCESS)
                        logDiagnostic("Resultado envío ánimo: $status")
                        onResult(success)
                    }
                })
            } catch (e: Exception) {
                logDiagnostic("Error enviando ánimo: ${e.message}")
                onResult(false)
            }
        } else {
            logDiagnostic("⚠️ Reloj no disponible para transmitir ánimo")
            onResult(false)
        }
    }

    private fun logDiagnostic(message: String) {
        val timestamp = timeFormatter.format(Date())
        val entry = "[$timestamp] $message"
        Log.i(TAG, entry)
        _diagnosticsState.update { current ->
            val updated = (listOf(entry) + current.logs).take(15)
            current.copy(logs = updated)
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
                Log.w(TAG, "Error desregistrando eventos ConnectIQ: ${e.message}")
            }
        }
        try {
            ciq?.shutdown(context)
        } catch (e: Exception) {
            Log.w(TAG, "Error apagando ConnectIQ: ${e.message}")
        }
        directReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (e: Exception) {
                // Ignore
            }
            directReceiver = null
        }
        targetDevice = null
        isSdkReady = false
        _diagnosticsState.update {
            it.copy(
                isDeviceConnected = false,
                isAppRegistered = false,
                sdkStatus = "Detenido"
            )
        }
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

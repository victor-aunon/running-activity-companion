package com.runningsupport.companion.ui.screens

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runningsupport.companion.garmin.GarminDiagnostics

/**
 * Clean Gateway Console UI for Android Companion
 * Material3 Styled following the Bento / Aurora Light palette
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GatewayConsoleScreen(
    isServiceRunning: Boolean,
    isGarminConnected: Boolean,
    isCloudConnected: Boolean,
    isSimulationMode: Boolean,
    pendingBufferCount: Int,
    spectatorPin: String,
    sessionName: String,
    serverUrl: String,
    garminDiagnostics: GarminDiagnostics = GarminDiagnostics(),
    onSendTestPing: () -> Unit = {},
    onSendTestNotification: () -> Unit = {},
    onExportHtml: () -> Unit = {},
    onShareExport: () -> Unit = {},
    exportSummaryText: String? = null,
    lastExportUri: Uri? = null,
    targetPace: String = "4:30",
    onTargetPaceChange: (String) -> Unit = {},
    onSessionNameChange: (String) -> Unit,
    onSpectatorPinChange: (String) -> Unit,
    onServerUrlChange: (String) -> Unit,
    onToggleSimulationMode: (Boolean) -> Unit,
    onToggleService: (Boolean) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Running Support Gateway", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A),
                    titleContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF8FAFC))
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Service Toggle Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Servicio en Primer Plano",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = if (isServiceRunning) "Activo (Relé de Red)" else "Detenido",
                            fontSize = 13.sp,
                            color = if (isServiceRunning) Color(0xFF16A34A) else Color(0xFF64748B)
                        )
                    }
                    Switch(
                        checked = isServiceRunning,
                        onCheckedChange = onToggleService
                    )
                }
            }

            // Simulation Mode Toggle Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Simular Carrera (Sin Reloj)",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "Genera telemetría GPS a 1 Hz y pulso virtual para pruebas",
                            fontSize = 12.sp,
                            color = Color(0xFF64748B),
                            lineHeight = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Switch(
                        checked = isSimulationMode,
                        onCheckedChange = onToggleSimulationMode
                    )
                }
            }

            // Session Name / Token Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "NOMBRE / TOKEN DE LA SESIÓN",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = sessionName,
                        onValueChange = onSessionNameChange,
                        enabled = !isServiceRunning,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("carrera-victor") }
                    )
                }
            }

            // Spectator PIN Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "PIN DE ACCESO ESPECTADORES (4 DÍGITOS)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = spectatorPin,
                        onValueChange = onSpectatorPinChange,
                        enabled = !isServiceRunning,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("4829") }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "💡 Los espectadores deben introducir este PIN exacto para conectar",
                        fontSize = 11.sp,
                        color = Color(0xFF64748B)
                    )
                }
            }

            // Target Pace Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "RITMO OBJETIVO (MIN/KM)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = targetPace,
                        onValueChange = onTargetPaceChange,
                        enabled = !isServiceRunning,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("4:30") }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "💡 Ejemplo: 4:30 (se envía a los espectadores como ritmo de referencia)",
                        fontSize = 11.sp,
                        color = Color(0xFF64748B)
                    )
                }
            }

            // Relay Server URL Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "SERVIDOR RELAY WEBSOCKET",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = onServerUrlChange,
                        enabled = !isServiceRunning,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("ws://10.0.2.2:3001/api/ws/session") }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "💡 Emulador: ws://10.0.2.2:3001/api/ws/session\n💡 Móvil físico: usa la IP de tu PC (ej: ws://192.168.1.XX:3001/api/ws/session)",
                        fontSize = 11.sp,
                        color = Color(0xFF64748B),
                        lineHeight = 15.sp
                    )
                }
            }

            // Session Memory & HTML Export Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "REGISTRO Y MEMORIA DE LA SESIÓN",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Sesión: #$sessionName",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = exportSummaryText ?: "Exporta los ánimos y métricas en HTML autónomo",
                                fontSize = 12.sp,
                                color = Color(0xFF64748B)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onExportHtml,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1.5f)
                        ) {
                            Text("📥 Guardar HTML")
                        }

                        OutlinedButton(
                            onClick = onShareExport,
                            enabled = lastExportUri != null,
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF0F172A)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Compartir")
                        }
                    }

                    if (lastExportUri != null) {
                        Text(
                            text = "✓ Guardado en Downloads/RunningSupport",
                            fontSize = 11.sp,
                            color = Color(0xFF16A34A),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Connection Health & Buffer Status
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "ESTADO DE CONEXIONES",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Enlace Garmin BLE / GCM", fontSize = 14.sp, color = Color(0xFF334155))
                        val (garminText, garminColor) = when {
                            isServiceRunning && isSimulationMode -> "SIMULADO" to Color(0xFF16A34A)
                            isSimulationMode -> "SIMULACIÓN LISTA" to Color(0xFF0284C7)
                            garminDiagnostics.isDeviceConnected ->
                                (garminDiagnostics.deviceName?.let { "CONECTADO ($it)" } ?: "CONECTADO") to Color(0xFF16A34A)
                            isGarminConnected -> "CONECTADO" to Color(0xFF16A34A)
                            else -> "DESCONECTADO" to Color(0xFFDC2626)
                        }
                        Text(
                            text = garminText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = garminColor
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Pantalla de Datos (1 Hz)", fontSize = 14.sp, color = Color(0xFF334155))
                        val (streamText, streamColor) = when {
                            isServiceRunning && isSimulationMode -> "EMITIENDO (1 Hz)" to Color(0xFF16A34A)
                            garminDiagnostics.packetsReceivedCount > 0 ->
                                "RECIBIENDO (${garminDiagnostics.packetsReceivedCount} pts)" to Color(0xFF16A34A)
                            isServiceRunning && garminDiagnostics.isDeviceConnected ->
                                "ESPERANDO ACTIVIDAD" to Color(0xFFD97706)
                            else -> "INACTIVO" to Color(0xFF64748B)
                        }
                        Text(
                            text = streamText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = streamColor
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Servidor Nube (WebSocket)", fontSize = 14.sp, color = Color(0xFF334155))
                        Text(
                            text = if (isCloudConnected) "EN LÍNEA" else "DESCONECTADO",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isCloudConnected) Color(0xFF16A34A) else Color(0xFFDC2626)
                        )
                    }

                    HorizontalDivider(color = Color(0xFFE2E8F0))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Buffer Local (Room)", fontSize = 14.sp, color = Color(0xFF334155))
                        Text(
                            text = "$pendingBufferCount pts pendientes",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (pendingBufferCount > 0) Color(0xFFD97706) else Color(0xFF16A34A)
                        )
                    }
                }
            }

            // Panel de Diagnóstico Garmin Connect IQ
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "DIAGNÓSTICO GARMIN CONNECT IQ",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Estado SDK", fontSize = 13.sp, color = Color(0xFF475569))
                        Text(
                            garminDiagnostics.sdkStatus,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (garminDiagnostics.sdkStatus.contains("Listo") || garminDiagnostics.sdkStatus.contains("Simulación")) Color(0xFF16A34A) else Color(0xFF64748B)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Reloj Detectado", fontSize = 13.sp, color = Color(0xFF475569))
                        Text(
                            garminDiagnostics.deviceName ?: "Ninguno",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (garminDiagnostics.deviceName != null) Color(0xFF0F172A) else Color(0xFF94A3B8)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("App DataField Registrada", fontSize = 13.sp, color = Color(0xFF475569))
                        Text(
                            if (garminDiagnostics.isAppRegistered) "SÍ (UUID OK)" else "NO",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (garminDiagnostics.isAppRegistered) Color(0xFF16A34A) else Color(0xFFDC2626)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Telemetría Recibida", fontSize = 13.sp, color = Color(0xFF475569))
                        val hrText = if (garminDiagnostics.lastHeartRate > 0) " (${garminDiagnostics.lastHeartRate} bpm)" else ""
                        Text(
                            "${garminDiagnostics.packetsReceivedCount} paquetes$hrText",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (garminDiagnostics.packetsReceivedCount > 0) Color(0xFF16A34A) else Color(0xFF64748B)
                        )
                    }

                    if (garminDiagnostics.lastTestResult != null) {
                        Card(
                            shape = RoundedCornerShape(8.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F5F9)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = garminDiagnostics.lastTestResult ?: "",
                                fontSize = 12.sp,
                                modifier = Modifier.padding(10.dp),
                                color = if (garminDiagnostics.lastTestResult?.startsWith("✓") == true) Color(0xFF16A34A) else Color(0xFFDC2626)
                            )
                        }
                    }

                    Button(
                        onClick = onSendTestPing,
                        enabled = isServiceRunning,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Probar Conexión con Reloj (Test Ping)")
                    }

                    OutlinedButton(
                        onClick = onSendTestNotification,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF0F172A)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Enviar Notificación de Prueba (Smart Notification)")
                    }

                    if (garminDiagnostics.logs.isNotEmpty()) {
                        Text(
                            text = "ÚLTIMOS EVENTOS GARMIN:",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF94A3B8),
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF0F172A), RoundedCornerShape(6.dp))
                                .padding(8.dp),
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            garminDiagnostics.logs.take(5).forEach { logLine ->
                                Text(
                                    text = logLine,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color(0xFFE2E8F0)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

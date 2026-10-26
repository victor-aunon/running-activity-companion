package com.runningsupport.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Headless Gateway Console Screen (Android 16)
 * IMPORTANT (FR-005): Displays ONLY service state, BLE link, cloud uplink, pending buffer, and spectator PIN.
 * EXPLICITLY displays ZERO running biometrics/metrics (no heart rate, pace, distance, or speed).
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
    serverUrl: String,
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
                        enabled = !isServiceRunning,
                        onCheckedChange = onToggleSimulationMode
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
                        text = "PIN DE ACCESO ESPECTADORES",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = spectatorPin,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.Monospace,
                        color = Color(0xFFEA580C)
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
                        Text("Garmin Fenix 7s (BLE)", fontSize = 14.sp, color = Color(0xFF334155))
                        val (garminText, garminColor) = when {
                            isSimulationMode -> "SIMULADO (1 Hz)" to Color(0xFF16A34A)
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
                        Text("Paquetes en Buffer Local (Room)", fontSize = 14.sp, color = Color(0xFF334155))
                        Text(
                            text = "$pendingBufferCount pts",
                            fontSize = 14.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = if (pendingBufferCount > 0) Color(0xFFEA580C) else Color(0xFF16A34A)
                        )
                    }
                }
            }
        }
    }
}

package com.runningsupport.companion.ui.screens

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
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "🌐 Panel Web: http://localhost:3000/session/${sessionName.ifEmpty { "carrera-victor" }}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0284C7)
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
                            isServiceRunning && isSimulationMode -> "SIMULADO (1 Hz)" to Color(0xFF16A34A)
                            isSimulationMode -> "SIMULACIÓN LISTA" to Color(0xFF0284C7)
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
        }
    }
}

package com.runningsupport.companion.export

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SessionHtmlReportGenerator {

    fun escapeHtml(text: String?): String {
        if (text == null) return ""
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;")
    }

    fun generateHtml(data: SessionSummaryData): String {
        val dateFormat = SimpleDateFormat("dd 'de' MMMM, yyyy", Locale.forLanguageTag("es-ES"))
        val timeFormat = SimpleDateFormat("HH:mm", Locale.forLanguageTag("es-ES"))
        val fullTimeFormat = SimpleDateFormat("HH:mm:ss", Locale.forLanguageTag("es-ES"))

        val startDate = Date(data.startedAt)
        val formattedDate = dateFormat.format(startDate)
        val startTimeStr = timeFormat.format(startDate)
        val endTimeStr = if (data.endedAt != null) timeFormat.format(Date(data.endedAt)) else "En curso"

        val isCompleted = data.status == "COMPLETED" || data.endedAt != null
        val statusLabel = if (isCompleted) "FINALIZADA" else "EN CURSO"
        val statusBg = if (isCompleted) "rgba(34, 197, 94, 0.15)" else "rgba(56, 189, 248, 0.15)"
        val statusColor = if (isCompleted) "#4ade80" else "#38bdf8"
        val statusBorder = if (isCompleted) "rgba(34, 197, 94, 0.3)" else "rgba(56, 189, 248, 0.3)"

        val startGpsText = data.startGps?.toFormattedString() ?: "No disponible"
        val endGpsLabel = if (isCompleted) "Coordenadas de Meta" else "Última posición conocida"
        val endGpsText = data.endGps?.toFormattedString() ?: "No disponible"

        val cheersHtml = StringBuilder()
        if (data.cheers.isEmpty()) {
            cheersHtml.append("""
                <div class="empty-state">
                  <div class="empty-icon">🏁</div>
                  <h3>Carrera completada sin ánimos registrados</h3>
                  <p>¡Gran esfuerzo completando la actividad en solitario!</p>
                </div>
            """.trimIndent())
        } else {
            cheersHtml.append("""<div class="timeline">""")
            for (cheer in data.cheers) {
                val isAck = cheer.status == "AGRADECIDO" || !cheer.runnerReplyText.isNullOrBlank()
                val nodeColor = if (isAck) "#9333ea" else "#0284c7"
                val statusText = if (isAck) "Agradecido" else "Enviado"
                val statusBadgeClass = if (isAck) "badge-ack" else "badge-sent"
                val cheerTime = fullTimeFormat.format(Date(cheer.receivedAt))

                cheersHtml.append("""
                    <div class="timeline-item">
                      <div class="timeline-dot" style="background: $nodeColor; box-shadow: 0 0 0 2px $nodeColor;"></div>
                      <div class="timeline-meta">
                        <span class="km-pill">${escapeHtml(cheer.formattedKm)}</span>
                        <span class="time-text">Minuto ${escapeHtml(cheer.formattedElapsed)} · $cheerTime</span>
                      </div>
                      <div class="cheer-card" style="border-left: 4px solid $nodeColor;">
                        <div class="cheer-card-header">
                          <span class="sender-name">${escapeHtml(cheer.senderName)}</span>
                          <span class="badge $statusBadgeClass">$statusText</span>
                        </div>
                        <p class="cheer-body">"${escapeHtml(cheer.body)}"</p>
                """)

                if (isAck) {
                    val reply = cheer.runnerReplyText?.ifBlank { null } ?: "${data.athleteName} te lo agradece"
                    cheersHtml.append("""
                        <div class="reply-banner">
                          ❤️ ${escapeHtml(reply)} desde el reloj
                        </div>
                    """)
                }

                cheersHtml.append("""
                      </div>
                    </div>
                """)
            }
            cheersHtml.append("""</div>""")
        }

        return """
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registro de Sesión - #${escapeHtml(data.sessionId)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b1120;
      color: #f8fafc;
      line-height: 1.5;
      padding: 1.5rem 1rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    /* Bento Header */
    .bento-header {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .session-badge {
      font-size: 0.7rem;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .session-token {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-left: 0.4rem;
    }
    .session-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: #ffffff;
      margin-top: 0.25rem;
      letter-spacing: -0.02em;
    }
    .session-meta {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-top: 0.35rem;
    }
    .status-badge {
      background: $statusBg;
      color: $statusColor;
      border: 1px solid $statusBorder;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .gps-summary {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin: 1rem 0;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.8rem;
      color: #cbd5e1;
      flex-wrap: wrap;
    }
    .gps-item strong {
      color: #f8fafc;
    }
    /* Metric Tiles */
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .metric-card {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 0.75rem 0.5rem;
      text-align: center;
    }
    .metric-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metric-val {
      font-size: 1.35rem;
      font-weight: 800;
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 0.2rem;
    }
    .metric-val.pace {
      color: #38bdf8;
    }
    .metric-val.cheers {
      color: #c084fc;
    }
    .metric-unit {
      font-size: 0.75rem;
      color: #94a3b8;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    /* Timeline Section */
    .timeline-container {
      background: #ffffff;
      border-radius: 16px;
      padding: 1.5rem;
      color: #0f172a;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #f1f5f9;
    }
    .timeline-title {
      font-size: 1.1rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
    }
    .timeline-subtitle {
      font-size: 0.75rem;
      color: #64748b;
    }
    .timeline {
      position: relative;
      padding-left: 2rem;
      border-left: 3px solid #e2e8f0;
      margin-left: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .timeline-item {
      position: relative;
    }
    .timeline-dot {
      position: absolute;
      left: -2.6rem;
      top: 0.2rem;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 3px solid #ffffff;
    }
    .timeline-meta {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }
    .km-pill {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.75rem;
      font-weight: 800;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-family: monospace;
    }
    .time-text {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
    }
    .cheer-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.85rem 1rem;
    }
    .cheer-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }
    .sender-name {
      font-weight: 700;
      font-size: 0.95rem;
      color: #0f172a;
    }
    .badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-sent {
      background: #ecfdf5;
      color: #047857;
    }
    .badge-ack {
      background: #f3e8ff;
      color: #7e22ce;
    }
    .cheer-body {
      font-size: 0.9rem;
      color: #334155;
      line-height: 1.4;
    }
    .reply-banner {
      margin-top: 0.5rem;
      padding-top: 0.4rem;
      border-top: 1px dashed #e2e8f0;
      font-size: 0.75rem;
      color: #7e22ce;
      font-weight: 600;
    }
    .empty-state {
      text-align: center;
      padding: 2.5rem 1rem;
      color: #64748b;
    }
    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    .empty-state h3 {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }
    .empty-state p {
      font-size: 0.85rem;
    }
    @media print {
      body { background: #ffffff; color: #000000; padding: 0; }
      .bento-header { background: #f8fafc; border: 1px solid #cbd5e1; color: #000; }
      .session-title, .metric-val { color: #000 !important; }
      .timeline-container { box-shadow: none; border: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Encabezado Bento -->
    <div class="bento-header">
      <div class="header-top">
        <div>
          <span class="session-badge">REGISTRO DE SESIÓN</span>
          <span class="session-token">#${escapeHtml(data.sessionId)}</span>
          <h1 class="session-title">${escapeHtml(data.athleteName)}</h1>
          <p class="session-meta">📅 $formattedDate ($startTimeStr - $endTimeStr)</p>
        </div>
        <span class="status-badge">$statusLabel</span>
      </div>

      <!-- Coordenadas GPS -->
      <div class="gps-summary">
        <div class="gps-item">🏁 <strong>Salida:</strong> $startGpsText</div>
        <div class="gps-item">🎯 <strong>$endGpsLabel:</strong> $endGpsText</div>
      </div>

      <!-- Pastillas Métricas Bento -->
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Distancia</div>
          <div class="metric-val">${String.format(Locale.US, "%.2f", data.totalDistanceKm)} <span class="metric-unit">km</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Ritmo Medio</div>
          <div class="metric-val pace">${data.formattedPace} <span class="metric-unit">/km</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Tiempo Total</div>
          <div class="metric-val">${data.formattedDuration}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Ánimos</div>
          <div class="metric-val cheers">${data.cheers.size} <span class="metric-unit">mensajes</span></div>
        </div>
      </div>
    </div>

    <!-- Muro / Línea Temporal -->
    <div class="timeline-container">
      <div class="timeline-header">
        <h2 class="timeline-title">Línea Temporal de Ánimos</h2>
        <span class="timeline-subtitle">Cronología exacta en carrera</span>
      </div>
      $cheersHtml
    </div>
  </div>
</body>
</html>
        """.trimIndent()
    }
}

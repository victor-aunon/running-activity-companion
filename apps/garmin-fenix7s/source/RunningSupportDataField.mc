import Toybox.WatchUi;
import Toybox.Activity;
import Toybox.Position;
import Toybox.Sensor;
import Toybox.System;
import Toybox.Time;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Application;

class RunningSupportDataField extends WatchUi.DataField {
    private var transmitter as BleTransmitter;
    private var overlay as NotificationBannerOverlay;
    private var seqNumber as Lang.Number = 0;
    private var lastValidLat as Lang.Double = 40.4168d;
    private var lastValidLng as Lang.Double = -3.7038d;
    private var lastHeartRate as Lang.Number = 0;
    private var lastSpeedMps as Lang.Float = 0.0;
    private var isServiceEnabled as Lang.Boolean = true;

    function initialize() {
        DataField.initialize();
        transmitter = new BleTransmitter();
        overlay = new NotificationBannerOverlay();
        transmitter.setCheerCallback(method(:onCheerReceived));
        checkServiceEnabled();
    }

    public function onCheerReceived(cheerData as Lang.Dictionary) as Void {
        // El ánimo se muestra nativamente en el reloj a través de Smart Notification de Android
        var notifId = cheerData.get("notificationId");
        if (notifId != null && transmitter != null) {
            var ackPayload = {
                "type" => "CHEER_STATUS_UPDATE",
                "notificationId" => notifId,
                "status" => "EN_RELOJ",
                "timestamp" => Time.now().value().toLong() * 1000L
            };
            transmitter.transmit(ackPayload);
        }
    }

    // Se invoca cuando el corredor pulsa el botón físico STOP en el reloj
    function onTimerStop() as Void {
        if (transmitter != null) {
            var payload = {
                "type" => "SESSION_STATE_CHANGED",
                "status" => "PAUSED",
                "timestamp" => Time.now().value().toLong() * 1000L
            };
            transmitter.transmit(payload);
        }
    }

    function onTimerPause() as Void {
        onTimerStop();
    }

    // Se invoca cuando el corredor reanuda la actividad tras una pausa
    function onTimerResume() as Void {
        if (transmitter != null) {
            var payload = {
                "type" => "SESSION_STATE_CHANGED",
                "status" => "ACTIVE",
                "timestamp" => Time.now().value().toLong() * 1000L
            };
            transmitter.transmit(payload);
        }
    }

    // Se invoca si el cronómetro se reinicia
    function onTimerReset() as Void {
        if (transmitter != null) {
            var payload = {
                "type" => "SESSION_STATE_CHANGED",
                "status" => "COMPLETED",
                "timestamp" => Time.now().value().toLong() * 1000L
            };
            transmitter.transmit(payload);
        }
    }

    hidden function checkServiceEnabled() as Void {
        try {
            var val = Application.Properties.getValue("ServiceEnabled");
            if (val != null && val instanceof Lang.Boolean) {
                isServiceEnabled = val;
            } else {
                isServiceEnabled = true;
            }
        } catch (ex) {
            isServiceEnabled = true;
        }
    }

    // Called once per second by native Running activity
    function compute(info as Activity.Info) as Void {
        if (!isServiceEnabled) {
            return; // Radio silence when disabled
        }

        try {
            seqNumber++;

            // 1. Position & GPS Quality from native activity or Position module
            var gpsQuality = 0;
            var elevationM = 0.0;

            if (info has :currentLocation && info.currentLocation != null) {
                var degs = info.currentLocation.toDegrees();
                lastValidLat = degs[0];
                lastValidLng = degs[1];
                gpsQuality = (info has :currentLocationAccuracy && info.currentLocationAccuracy != null) ? info.currentLocationAccuracy : 4;
                if (info has :altitude && info.altitude != null) {
                    elevationM = info.altitude.toFloat();
                }
            } else {
                try {
                    var pos = Position.getInfo();
                    if (pos != null && pos.position != null) {
                        var degs = pos.position.toDegrees();
                        lastValidLat = degs[0];
                        lastValidLng = degs[1];
                        gpsQuality = (pos.accuracy != null) ? pos.accuracy : 4;
                        if (pos.altitude != null) {
                            elevationM = pos.altitude.toFloat();
                        }
                    }
                } catch (posEx) {
                    // Position fallback ignored
                }
            }

            // 2. Running Biometrics
            var heartRate = (info.currentHeartRate != null) ? info.currentHeartRate : 0;
            var speedMps = (info.currentSpeed != null) ? info.currentSpeed.toFloat() : 0.0;
            var cadence = (info.currentCadence != null) ? info.currentCadence : 0;
            var totalDistanceM = (info.elapsedDistance != null) ? info.elapsedDistance.toFloat() : 0.0;
            var elapsedSeconds = (info.timerTime != null) ? (info.timerTime / 1000) : 0;

            lastHeartRate = heartRate;
            lastSpeedMps = speedMps;

            var paceSecPerKm = 0.0;
            if (speedMps > 0.1) {
                paceSecPerKm = 1000.0 / speedMps;
            }

            var epochMs = Time.now().value().toLong() * 1000L;

            // 3. Assemble Telemetry Dictionary adhering to schema
            var payload = {
                "type" => "TELEMETRY_SNAPSHOT",
                "seq" => seqNumber,
                "timestamp" => epochMs,
                "coordinates" => {
                    "lat" => lastValidLat,
                    "lng" => lastValidLng,
                    "elevationM" => elevationM,
                    "gpsQuality" => gpsQuality
                },
                "metrics" => {
                    "heartRateBpm" => heartRate,
                    "speedMps" => speedMps,
                    "paceSecPerKm" => paceSecPerKm,
                    "cadenceSpm" => cadence,
                    "totalDistanceM" => totalDistanceM,
                    "elapsedSeconds" => elapsedSeconds
                },
                "deviceHealth" => {
                    "watchBatteryPct" => System.getSystemStats().battery.toNumber()
                }
            };

            transmitter.transmit(payload);
        } catch (ex) {
            System.println("[DATAFIELD] Error in compute(): " + ex.getErrorMessage());
        }
    }

    // Render hook: native data field display plus top cheer banner overlay
    function onUpdate(dc as Graphics.Dc) as Void {
        var bgColor = getBackgroundColor();
        var fgColor = (bgColor == Graphics.COLOR_BLACK) ? Graphics.COLOR_WHITE : Graphics.COLOR_BLACK;

        dc.setColor(fgColor, Graphics.COLOR_TRANSPARENT);

        var width = dc.getWidth();
        var height = dc.getHeight();

        var header = "LIVE RUN #" + seqNumber;
        dc.drawText(width / 2, 4, Graphics.FONT_XTINY, header, Graphics.TEXT_JUSTIFY_CENTER);

        var hrStr = (lastHeartRate > 0) ? (lastHeartRate.toString() + " bpm") : "-- bpm";
        dc.drawText(width / 2, height / 2 - 14, Graphics.FONT_MEDIUM, hrStr, Graphics.TEXT_JUSTIFY_CENTER);

        var txStr = transmitter.getStatusString();
        dc.drawText(width / 2, height - 24, Graphics.FONT_XTINY, txStr, Graphics.TEXT_JUSTIFY_CENTER);
    }

    public function getIsServiceEnabled() as Lang.Boolean {
        return isServiceEnabled;
    }

    public function getTransmitter() as BleTransmitter {
        return transmitter;
    }

    public function getOverlay() as NotificationBannerOverlay {
        return overlay;
    }
}

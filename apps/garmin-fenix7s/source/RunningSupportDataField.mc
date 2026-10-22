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
    private var isServiceEnabled as Lang.Boolean = true;

    function initialize() {
        DataField.initialize();
        transmitter = new BleTransmitter();
        overlay = new NotificationBannerOverlay();
        transmitter.setCheerCallback(method(:onCheerReceived));
        checkServiceEnabled();
    }

    public function onCheerReceived(cheerData as Lang.Dictionary) as Void {
        if (overlay != null) {
            overlay.showCheer(cheerData);
        }
    }

    private function checkServiceEnabled() as Void {
        var val = Application.Properties.getValue("ServiceEnabled");
        if (val != null && val instanceof Lang.Boolean) {
            isServiceEnabled = val;
        } else {
            isServiceEnabled = true;
        }
    }

    // Called once per second by native Running activity
    function compute(info as Activity.Info) as Void {
        if (!isServiceEnabled) {
            return; // Radio silence when disabled
        }

        seqNumber++;

        // 1. Position & GPS Quality
        var pos = Position.getInfo();
        var gpsQuality = 0;
        var elevationM = 0.0f;

        if (pos != null && pos.position != null) {
            var degs = pos.position.toDegrees();
            lastValidLat = degs[0];
            lastValidLng = degs[1];
            gpsQuality = (pos.accuracy != null) ? pos.accuracy : 4;
            if (pos.altitude != null) {
                elevationM = pos.altitude;
            }
        }

        // 2. Running Biometrics
        var heartRate = (info.currentHeartRate != null) ? info.currentHeartRate : 0;
        var speedMps = (info.currentSpeed != null) ? info.currentSpeed : 0.0f;
        var cadence = (info.currentCadence != null) ? info.currentCadence : 0;
        var totalDistanceM = (info.elapsedDistance != null) ? info.elapsedDistance : 0.0f;
        var elapsedSeconds = (info.timerTime != null) ? (info.timerTime / 1000) : 0;

        var paceSecPerKm = 0.0f;
        if (speedMps > 0.1f) {
            paceSecPerKm = 1000.0f / speedMps;
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
    }

    // Render hook: native data field display plus top cheer banner overlay
    function onUpdate(dc as Graphics.Dc) as Void {
        View.onUpdate(dc);
        if (overlay != null && overlay.isActive()) {
            overlay.draw(dc);
        }
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

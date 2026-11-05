import Toybox.Test;
import Toybox.Lang;

(:test)
class RunningSupportDataFieldTest {

    (:test)
    function testPreRunToggleDisabledSilence(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing Garmin Data Field radio silence when disabled...");
        var field = new RunningSupportDataField();
        Test.assertMessage(field.getIsServiceEnabled() != null, "ServiceEnabled property must be resolved");

        var trans = field.getTransmitter();
        Test.assertMessage(trans != null, "Transmitter must be instantiated");
        Test.assertEqualMessage(trans.getBufferSize(), 0, "Initial buffer size must be 0");
        return true;
    }

    (:test)
    function testCircularBufferRetainsTenPackets(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing BleTransmitter circular buffer retains maximum 10 points...");
        var trans = new BleTransmitter();

        // Feed 15 packets into disconnected buffer
        for (var i = 0; i < 15; i++) {
            var packet = { "seq" => i, "timestamp" => 1000L + i };
            trans.bufferPayload(packet);
        }

        // Must cap at 10 and retain FIFO order
        Test.assertEqualMessage(trans.getBufferSize(), 10, "Buffer size must not exceed 10 packets");
        var firstItem = trans.getBufferItem(0);
        Test.assertEqualMessage(firstItem.get("seq"), 5, "Oldest packet dropped; first must be 5");
        var lastItem = trans.getBufferItem(9);
        Test.assertEqualMessage(lastItem.get("seq"), 14, "Latest packet must be 14");
        return true;
    }

    (:test)
    function testCheerOverlayDelivery(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing notification overlay cheer reception...");
        var field = new RunningSupportDataField();
        var overlay = field.getOverlay();
        Test.assertEqualMessage(overlay.isActive(), false, "Overlay must be dormant initially");

        var cheer = {
            "notificationId" => "notif-test-1",
            "senderName" => "Laura",
            "body" => "¡Tú puedes!"
        };
        field.onCheerReceived(cheer);

        Test.assertEqualMessage(overlay.isActive(), true, "Overlay must be active after cheer received");
        Test.assertEqualMessage(overlay.getActiveNotificationId(), "notif-test-1", "Active notification ID must match");
        return true;
    }

    (:test)
    function testPreStartTelemetrySuppressesDistanceAndMarksTimerOff(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing telemetry payload when timerState is OFF/STOPPED before START...");
        var field = new RunningSupportDataField();
        var info = new Activity.Info();
        info.timerState = Activity.TIMER_STATE_OFF;
        info.elapsedDistance = 1500.0f;
        info.timerTime = 0;

        var payload = field.buildTelemetryPayload(info);
        var metrics = payload.get("metrics") as Lang.Dictionary;
        Test.assertEqualMessage(metrics.get("isTimerRunning"), false, "isTimerRunning must be false when timer is OFF");
        Test.assertEqualMessage(metrics.get("totalDistanceM"), 0.0f, "totalDistanceM must be 0.0 before START");
        Test.assertEqualMessage(metrics.get("elapsedSeconds"), 0, "elapsedSeconds must be 0 before START");

        info.timerState = Activity.TIMER_STATE_ON;
        var activePayload = field.buildTelemetryPayload(info);
        var activeMetrics = activePayload.get("metrics") as Lang.Dictionary;
        Test.assertEqualMessage(activeMetrics.get("isTimerRunning"), true, "isTimerRunning must be true when timer is ON");
        Test.assertEqualMessage(activeMetrics.get("totalDistanceM"), 1500.0f, "totalDistanceM must be preserved when timer is ON");

        info.timerState = Activity.TIMER_STATE_PAUSED;
        var pausedPayload = field.buildTelemetryPayload(info);
        var pausedMetrics = pausedPayload.get("metrics") as Lang.Dictionary;
        Test.assertEqualMessage(pausedMetrics.get("isTimerRunning"), false, "isTimerRunning must be false when paused");
        Test.assertEqualMessage(pausedMetrics.get("totalDistanceM"), 1500.0f, "totalDistanceM must be preserved when paused");
        return true;
    }
}

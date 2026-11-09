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

    (:test)
    function testTelemetryThrottlingToThreeSeconds(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing telemetry transmission is throttled to 3-second intervals...");
        var field = new RunningSupportDataField();
        var trans = field.getTransmitter();
        field.setPhoneConnectedOverride(true);
        trans.setPhoneConnectedOverride(true);

        var info = new Activity.Info();
        info.currentHeartRate = 145;
        info.currentSpeed = 3.5f;

        // Tick 1 (1 sec): should update UI HR/speed but NOT transmit
        field.compute(info);
        Test.assertEqualMessage(field.getComputeTicks(), 1, "Compute ticks must be 1");
        Test.assertEqualMessage(trans.getLastTransmittedSeq(), 0, "No transmission on tick 1");

        // Tick 2 (2 sec): should NOT transmit
        field.compute(info);
        Test.assertEqualMessage(field.getComputeTicks(), 2, "Compute ticks must be 2");
        Test.assertEqualMessage(trans.getLastTransmittedSeq(), 0, "No transmission on tick 2");

        // Tick 3 (3 sec): should transmit!
        field.compute(info);
        Test.assertEqualMessage(field.getComputeTicks(), 3, "Compute ticks must be 3");
        Test.assertEqualMessage(trans.getLastTransmittedSeq(), 1, "Transmission must trigger on tick 3");

        // Tick 4 (4 sec): should NOT transmit
        field.compute(info);
        Test.assertEqualMessage(field.getComputeTicks(), 4, "Compute ticks must be 4");
        Test.assertEqualMessage(trans.getLastTransmittedSeq(), 1, "No new transmission on tick 4");

        return true;
    }

    (:test)
    function testPhoneDisconnectedSuppressesTransmission(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing phone disconnection enforces radio silence...");
        var field = new RunningSupportDataField();
        var trans = field.getTransmitter();
        field.setPhoneConnectedOverride(false);
        trans.setPhoneConnectedOverride(false);

        var info = new Activity.Info();
        info.currentHeartRate = 150;

        // Advance 3 ticks (would normally transmit on tick 3)
        field.compute(info);
        field.compute(info);
        field.compute(info);

        Test.assertEqualMessage(field.getComputeTicks(), 3, "Compute ticks reached 3");
        Test.assertEqualMessage(trans.getLastTransmittedSeq(), 0, "No transmission when phone is disconnected");
        return true;
    }

    (:test)
    function testCooldownBackoffAfterTransmissionFailure(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing backoff cooldown window after transmit failure...");
        var trans = new BleTransmitter();
        trans.setPhoneConnectedOverride(true);

        Test.assertEqualMessage(trans.isCoolingDown(), false, "Transmitter must not be cooling down initially");

        var payload = { "type" => "TELEMETRY_SNAPSHOT", "seq" => 1 };
        trans.onTransmitFailed(payload);

        Test.assertEqualMessage(trans.isCoolingDown(), true, "Transmitter must enter cooldown after failure");
        Test.assertEqualMessage(trans.getIsConnected(), false, "Connected state must be false after failure");

        // Trying to transmit while in cooldown must buffer and avoid calling Communications.transmit
        var nextPayload = { "type" => "TELEMETRY_SNAPSHOT", "seq" => 2 };
        trans.transmit(nextPayload);
        Test.assertEqualMessage(trans.getLastTransmittedSeq(), 0, "Transmission must not execute during cooldown");

        return true;
    }

    (:test)
    function testFlushBufferDiscardsStaleTelemetrySnapshots(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing flushBuffer purges stale telemetry snapshots and keeps only latest snapshot + ACKs...");
        var trans = new BleTransmitter();
        trans.setPhoneConnectedOverride(true);

        // Buffer 3 telemetry snapshots and 1 cheer ACK
        trans.bufferPayload({ "type" => "TELEMETRY_SNAPSHOT", "seq" => 1 });
        trans.bufferPayload({ "type" => "TELEMETRY_SNAPSHOT", "seq" => 2 });
        trans.bufferPayload({ "type" => "CHEER_STATUS_UPDATE", "notificationId" => "cheer-99" });
        trans.bufferPayload({ "type" => "TELEMETRY_SNAPSHOT", "seq" => 3 });

        Test.assertEqualMessage(trans.getBufferSize(), 4, "Buffer should have 4 items before flush");

        // Calling purgeStaleTelemetrySnapshots
        trans.purgeStaleTelemetrySnapshots();

        // Must retain only 2 items: cheer ACK and latest telemetry snapshot (seq 3)
        Test.assertEqualMessage(trans.getBufferSize(), 2, "Buffer should retain only latest snapshot and non-telemetry events");

        var item0 = trans.getBufferItem(0);
        var item1 = trans.getBufferItem(1);

        Test.assertEqualMessage(item0.get("type"), "CHEER_STATUS_UPDATE", "Non-telemetry event preserved");
        Test.assertEqualMessage(item1.get("type"), "TELEMETRY_SNAPSHOT", "Latest telemetry snapshot preserved");
        Test.assertEqualMessage(item1.get("seq"), 3, "Preserved snapshot must be the latest (seq 3)");

        return true;
    }
}

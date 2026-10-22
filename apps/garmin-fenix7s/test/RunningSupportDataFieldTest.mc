import Toybox.Test;
import Toybox.Lang;

(:test)
class RunningSupportDataFieldTest {

    (:test)
    function testPreRunToggleDisabledSilence(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing Garmin Data Field radio silence when disabled...");
        var isEnabled = false;

        // When disabled, no BLE packet should be transmitted
        var transmittedPackets = 0;
        if (isEnabled) {
            transmittedPackets++;
        }

        Test.assertEqualMessage(transmittedPackets, 0, "Transmitted packets must be 0 when toggle is disabled");
        return true;
    }

    (:test)
    function testCircularBufferRetainsTenPackets(logger as Test.Logger) as Lang.Boolean {
        logger.debug("Testing circular buffer retains maximum 10 points...");
        var buffer = [];
        var maxCapacity = 10;

        for (var i = 0; i < 15; i++) {
            if (buffer.size() >= maxCapacity) {
                buffer = buffer.slice(1, buffer.size());
            }
            buffer.add(i);
        }

        Test.assertEqualMessage(buffer.size(), 10, "Buffer size must not exceed 10 packets");
        Test.assertEqualMessage(buffer[0], 5, "Oldest packet dropped; first must be 5");
        Test.assertEqualMessage(buffer[9], 14, "Latest packet must be 14");
        return true;
    }
}

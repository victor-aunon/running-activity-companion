import Toybox.WatchUi;
import Toybox.System;
import Toybox.Time;
import Toybox.Lang;

class DataFieldMenuDelegate extends WatchUi.BehaviorDelegate {
    private var transmitter as BleTransmitter;
    private var overlay as NotificationBannerOverlay;

    function initialize(trans as BleTransmitter, ov as NotificationBannerOverlay) {
        BehaviorDelegate.initialize();
        transmitter = trans;
        overlay = ov;
    }

    function onSelect() as Lang.Boolean {
        var notifId = overlay.getActiveNotificationId();
        if (notifId != null) {
            System.println("Runner acknowledged cheer: " + notifId);

            var nowMs = Time.now().value().toLong() * 1000L;
            var replyPayload = {
                "type" => "CHEER_STATUS_UPDATE",
                "notificationId" => notifId,
                "status" => "AGRADECIDO",
                "timestamp" => nowMs
            };

            transmitter.transmit(replyPayload);
            overlay.dismiss();
            return true;
        }
        return false;
    }
}

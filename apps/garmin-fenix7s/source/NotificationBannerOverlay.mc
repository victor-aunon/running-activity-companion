import Toybox.Graphics;
import Toybox.WatchUi;
import Toybox.Attention;
import Toybox.System;
import Toybox.Lang;

class NotificationBannerOverlay {
    private var activeMessage as Lang.Dictionary?;
    private var isVisible as Lang.Boolean = false;
    private var showTimestampMs as Lang.Number = 0;

    function initialize() {
        isVisible = false;
        activeMessage = null;
        showTimestampMs = 0;
    }

    public function showCheer(cheerData as Lang.Dictionary) as Void {
        activeMessage = cheerData;
        isVisible = true;
        showTimestampMs = System.getTimer();

        // 2 subtle haptic vibration pulses for incoming cheer notification
        if (Attention has :vibrate) {
            try {
                var vibeData = [
                    new Attention.VibeProfile(50, 200),
                    new Attention.VibeProfile(0, 100),
                    new Attention.VibeProfile(75, 300)
                ];
                Attention.vibrate(vibeData);
            } catch (ex) {
                System.println("[OVERLAY] Error vibrate: " + ex.getErrorMessage());
            }
        }

        WatchUi.requestUpdate();
    }

    public function dismiss() as Void {
        isVisible = false;
        activeMessage = null;
        WatchUi.requestUpdate();
    }

    public function draw(dc as Graphics.Dc) as Void {
        if (!isVisible || activeMessage == null) {
            return;
        }

        // Auto-dismissal after 7 seconds
        var now = System.getTimer();
        if (now - showTimestampMs > 7000) {
            isVisible = false;
            activeMessage = null;
            return;
        }

        var width = dc.getWidth();
        var height = dc.getHeight();

        // Elegant top notification pill (similar to native smartwatch notifications)
        var pillWidth = (width * 0.90).toNumber();
        var pillHeight = 56;
        var pillX = (width - pillWidth) / 2;
        var pillY = 12;

        // Dark pill background
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.fillRoundedRectangle(pillX, pillY, pillWidth, pillHeight, 8);

        // Thin orange border
        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(pillX, pillY, pillWidth, pillHeight, 8);

        // Sender Header
        var sender = activeMessage.get("senderName");
        var header = (sender != null) ? ("ÁNIMO DE " + sender.toString().toUpper()) : "NUEVO ÁNIMO";

        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(
            width / 2,
            pillY + 4,
            Graphics.FONT_XTINY,
            header,
            Graphics.TEXT_JUSTIFY_CENTER
        );

        // Message Body
        var body = activeMessage.get("body");
        if (body != null) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(
                width / 2,
                pillY + 20,
                Graphics.FONT_TINY,
                body,
                Graphics.TEXT_JUSTIFY_CENTER
            );
        }

        // Optional Lap indicator
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(
            width / 2,
            pillY + 38,
            Graphics.FONT_XTINY,
            "[Lap] Agradecer",
            Graphics.TEXT_JUSTIFY_CENTER
        );
    }

    public function getActiveNotificationId() as Lang.String? {
        if (isVisible && activeMessage != null) {
            return activeMessage.get("notificationId") as Lang.String?;
        }
        return null;
    }

    public function isActive() as Lang.Boolean {
        return isVisible;
    }
}

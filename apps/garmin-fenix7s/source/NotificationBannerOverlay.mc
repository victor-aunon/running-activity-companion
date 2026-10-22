import Toybox.Graphics;
import Toybox.WatchUi;
import Toybox.Attention;
import Toybox.Timer;
import Toybox.Lang;

class NotificationBannerOverlay {
    private var activeMessage as Lang.Dictionary?;
    private var isVisible as Lang.Boolean = false;
    private var dismissTimer as Timer.Timer?;

    function initialize() {
        dismissTimer = new Timer.Timer();
    }

    public function showCheer(cheerData as Lang.Dictionary) as Void {
        activeMessage = cheerData;
        isVisible = true;

        // Trigger 2 haptic vibration pulses
        if (Attention has :vibrate) {
            var vibeData = [
                new Attention.VibeProfile(50, 200),
                new Attention.VibeProfile(0, 100),
                new Attention.VibeProfile(75, 300)
            ];
            Attention.vibrate(vibeData);
        }

        // 7-second auto-dismissal
        if (dismissTimer != null) {
            dismissTimer.start(method(:dismiss), 7000, false);
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

        var width = dc.getWidth();
        var height = dc.getHeight();
        var bannerHeight = (height * 0.30).toNumber();

        // Top banner background
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.fillRectangle(0, 0, width, bannerHeight);

        // Amber border
        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawLine(0, bannerHeight - 1, width, bannerHeight - 1);

        // Sender & Message
        var sender = activeMessage.get("senderName");
        var body = activeMessage.get("body");

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        if (sender != null) {
            dc.drawText(
                width / 2,
                4,
                Graphics.FONT_XTINY,
                sender,
                Graphics.TEXT_JUSTIFY_CENTER
            );
        }
        if (body != null) {
            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(
                width / 2,
                22,
                Graphics.FONT_TINY,
                body,
                Graphics.TEXT_JUSTIFY_CENTER
            );
        }

        // Action prompt
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(
            width / 2,
            bannerHeight - 16,
            Graphics.FONT_XTINY,
            "[Select] Responder",
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

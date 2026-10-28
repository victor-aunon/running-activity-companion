import Toybox.Communications;
import Toybox.System;
import Toybox.Lang;

class BleTransmitter {
    private var isConnected as Lang.Boolean = true;
    private var isTransmitting as Lang.Boolean = false;
    private var transmitStartTimeMs as Lang.Number = 0;
    private var ringBuffer as Lang.Array<Lang.Dictionary> = [];
    private const MAX_BUFFER_SIZE = 10;
    private var cheerCallback as Method?;
    private var lastSeq as Lang.Number = 0;

    function initialize() {
        ringBuffer = [];
        isConnected = true;
        isTransmitting = false;
        transmitStartTimeMs = 0;
        setupListener();
    }

    hidden function setupListener() as Void {
        if (Communications has :registerForPhoneAppMessages) {
            Communications.registerForPhoneAppMessages(method(:onPhoneAppMessage));
        }
        if (Communications has :setMailboxListener) {
            Communications.setMailboxListener(method(:onMailboxMessage));
        }
    }

    public function setCheerCallback(callback as Method?) as Void {
        cheerCallback = callback;
    }

    public function transmit(payload as Lang.Dictionary) as Void {
        if (payload.hasKey("seq")) {
            lastSeq = payload["seq"] as Lang.Number;
        }

        var now = System.getTimer();
        // Si una transmisión previa se queda congelada más de 3 segundos, liberar canal
        if (isTransmitting && (now - transmitStartTimeMs > 3000)) {
            System.println("[BLE] Transmisión anterior expirada (>3s), liberando canal");
            isTransmitting = false;
        }

        if (!isTransmitting) {
            isTransmitting = true;
            transmitStartTimeMs = now;
            var listener = new CommListener(self, payload);
            try {
                Communications.transmit(payload, null, listener);
            } catch (ex) {
                System.println("[BLE] Error transmit: " + ex.getErrorMessage());
                onTransmitFailed(payload);
            }
        } else {
            bufferPayload(payload);
        }
    }

    public function bufferPayload(payload as Lang.Dictionary) as Void {
        if (ringBuffer.size() >= MAX_BUFFER_SIZE) {
            // Drop oldest packet (FIFO) to strictly protect heap
            ringBuffer = ringBuffer.slice(1, ringBuffer.size());
        }
        ringBuffer.add(payload);
    }

    public function onTransmitSuccess() as Void {
        isTransmitting = false;
        isConnected = true;
        flushBuffer();
    }

    public function onTransmitFailed(failedPayload as Lang.Dictionary) as Void {
        isTransmitting = false;
        isConnected = false;
        bufferPayload(failedPayload);
    }

    hidden function flushBuffer() as Void {
        if (!isTransmitting && ringBuffer.size() > 0) {
            var nextPayload = ringBuffer[0];
            ringBuffer = ringBuffer.slice(1, ringBuffer.size());
            transmit(nextPayload);
        }
    }

    public function onPhoneAppMessage(msg as Communications.PhoneAppMessage) as Void {
        System.println("[BLE] Received PhoneAppMessage from companion");
        var data = msg.data;
        if (cheerCallback != null && data instanceof Lang.Dictionary) {
            cheerCallback.invoke(data as Lang.Dictionary);
        }
    }

    public function onMailboxMessage(mailIter as Communications.MailboxIterator) as Void {
        var msg = mailIter.next();
        while (msg != null) {
            System.println("[BLE] Received Mailbox packet from companion");
            if (cheerCallback != null && msg instanceof Lang.Dictionary) {
                cheerCallback.invoke(msg as Lang.Dictionary);
            }
            msg = mailIter.next();
        }
        Communications.emptyMailbox();
    }

    public function getStatusString() as Lang.String {
        if (!isConnected) {
            return "REINTENTO (" + ringBuffer.size() + ")";
        }
        if (isTransmitting) {
            return "ENVIANDO #" + lastSeq;
        }
        return "BLE OK #" + lastSeq;
    }

    public function getIsConnected() as Lang.Boolean {
        return isConnected;
    }

    public function getBufferSize() as Lang.Number {
        return ringBuffer.size();
    }

    public function getBufferItem(index as Lang.Number) as Lang.Dictionary {
        return ringBuffer[index];
    }
}

class CommListener extends Communications.ConnectionListener {
    private var transmitter as BleTransmitter;
    private var payload as Lang.Dictionary;

    function initialize(trans as BleTransmitter, data as Lang.Dictionary) {
        ConnectionListener.initialize();
        transmitter = trans;
        payload = data;
    }

    function onComplete() {
        transmitter.onTransmitSuccess();
    }

    function onError() {
        transmitter.onTransmitFailed(payload);
    }
}

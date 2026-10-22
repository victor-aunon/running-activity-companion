import Toybox.Communications;
import Toybox.System;
import Toybox.Timer;
import Toybox.Lang;

class BleTransmitter {
    private var isConnected as Lang.Boolean = false;
    private var ringBuffer as Lang.Array<Lang.Dictionary> = [];
    private const MAX_BUFFER_SIZE = 10;
    private var retryTimer as Timer.Timer?;
    private var cheerCallback as (Lang.Method(cheerData as Lang.Dictionary) as Void)?;

    function initialize() {
        ringBuffer = [];
        retryTimer = new Timer.Timer();
        setupListener();
    }

    private function setupListener() as Void {
        Communications.setMailboxListener(method(:onMailboxMessage));
    }

    public function setCheerCallback(callback as (Lang.Method(cheerData as Lang.Dictionary) as Void)) as Void {
        cheerCallback = callback;
    }

    public function transmit(payload as Lang.Dictionary) as Void {
        if (isConnected) {
            var listener = new CommListener(self, payload);
            Communications.transmit(payload, null, listener);
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
        scheduleRetry();
    }

    public function onTransmitSuccess() as Void {
        isConnected = true;
        flushBuffer();
    }

    public function onTransmitFailed(failedPayload as Lang.Dictionary) as Void {
        isConnected = false;
        bufferPayload(failedPayload);
    }

    private function scheduleRetry() as Void {
        if (retryTimer != null) {
            retryTimer.start(method(:onRetryTrigger), 5000, false);
        }
    }

    public function onRetryTrigger() as Void {
        if (ringBuffer.size() > 0) {
            var nextPayload = ringBuffer[0];
            ringBuffer = ringBuffer.slice(1, ringBuffer.size());
            var listener = new CommListener(self, nextPayload);
            Communications.transmit(nextPayload, null, listener);
        }
    }

    private function flushBuffer() as Void {
        if (ringBuffer.size() > 0) {
            var nextPayload = ringBuffer[0];
            ringBuffer = ringBuffer.slice(1, ringBuffer.size());
            transmit(nextPayload);
        }
    }

    public function onMailboxMessage(mailIter as Communications.MailboxIterator) as Void {
        var msg = mailIter.next();
        while (msg != null) {
            System.println("Received incoming BLE packet from Android companion");
            if (cheerCallback != null && msg instanceof Lang.Dictionary) {
                cheerCallback.invoke(msg as Lang.Dictionary);
            }
            msg = mailIter.next();
        }
        Communications.emptyMailbox();
    }

    public function getBufferSize() as Lang.Number {
        return ringBuffer.size();
    }

    public function getBufferItem(index as Lang.Number) as Lang.Dictionary {
        return ringBuffer[index];
    }

    public function getIsConnected() as Lang.Boolean {
        return isConnected;
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

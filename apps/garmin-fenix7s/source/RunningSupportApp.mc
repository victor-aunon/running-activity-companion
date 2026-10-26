import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class RunningSupportApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Lang.Dictionary?) as Void {
    }

    function onStop(state as Lang.Dictionary?) as Void {
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        var view = new RunningSupportDataField();
        return [ view ];
    }
}

function getApp() as RunningSupportApp {
    return Application.getApp() as RunningSupportApp;
}

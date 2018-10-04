// importScripts('sensorEvent.js');
// importScripts('nstrumenta.js');

function Algorithm(){

var nstrumenta;

var inputEvents = [];
var metaEvents = [];
var downsampleTimestamp = 0;

self.onmessage = function(e) {
    switch (e.data.type) {
    case 'inputEvents':
        self.inputEvents = e.data.payload;
        self.postMessage('loaded inputEvents.length = ' + self.inputEvents.length);
        break;
    case 'metaEvents':
        self.metaEvents = e.data.payload;
        self.postMessage('loaded metaEvents.length = ' + self.metaEvents.length);
        break;
    case 'loadAlgorithm':
        eval(e.data.payload);//# sourceURL=js/nstrumenta.js`;
        self.postMessage('loaded Algorithm');
        nstrumenta = new Module.Nstrumenta();
        break;
    case 'run':
        self.run(e.data.payload);
        break;
    case 'init':
        nstrumenta = new Module.Nstrumenta();
        break;
    case 'update':
        self.update(e.data.payload);
        break;
    }
}

//this method is called from nstrumenta
function outputEventMsg(msg) {
    var event = SensorEventUtils.eventFromMsg(msg);
    self.postMessage({
        type: 'sensorEvent',
        payload: event
    });
}

self.run = function(options) {
    var options = options || {};
    nstrumenta = new Module.Nstrumenta();
    var metaIndex = 0;
    var downsampleTimestamp = 0;

    var inputIndex = 0;
    while (inputIndex < inputEvents.length) {
        var event;

        event = inputEvents[inputIndex++];

        if ([65666, 1001, 1002].includes(event.id)) {
            self.postMessage({
                type: 'sensorEvent',
                payload: event
            });
        }

        //check for NaN values
        var values = [];
        for (i = 0; i < 8; i++) {
            values[i] = event.values[i];
            if (isNaN(values[i]))
                values[i] = 0;
        }
        nstrumenta.reportEvent(event.timestamp, event.id, event.values.length, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]);
    }
    self.postMessage({
        type: 'runComplete',
        payload: event
    });
}

var downsampleTimestamp = 0;
self.update = function(event) {
    nstrumenta.reportEvent(event.timestamp, event.id, event.values.length, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]);
}

}

algorithmWorker = new Algorithm();
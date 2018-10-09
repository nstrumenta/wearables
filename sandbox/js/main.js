var useLocalStorage = false;
var needsToRender = true;
var outputEvents = [];

var nst_project = {
    "parameters":
        [
            { "id": "imu_data.acc_offset.x", "name": "acc offset x", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.acc_offset.y", "name": "acc offset y", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.acc_offset.z", "name": "acc offset z", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.acc_scale.x", "name": "acc scale x", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.acc_scale.y", "name": "acc scale y", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.acc_scale.z", "name": "acc scale z", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.mag_offset.x", "name": "mag offset x", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.mag_offset.y", "name": "mag offset y", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.mag_offset.z", "name": "mag offset z", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.mag_scale.x", "name": "mag scale x", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.mag_scale.y", "name": "mag scale y", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.mag_scale.z", "name": "mag scale z", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.gyro_offset.x", "name": "gyro offset x", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.gyro_offset.y", "name": "gyro offset y", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.gyro_offset.z", "name": "gyro offset z", "value": 0, "min": -1e2, "max": 1e2, "step": 1e-5 },
            { "id": "imu_data.gyro_scale.x", "name": "gyro scale x", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.gyro_scale.y", "name": "gyro scale y", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.gyro_scale.z", "name": "gyro scale z", "value": 1, "min": -2, "max": 2, "step": 1e-5 },
            { "id": "imu_data.madgwick_gain", "name": "accel gain", "value": 0.022, "min": 0, "max": 1, "step": 1e-4 },
            { "id": "imu_data.angularrate_mag", "name": "mag gain", "value": 0.022, "min": -1, "max": 1, "step": 1e-5 }
        ]
}

window.onmessage = function (message) {
    console.log(message);
    // //     console.log(data);
    //     var event = new SensorEvent(data.sensorTimeNs,data.id,data.values);
    //     events.push(event);
    //     renderEvent('js-',event);
    //     algorithmUpdate(event);
    //     setControllerRanges();
};


var scenes = {};

class Scene {
    constructor(id, sceneUrl) {
        var self = this;
        this.id = id;
        this.plotName = "view:" + this.id;

        this.renderer = new THREE.WebGLRenderer();

        this.renderer.setClearColor(0xacacac);

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);

        this.camera.position.set(0, 20, 100);

        self.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

        this.render = function () {
            self.renderer.render(self.scene, self.camera);
        }


        this.animate = function () {
            window.requestAnimationFrame(self.animate);
            self.controls.update();
            self.render();
        }

        // instantiate a loader
        var loader = new THREE.ObjectLoader();

        // load a resource
        loader.load(
            // resource URL
            sceneUrl,

            // onLoad callback
            function (obj) {
                // Add the loaded object to the scene
                self.scene.add(obj);
                //start animating
                self.animate();
            },

            // onProgress callback
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },

            // onError callback
            function (err) {
                console.log('An error happened');
            }
        );


        myLayout.registerComponent(this.plotName, function (container, state) {
            container.getElement().html('<div id="' + state.componentName + '"></div>');
            container.on('resize', function () {
                self.camera.aspect = container.width / container.height;
                self.camera.updateProjectionMatrix();

                self.renderer.setSize(container.width, container.height);

            });

            container.getElement()[0].appendChild(self.renderer.domElement);
        })

    }
}


var config = {
    labels: {
        popout: false
    },
    content: [{
        type: 'row',
        content: [{
            type: 'component',
            componentName: 'view:bluecoin',
            componentState: {
                label: 'A'
            }
        }, {
            type: 'column',
            content: [{
                type: 'component',
                componentName: 'controls',
                componentState: {
                    label: 'B'
                }
            }, {
                type: 'stack',
                content: []
            }]
        }]
    }]
};

var myLayout;

var savedState = null;//localStorage.getItem('savedState');

if (savedState !== null) {
    myLayout = new GoldenLayout(JSON.parse(savedState));
} else {
    myLayout = new GoldenLayout(config);
}

myLayout.on('stateChanged', function () {
    try {
        var state = JSON.stringify(myLayout.toConfig());
        localStorage.setItem('savedState', state);
    } catch (e) {
        console.log('layout not saved: ' + e)
    }
});



//create view:bluecoin
scenes['bluecoin'] = new Scene('bluecoin', 'scenes/bluecoin_scene.json');


myLayout.registerComponent('controls', function (container, componentState) {

    container.getElement().append(gui.domElement);

    container.on('resize', function () {
        gui.width = container.width;
    });
});

myLayout.registerComponent('figures', function (container, componentState) { });

myLayout.init();


//plotting begin

var plots = {};

var labels = {
    1: {
        name: 'Accelerometer',
        type: 'input',
        traces: ['x', 'y', 'z']
    },
    2: {
        name: 'Magnetometer',
        type: 'input',
        traces: ['x', 'y', 'z']
    },
    4: {
        name: 'Gyro',
        type: 'input',
        traces: ['x', 'y', 'z']
    },
    6: {
        name: 'Pressure',
        type: 'input',
        traces: ['P (mB)']
    },
    7: {
        name: 'Temperature',
        type: 'input',
        traces: ['Temp(ÃÂ°C)']
    },
    11: {
        name: 'Rotation Vector',
        type: 'input',
        traces: ['x', 'y', 'z', 'w']
    },
    20: {
        name: 'Geomagnetic Rotation Vector',
        type: 'input',
        traces: ['x', 'y', 'z', 'w']
    },
    65666: {
        name: 'GPS',
        type: 'input',
        traces: ['latitude', 'longitude', 'orthometric height', 'ellipsoidal height', 'bias    (when available or 0)', 'Quality Indicator', 'DOP (meters)', 'speed over ground(km/h)', 'True course over ground (degree)']
    },
    65667: {
        name: 'Vehicle Data',
        type: 'input',
        traces: ['Vehicle speed (kph)', 'Yaw rate (Degree/Sec)', 'Stering Wheel (Degree)', 'Front Left Wheel Speed (kph)', 'Front Right Wheel Speed (kph)', 'Rear Left Wheel Speed (kph)', 'Rear Right Wheel Speed (kph)']
    },
    28: {
        name: 'Fused Location (6DOF)',
        type: 'computed',
        traces: ['quaternion x', 'quaternion y', 'quaternion z', 'quaternion w', 'position x', 'position y', 'position z']
    },
    302: {
        name: 'Fused Location (Geo coords)',
        type: 'computed',
        traces: ['lat', 'lng', 'previous lat', 'previous lng']
    },
    1002: {
        name: 'Truth Point (Geo coords)',
        type: 'computed',
        traces: ['lat', 'lng', 'altitude']
    },
    1003: {
        name: 'Angular Error (Fused vs. Applanix)',
        type: 'computed',
        traces: ['error mag (degrees)', 'heading difference mag (degrees)', 'error gyro (degrees)', 'heading difference gyro (degrees)', 'heading(applanix)', 'pitch(applanix)', 'roll(applanix)', 'heading(gyro)', 'pitch(gyro)', 'roll(gyro)', 'applanix delta angle']
    },
    1006: {
        name: 'Magnetic Field (Filtered vs. Applanix with World Magnetic Model)',
        type: 'computed',
        traces: ['mag error magnitude', 'unfiltered x', 'unfiltered y', 'unfiltered z', 'unfiltered total', 'filtered x', 'filtered y', 'filtered z', 'filtered total', 'applanix x', 'applanix y', 'applanix z', 'applanix total',]
    },
    1008: {
        name: 'Fused Mag',
        type: 'computed',
        traces: ['latitude', 'longitude', 'altitude', 'roll (degree)', 'pitch (degree)', 'heading (degree)', 'speed (mps)']

    },
    1009: {
        name: 'Fused Gyro',
        type: 'computed',
        traces: ['latitude', 'longitude', 'altitude', 'roll (degree)', 'pitch (degree)', 'heading (degree)', 'speed (mps)']

    },
    1010: {
        name: 'Position',
        type: 'computed',
        traces: ['Position error magnitude (mag)', 'Position error magnitude (gyro)', 'mag x', 'mag y', 'mag z', 'gyro x', 'gyro y', 'gyro z', 'applanix x', 'applanix y', 'applanix z', 'applanix total',]
    },
    1011: {
        name: 'Fused VDR',
        type: 'computed',
        traces: ['latitude', 'longitude', 'altitude', 'roll (degree)', 'pitch (degree)', 'heading (degree)', 'speed (mps)']
    },

    2000: {
        name: 'Pose',
        type: 'computed',
        traces: ['quaternion x', 'quaternion y', 'quaternion z', 'quaternion w', 'position x', 'position y', 'position z']
    },
    2001: {
        name: 'Pitch and Roll',
        type: 'computed',
        traces: ['Pitch and Roll Error', 'Acc+Mag heading', 'Acc pitch', 'Acc roll', 'Gyro-prop heading', 'Gyro-prop pitch', 'Gyro-prop roll']
    },
    3000: {
        name: 'Bluecoin',
        type: 'input',
        traces: []
    },
    3001: {
        name: 'Trax',
        type: 'input',
        traces: ['Acc x', 'Acc y', 'Acc z', 'Gyro x', 'Gyro y', 'Gyro z', 'Mag x', 'Mag y', 'Mag z']
    },

}

function getPlotName(id) {
    if (labels.hasOwnProperty(id)) {
        return labels[id].name;
    }
    return 'sensor:' + id;
}

function updatePlots() {
    for (index in plots) {
        plots[index].update();
    }
}

function clearEventData() {
    for (index in plots) {
        plots[index].clearData();
    }
    updatePlots();
    events = [];
}

function clearOutputPlotData() {
    for (index in plots) {
        if (!(labels.hasOwnProperty(plots[index].id) && (labels[plots[index].id].type == 'input'))) {
            plots[index].clearData();
        }
    }
}

var lastPlotUpdate = 0;
function addEventToPlots(event) {
    var plotId = event.id;
    if (!plots.hasOwnProperty(plotId)) {
        plots[plotId] = new Plot(plotId, event);
    }
    plots[plotId].addEvent(event);

    //rate limit update plots
    var now = (new Date()).getTime();
    if (parameters.updatePlotsOnEvent && (now - lastPlotUpdate > parameters.plotUpdateInterval)) {
        lastPlotUpdate = now;
        updatePlots();
    }
}


class Plot {
    constructor(id, event) {
        this.id = id;
        this.plotName = getPlotName(this.id);
        this.data = [];
        for (var i = 0; i < event.values.length; i++) {
            var emptyTrace = {
                x: [],
                y: []
            };
            if (labels.hasOwnProperty(this.id)) {
                if (labels[this.id].traces[i] != null) {
                    emptyTrace.name = labels[this.id].traces[i];
                }
            }

            this.data.push(emptyTrace);
        }
        ; myLayout.registerComponent(this.plotName, function (container, state) {
            container.getElement().html('<div id="' + state.componentName + '"></div>');
            container.on('resize', function () {
                var update = {
                    width: container.width,
                    height: container.height
                };
                if (document.getElementById(state.componentName) != null) {
                    try {
                        Plotly.relayout(state.componentName, update);
                    } catch (e) {
                        console.log(e);
                    }
                }

            });
        })
        if (myLayout.root.contentItems[0].contentItems[1].contentItems[1] != null) {
            myLayout.root.contentItems[0].contentItems[1].contentItems[1].addChild({
                type: 'component',
                componentName: this.plotName
            })
        }
        else {
            myLayout.root.contentItems[0].addChild({
                type: 'component',
                componentName: this.plotName
            })
        }

        Plotly.react(this.plotName, this.data, {}, {
            displayModeBar: false
        });
    }
    clearData() {
        for (var i = 0; i < this.data.length; i++) {
            this.data[i].x = [];
            this.data[i].y = [];
        }
        //this.update()
    }

    addEvent(event) {
        for (var i = 0; i < this.data.length; i++) {
            this.data[i].x.push(event.timestamp);
            this.data[i].y.push(event.values[i]);
        }
    }
    update() {
        Plotly.react(this.plotName, this.data, { datarevision: Date.now() }, {
            displayModeBar: false
        });
    }

}

//plotting end


var keypressListener = new keypress.Listener();
keypressListener.register_many([{
    "keys": "x",
    "on_keydown": function () {
        moveHeadIndex(1);
    }
}, {
    "keys": "z",
    "on_keydown": function () {
        moveHeadIndex(-1);
    }
}, {
    "keys": "X",
    "on_keydown": function () {
        for (var i = 0; i < 50; i++) {
            moveHeadIndex(1);
        }
    }
}, {
    "keys": "Z",
    "on_keydown": function () {
        for (var i = 0; i < 50; i++) {
            moveHeadIndex(-1);
        }
    }
}]);

function moveHeadIndex(amount) {
    if (headIndex < 0) {
        headIndex = 0;
    }
    if (headIndex > outputEvents.length) {
        headIndex = outputEvents.length - 1;
    }
    while ((amount > 0) && (headIndex < outputEvents.length - 1)) {
        amount--;
        headIndex++;
        renderEvent('transport-', outputEvents[headIndex]);
        parameters.transportControlTime = outputEvents[headIndex].timestamp;
    }
    ; while ((amount < 0) && (headIndex > 0)) {
        amount++;
        headIndex--;
        renderEvent('transport-', outputEvents[headIndex]);
        parameters.transportControlTime = outputEvents[headIndex].timestamp;
    }
    ;
}

var headIndex = 0;
function seekTime(timestamp) {
    //console.log(timestamp);
    if (parameters.transportControlTime != timestamp) {
        //bring in sync if called from mouseover_at
        parameters.transportControlTime = timestamp;
    }
    if ((headIndex >= 0) && (headIndex < outputEvents.length)) {
        if (outputEvents[headIndex].timestamp <= timestamp) {
            var index = headIndex;
            while ((outputEvents[index].timestamp <= timestamp) && (index < outputEvents.length - 1)) {
                headIndex = index++;
                renderEvent('transport-', outputEvents[headIndex]);
            }
        } else {
            index = headIndex;
            while ((outputEvents[index].timestamp >= timestamp) && (index > 0)) {
                headIndex = index--;
                renderEvent('transport-', outputEvents[headIndex]);
            }

        }
    }
    return headIndex;
}

function latLngNearIndex(index, direction) {

    while ((outputEvents[index].id != 302) && ((index < outputEvents.length - 1) && (index > 0))) {
        if (direction > 0) {
            index++;
        } else {
            index--;
        }

    }
    if (outputEvents[index].id == 302) {
        return new google.maps.LatLng(outputEvents[index].values[0], outputEvents[index].values[1]);
    }
}

function outputEventMsg(msg) {
    event = SensorEventUtils.eventFromMsg(msg);
    onOutputEvent(event)
}

function accessPointId(inputString) {
    var TWO_PWR_32_DBL = 4294967296;
    var a = Number(inputString);
    var removeLastByte = ((a / TWO_PWR_32_DBL | 0) * TWO_PWR_32_DBL) + ((a % TWO_PWR_32_DBL | 0) / 16 | 0) * 16;

    return removeLastByte.toString();
}


function renderOutputEvents() {
    outputEvents.forEach((event) => {
        seekTime(event.timestamp);
        renderEvent('js-', event);
    }
    );
}

function onOutputEvent(event) {
    outputEvents.push(event);

    if (parameters.realTimePlots) {
        seekTime(event.timestamp);
    }

    renderEvent('js-', event);
}

function renderEvent(id, event) {
    addEventToPlots(event);

    if (parameters.realTimePlots) {
        renderAlgorithmEvent(id, SensorEventUtils.pdgFromEvent(event));
    }
}

function outputEvent(timestamp, id, accuracy, values0, values1, values2, values3, values4, values5, values6, values7, values8, values9, values10, values11, values12, values13, values14, values15) {
    var eventString = timestamp * 1e-6 + ',' + timestamp + ',' + timestamp + ',' + id + ',' + accuracy + ',' + values0 + ',' + values1 + ',' + values2 + ',' + values3 + ',' + values4 + ',' + values5 + ',' + values6 + ',' + values7 + ',' + values8 + ',' + values9 + ',' + values10 + ',' + values11 + ',' + values12 + ',' + values13 + ',' + values14 + ',' + values15;
    console.log(eventString);
    renderAlgorithmEvent('js-', eventString);    
}

function algorithmEvent(csv) {
    renderAlgorithmEvent(csv);
}
function renderAlgorithmEvent(id, csv) {
    //console.log(csv);
    needsToRender = true;
    var csvLines = csv.split(';');
    for (index in csvLines) {
        if (csvLines[index].length > 0) {
            var csvSplit = csvLines[index].split(',');
            var timestamp = Number(csvSplit[2]);
          
            if (csvSplit[3] == 2000) {
                var sceneId = 'bluecoin';
                if (!scenes.hasOwnProperty(sceneId)) {
                    scenes[sceneId] = new Scene(sceneId, 'scenes/bluecoin_scene.json');
                }
                var bluecoin = scenes[sceneId].scene.getObjectByName('Scene');
                if (bluecoin != null) {
                    bluecoin.setRotationFromQuaternion(new THREE.Quaternion(Number(csvSplit[6]), Number(csvSplit[7]), Number(csvSplit[5]), Number(csvSplit[8])));
                }
            }
        }
    }
}


//gui
var guiControls = {};
var gui = new dat.GUI({
    load: JSON,
    width: 300,
    autoPlace: false
});
gui.remember(parameters);

//algorithmWorker
var algorithmSource = '';
function loadAlgorithm() {
    var serverUrl = '../build-js/nstrumenta.js';
    console.log('loading algorithm from ' + serverUrl);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", serverUrl, true);
    xhr.timeout = 1000;
    xhr.onloadend = function (e) {
        algorithmSource = xhr.response;
        console.log('loaded Algorithm');
    }
        ;
    xhr.onerror = function (e) {
        console.log(xhr.statusText);
    }
        ;
    xhr.ontimeout = function (e) {
        console.log(xhr.statusText);
    }
        ;
    xhr.send(null);
}
// loadAlgorithm();

function yieldingLoop(startIndex, stopIndex, chunksize, callback, finished) {
    var i = startIndex;
    (async function chunk() {
        var end = Math.min(i + chunksize, stopIndex);
        for (; i < end; i++) {
            await callback(i);
        }
        if (i < stopIndex) {
            setTimeout(chunk, 0);
        } else {
            finished();
        }
    }
    )();
}

var nstrumenta = new Module.Nstrumenta();

function loadJavascript(serverUrl) {
    console.log('loading javascript from ' + serverUrl);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", serverUrl, true);
    xhr.timeout = 1000;
    xhr.onloadend = function (e) {
        eval(xhr.response);
        console.log('loaded ' + serverUrl);
    }
        ;
    xhr.onerror = function (e) {
        console.log(xhr.statusText);
    }
        ;
    xhr.ontimeout = function (e) {
        console.log(xhr.statusText);
    }
        ;
    xhr.send(null);
}

function algorithmUpdate(event) {
    //check for NaN values
    var values = [];
    for (i = 0; i < 9; i++) {
        if (event.values != null) {
            values[i] = event.values[i];
        }
        if (isNaN(values[i]) || values[i] == null) {
            values[i] = 0;
        }
    }
    nstrumenta.reportEvent(event.timestamp, event.id, event.values.length, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8]);
}

function updateControllers() {
    controllers["transportControlTime"].setValue(parameters.transportControlTime);
    controllers["transportStartTime"].setValue(parameters.transportStartTime);
    controllers["transportStopTime"].setValue(parameters.transportStopTime);
}


var serial = {};
(function () {
    'use strict';

    serial.getPorts = function () {
        return navigator.usb.getDevices().then(devices => {
            return devices.map(device => new serial.Port(device));
        });
    };

    serial.requestPort = function () {
        const filters = [];
        return navigator.usb.requestDevice({ 'filters': filters }).then(
            device => new serial.Port(device)
        );
    }

    serial.Port = function (device) {
        this.device_ = device;
    };

    serial.Port.prototype.connect = function () {
        let readLoop = () => {
            this.device_.transferIn(5, 64).then(result => {
                this.onReceive(result.data);
                readLoop();
            }, error => {
                this.onReceiveError(error);
            });
        };

        return this.device_.open()
            .then(() => {
                if (this.device_.configuration === null) {
                    return this.device_.selectConfiguration(1);
                }
            })
            .then(() => this.device_.claimInterface(0))
            .then(() => this.device_.selectAlternateInterface(0, 0))
            .then(() => this.device_.controlTransferOut({
                'requestType': 'class',
                'recipient': 'interface',
                'request': 0x22,
                'value': 0x01,
                'index': 0x02
            }))
            .then(() => {
                readLoop();
            });
    };

    serial.Port.prototype.disconnect = function () {
        return this.device_.controlTransferOut({
            'requestType': 'class',
            'recipient': 'interface',
            'request': 0x22,
            'value': 0x00,
            'index': 0x02
        })
            .then(() => this.device_.close());
    };

    serial.Port.prototype.send = function (data) {
        return this.device_.transferOut(4, data);
    };
})();

var serialDevice = null;

async function recordSerial() {
    nstrumenta.init();
    navigator.usb.requestDevice({ filters: [] }).then(device => {
        serialDevice = device;
        console.log(serialDevice.productName);
        return device.open();
    }).then(() => serialDevice.selectConfiguration(1)) // Select configuration #1 for the device.
        .then(() => serialDevice.claimInterface(0)) // Request exclusive control over interface #2.
        .then(() => serialDevice.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0x22,
            value: 0x01,
            index: 0x02
        }))
        .then((response) => {
            // Set up event listener for when characteristic value changes.
            console.log(response);
        })
        .catch(error => { console.log(error); });

    function handleRawSensorNotification(bleEvent) {
        const timestampArray = new Uint32Array(bleEvent.target.value.buffer, 0, 1).map(Number);
        const accel = Array.from(new Int16Array(bleEvent.target.value.buffer, 4, 3));
        const gyro = Array.from(new Int16Array(bleEvent.target.value.buffer, 10, 3));
        const mag = Array.from(new Int8Array(bleEvent.target.value.buffer, 16, 3));
        const timestamp = timestampArray[0];

        //console.log(timestamp + "," + accel.toString() + "," + gyro.toString() + "," + mag.toString());

        function updateEvent(id, values) {
            var event = new SensorEvent(timestamp, id, values);
            events.push(event);
            renderEvent('js-', event);
            algorithmUpdate(event);
        }
        updateEvent(1, accel);
        updateEvent(2, mag);
        updateEvent(4, gyro);

        setControllerRanges(); //this sets the stop time
    }


}

var bluetoothDevice = null;

async function recordBluetooth() {
    nstrumenta.init();
    navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['00000000-0001-11e1-9ab4-0002a5d5c51b'] })
        .then(device => {
            bluetoothDevice = device;
            return device.gatt.connect();
        })
        .then(server => {
            // Getting Battery Service...
            return server.getPrimaryService('00000000-0001-11e1-9ab4-0002a5d5c51b');
        }).then(service =>
            service.getCharacteristic('00140000-0001-11e1-ac36-0002a5d5c51b'))
        .then(characteristic => characteristic.startNotifications())
        .then(characteristic => {
            // Set up event listener for when characteristic value changes.
            parameters.clearEventData();
            characteristic.addEventListener('characteristicvaluechanged',
                handleRawSensorNotification);                
            return characteristic.readValue();
        })
        .catch(error => { console.log(error); });

    function handleRawSensorNotification(bleEvent) {
        const timestampArray = new Uint32Array(bleEvent.target.value.buffer, 0, 1).map(Number);
        const accel = Array.from(new Int16Array(bleEvent.target.value.buffer, 4, 3));
        const gyro = Array.from(new Int16Array(bleEvent.target.value.buffer, 10, 3));
        const mag = Array.from(new Int8Array(bleEvent.target.value.buffer, 16, 3));
        const timestamp = timestampArray[0];

        //console.log(timestamp + "," + accel.toString() + "," + gyro.toString() + "," + mag.toString());

        function updateEvent(id, values) {
            var event = new SensorEvent(timestamp, id, values);
            events.push(event);
            renderEvent('js-', event);
            algorithmUpdate(event);
        }
        updateEvent(1, accel);
        updateEvent(2, mag);
        updateEvent(4, gyro);

        setControllerRanges(); //this sets the stop time
    }


}

var isRunning = 0;

async function run(options) {
    if(isRunning != 0){
        console.log('attempting to run while run in progress');
    }else{    
    return new Promise(async (resolve, reject) => {
        var tic = Date.now();
        outputEvents = [];

        console.log('starting run ');
        isRunning++;
        //         if(options != null){
        //             console.log(Object.keys(options));
        //         }     
        options = options || {};
        const yieldingLoopCount = options.yieldingLoopCount || 10;


        //     eval(algorithmSource);
        // var nstrumenta = new Module.Nstrumenta();

        clearOutputPlotData();

        nstrumenta.init();

        for (index in nst_project.parameters) {
            const param = nst_project.parameters[index];
            controllers[param.id].setValue(parameters[param.id]);
            nstrumenta.setParameter(Number(index), parameters[param.id]);
        }

        //seek start event
        var startIndex = 0;
        while (events[startIndex].timestamp < parameters.transportStartTime) {
            startIndex++;
        }
        //seek stop event
        var stopIndex = startIndex;
        while ((stopIndex < events.length) && (events[stopIndex].timestamp < parameters.transportStopTime)) {
            stopIndex++;
        }

        var metaIndex = 0;
        var initialTruth = null;
        previousTimestamp = null;
        var finalTruth =
            yieldingLoop(startIndex, stopIndex, yieldingLoopCount, async function (i) {
                var event = events[i];

                //interleave meta data as outputEvents
                // if ((metaIndex < metaData.events.length) && (metaData.events[metaIndex].timestamp < event.timestamp)) {
                //     algorithmUpdate(metaData.events[metaIndex]);
                //     onOutputEvent(metaData.events[metaIndex]);
                //     metaIndex++;
                // }

                //delay for realtime plots
                if(parameters.realTimePlots){
                    if(previousTimestamp == null){
                        previousTimestamp = event.timestamp;
                    }
                    await delay(event.timestamp - previousTimestamp);
                    previousTimestamp = event.timestamp;
                }
                
                if (event != null) {
                    algorithmUpdate(event);
                }
            }, async function () {
                updatePlots();
                console.log('run complete (' + ((Date.now() - tic) * 1e-3).toFixed(3) + 's)');
                isRunning--;
                tic = Date.now();

                if (parameters.isPlaying) {
                    await delay(10);
                    parameters.runCurrentFile();
                }
                resolve();
            });
    }
    );
    }
}

; var Parameters = function () {
    this.transportControlTime = 0.0;
    this.transportStartTime = 0.0;
    this.transportStopTime = 0.0;

    this.plotUpdateInterval = 500.0;
    this.dotError = 0.0;

    this.pdrTopic = 201;

    this.loadAlgorithm = function (options) {
        loadAlgorithm();
    }


    this.toggleSerial = function (options) {
        if (serialDevice == null || !serialDevice.gatt.connected) {
            controllers.recordSerialButton.name("Stop Recording");
            recordSerial();
        } else {
            controllers.recordSerialButton.name("Record Serial");
            serialDevice.gatt.disconnect();
            this.saveEventsToFile();
            //             this.runCurrentFile();
        }
    }

    this.toggleBluetooth = function (options) {
        if (bluetoothDevice == null || !bluetoothDevice.gatt.connected) {
            controllers.recordBluetoothButton.name("Stop Recording");
            recordBluetooth();
        } else {
            controllers.recordBluetoothButton.name("Record Bluetooth");
            bluetoothDevice.gatt.disconnect();
            this.saveEventsToFile();
        }
    }

    this.isPlaying = false;
    this.toggleContinuousPlay = function (options) {
        if (this.isPlaying) {
            controllers.playButton.name("Start continuous play");
            this.isPlaying = false;
        } else {
            controllers.playButton.name("Stop continuous play");
            this.isPlaying = true;
            this.runCurrentFile();
        }
    }

    this.updatePlotsOnEvent = false;

    this.filename = '';

    this.recordBluetooth = function () {
        recordBluetooth();
    }

    this.runCurrentFile = function (options) {
        run(options);
    }

    this.clearEventData = function () {
        clearEventData();
    }

    this.editMeta = false;

    this.realTimePlots = true;

    this.loadMeta = function () {
        var elem = window.document.createElement('input');
        elem.type = 'file';
        elem.accepts = '.csv';
        elem.onchange = handleMetaFileSelect;
        elem.click();
    }
    this.saveMeta = function () {
        var blob = new Blob([metaData.getPdg()]);
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = 'truth.csv';
        elem.click();
    }

    this.saveEventsToFile = function () {
        var blob = new Blob([JSON.stringify(events)]);
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = 'bluecoin.nst';
        elem.click();
    }

    this.clearMeta = function () {
        metaData.clear();
    }
    this.autoRotateAll = function () {
        metaData.autoRotateAll();
    }

    this.createMetaEventsAtDots = function () {
        metaData.createMetaEventsAtDots();
    }

    this.loadFiles = function () {
        var elem = window.document.createElement('input');
        elem.type = 'file';
        elem.multiple = 'multiple'
        elem.onchange = handleMultipleFilesSelect;
        elem.click();
    }

    this.loadOptionSpecificBuilding = '';
    this.loadOptionSpecificRun = '';

    this.updateSubmissionDataFromCurrentRun = function () {
        updateSubmissionDataFromOutputEvents();
    }
    this.saveSubmission = function () {
        var blob = new Blob([submissionDataCsv()]);
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = 'perflocSubmission.csv';
        elem.click();
    }
    this.nelderMeadIterations = 10;
    this.nelderMeadDeltaExponent = 1;

    this.optimize = function () {
        optimizeGyroBias();
    }

    for (index in nst_project.parameters) {
        this[nst_project.parameters[index].id] = nst_project.parameters[index].value;
    }

    this.eventIndex = 0;
    this.eventTimestamp = 0;
    this.eventId = 0;
    this.eventValue0 = 1e-3;
    this.eventValue1 = 1e-3;
    this.eventValue2 = 1e-3;
    this.eventValue3 = 1e-3;
    this.eventValue4 = 1e-3;
    this.eventValue5 = 1e-3;
    this.eventValue6 = 1e-3;


    this.x = 1.;
    this.y = 0.;
    this.z = 1.;
    this.declination = 0.0;
};
var parameters = new Parameters();

var controllers = {};
gui.add(parameters, 'loadFiles').name('Load Files');
gui.add(parameters, 'runCurrentFile').name('Run');
controllers.recordSerialButton = gui.add(parameters, 'toggleSerial').name('Record Serial');
controllers.recordBluetoothButton = gui.add(parameters, 'toggleBluetooth').name('Record Bluetooth');
gui.add(parameters, 'clearEventData').name('Clear Data');
controllers.playButton = gui.add(parameters, 'toggleContinuousPlay').name('Play repeating');
gui.add(parameters, 'updatePlotsOnEvent').name('Real-time Plots');
gui.add(parameters, 'plotUpdateInterval', 0, 1000).name('Plot Update Interval');

controllers.transportControlTime = gui.add(parameters, 'transportControlTime', 0, 1000).name('Timestamp');
controllers.transportControlTime.onChange(function () {
    seekTime(parameters.transportControlTime);
}).listen();

controllers.transportStartTime = gui.add(parameters, 'transportStartTime', 0, 1000).name('Start Time');
controllers.transportStopTime = gui.add(parameters, 'transportStopTime', 0, 1000).name('Stop Time');


guiOptimize = gui.addFolder('optimize');
guiOptimize.add(parameters, 'nelderMeadIterations', 1, 100);
guiOptimize.add(parameters, 'nelderMeadDeltaExponent', -4, 2);
guiOptimize.add(parameters, 'optimize');

guiParameters = gui.addFolder('parameters');
guiParametersMag = guiParameters.addFolder('mag');
guiParametersAcc = guiParameters.addFolder('acc');
guiParametersGyro = guiParameters.addFolder('gyro');
for (index in nst_project.parameters) {
    const param = nst_project.parameters[index];
    var folder = guiParameters;
    if (param.id.startsWith('imu_data.mag_')) {
        folder = guiParametersMag;
    }
    if (param.id.startsWith('imu_data.gyro_')) {
        folder = guiParametersGyro;
    }
    if (param.id.startsWith('imu_data.acc_')) {
        folder = guiParametersAcc;
    }
    controllers[param.id] = folder.add(parameters, param.id, param.min, param.max).name(param.name).step(param.step).onChange(function () {
        for (var i in nst_project.parameters) {
            const p = nst_project.parameters[i];
            if (p.id == param.id) {
                nstrumenta.setParameter(Number(i), parameters[param.id]);
            }
        }
    });
}



function setControllerRanges() {
    if (events.length > 1) {
        controllers.transportControlTime.min(events[0].timestamp);
        controllers.transportControlTime.max(events[events.length - 1].timestamp);

        controllers.transportStartTime.min(events[0].timestamp);
        controllers.transportStartTime.max(events[events.length - 1].timestamp);
        controllers.transportStartTime.setValue(events[0].timestamp);

        controllers.transportStopTime.min(events[0].timestamp);
        controllers.transportStopTime.max(events[events.length - 1].timestamp);
        controllers.transportStopTime.setValue(events[events.length - 1].timestamp);
    }
}

var events = [];

function storeCompressedJson(name, object) {
    var zip = new JSZip();
    zip.file(name, JSON.stringify(object));
    zip.generateAsync({
        type: "string",
        compression: "DEFLATE"
    }).then(function (compressedEventsString) {
        localStorage.setItem(name, compressedEventsString);
    });
}

function loadCompressedJson(name) {
    var inputEventsZip = localStorage.getItem(name);

    if (inputEventsZip != null) {
        var zip = new JSZip();
        return zip.loadAsync(inputEventsZip).then(function (loaded_zip) {
            return loaded_zip.file(name).async("string").then((eventsString) => {
                return JSON.parse(eventsString);
            }
            )
        })

    } else {
        return Promise.resolve(null);
    }
}

function handleMultipleFilesSelect(evt) {
    var files = evt.target.files;
    // FileList object
    events = [];

    var filesProcessed = 0;
    function fileCompleteCallback() {
        filesProcessed++;
        if (filesProcessed === files.length) {
            console.log('all done');

            events = events.sort(function (a, b) {
                return a.timestamp - b.timestamp
            });

            if (useLocalStorage) {
                storeCompressedJson('nst-input-events', events);
            }

            events.forEach(function (event) {
                addEventToPlots(event)
            });

            setControllerRanges();

            parameters.runCurrentFile();
        }
    }
    ;// files is a FileList of File objects. List some properties.
    var readers = [];
    for (var i = 0, f; f = files[i]; i++) {

        readers[f.name] = new FileReader();

        // Closure to capture the file information.
        readers[f.name].onload = (function (file) {
            if (file.name.endsWith('.nst')) {
                return function (e) {
                    events = JSON.parse(readers[file.name].result);
                    fileCompleteCallback();
                }
            }
            else {
                return function (e) {
                    var lines = readers[file.name].result.split(/[\r\n]+/g);
                    console.log(file.name + ' rows:' + lines.length);

                    for (var i = 0; i < lines.length; i++) {
                        var event = SensorEventUtils.eventFromText(file.name, lines[i]);
                        if (event) {
                            events.push(event);
                        }
                    }
                    fileCompleteCallback();
                }
            }
        }
        )(f);

        // Read in the image file as a data URL.
        console.log(f);
        readers[f.name].readAsText(f);
    }
}

function shiftMagTimestamps(amount) {
    events.forEach((event) => {
        if (event.id == 2) {
            event.timestamp += amount;
        }
    });

    events = events.sort(function (a, b) {
        return a.timestamp - b.timestamp
    });

}

function shiftTimestamps(id, amount) {
    events.forEach((event) => {
        if (event.id == id) {
            if (!event.hasOwnProperty("unshiftedTimestamp")) {
                event.unshiftedTimestamp = event.timestamp;
            }
            event.timestamp = event.unshiftedTimestamp + amount;
        }
    });

    events = events.sort(function (a, b) {
        return a.timestamp - b.timestamp
    });

}


var runs = [];
if (useLocalStorage) {
    runs = JSON.parse(window.localStorage.getItem('runs')) || [];
}

var sweepPoints = [];

var x_count = 10;
var x_min = -100;
var x_max = 0;

var y_count = 10;
var y_min = 2600;
var y_max = 2700;


for (var x = x_min; x <= x_max; x += (x_max - x_min) / x_count) {
    for (var y = y_min; y <= y_max; y += (y_max - y_min) / y_count) {
        sweepPoints.push({ x: x, y: y });
    }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function sweep(points) {
    parameters.realTimePlots = false;

    for (var index in points) {
        paramX = points[index].x;
        paramY = points[index].y;

        console.log('paramX: ' + paramX + ' paramY:' + paramY);

        var runDuration = 10e6;
        var runSpacing = 50e6;
        var startTime = events[0].timestamp;
        var finalEventTime = events[events.length - 1].timestamp;

        //construct runs of runDuration from startTimes spaced with runSpacing
        while (startTime + runDuration < finalEventTime) {
            var stopTime = startTime + runDuration;
            parameters.transportStartTime = startTime;
            parameters.transportStopTime = startTime + runDuration;
            parameters.x = paramX;
            parameters.y = paramY;

            modifyEventFunction = function (event) {
                var newEvent;
                switch (event.id) {
                    case 65667:
                    case 2:
                        //vehicle data and gyro
                        newEvent = JSON.parse(JSON.stringify(event));
                        break;
                    case 65668:
                        newEvent = JSON.parse(JSON.stringify(event));
                        newEvent.id = 1002;
                        break;
                    default:
                        break;
                }
                return newEvent;
            }

            outputEvents = [];

            await run();
            //                 await run({"modifyEvent":modifyEventFunction});

            await delay(parameters.plotUpdateInterval);

            var angleError = null;
            outputEvents.forEach(event => {
                if (event.id == 1003) {
                    angleError = event.values[0];
                }
            }
            );
            console.log(angleError);

            runs.push({
                paramX: paramX,
                paramY: paramY,
                startTime: startTime,
                stopTime: stopTime,
                angleError: angleError
            })

            startTime += runSpacing;
        }

    }
    if (useLocalStorage) {
        window.localStorage.setItem('runs', JSON.stringify(runs));
    }
    parameters.realTimePlots = true
}


async function sweepRuns(ids, minFunction, duration, step) {
    var runDuration = duration ? duration : 10e6;
    var runSpacing = step ? step : 50e6;
    var startTime = events[0].timestamp;
    var finalEventTime = events[events.length - 1].timestamp;

    //construct runs of runDuration from startTimes spaced with runSpacing
    while (startTime + runDuration < finalEventTime) {
        var stopTime = startTime + runDuration;
        parameters.transportStartTime = startTime;
        parameters.transportStopTime = startTime + runDuration;


        var result = await optimizeIds(ids, minFunction);

        runs.push({
            ids: ids,
            result: result,
            startTime: startTime,
            stopTime: stopTime
        })

        startTime += runSpacing;

        if (useLocalStorage) {
            window.localStorage.setItem('runs', JSON.stringify(runs));
        }
    }

}


function sweepPlot() {
    var dataByStopTime = {};
    runs.map(run => {
        if (!dataByStopTime.hasOwnProperty(run.stopTime)) {
            dataByStopTime[run.stopTime] = {
                x: [],
                y: [],
                z: [],
                mode: 'markers',
                type: 'scatter3d',
                run: run,
                name: JSON.stringify({ "startTime": run.startTime, "stopTime": run.stopTime })
            };
        }
        dataByStopTime[run.stopTime].x.push(run.startTime);
        dataByStopTime[run.stopTime].y.push(run.result.x[0]);
        dataByStopTime[run.stopTime].z.push(run.result.fx);
    }
    )
    var angleErrorScatterData = [];
    for (var prop in dataByStopTime) {
        angleErrorScatterData.push(dataByStopTime[prop]);
    }

    new AnalysisPlot('angleErrorScatter', angleErrorScatterData);
    document.getElementById('angleErrorScatter').on('plotly_click', function (data) {
        console.log('clicked on point');
        console.dir(data.points[0]);
        for (index in nst_project.parameters) {
            const param = nst_project.parameters[index];
            if (data.points[0].data.run.ids.includes(param.id)) {
                controllers[param.id].setValue(parameters[param.id]);
                nstrumenta.setParameter(Number(index), parameters[param.id]);
            }
        }
        var nameObject = JSON.parse(data.points[0].data.name);
        parameters.transportStartTime = nameObject.startTime;
        parameters.transportStopTime = nameObject.stopTime;
        parameters.runCurrentFile();
        console.dir(data.points[0])
    });


    new AnalysisPlot('Loss function', [{
        x: runs.map(run => {
            return run.stopTime;
        }
        ),
        y: runs.map(run => {
            return run.result.fx;
        }
        ),
        mode: 'markers'
    }])
}

var fminParams = [2, 3, 4];


function getFminParams() {
    var params = []
    for (var i = 0; i < fminParams.length; i++) {
        params.push(parameters[nst_project.parameters[fminParams[i]].id]);
    }
    return params;
}

function setFminParams(x) {
    console.log(x);
    for (var i = 0; i < fminParams.length; i++) {
        parameters[nst_project.parameters[fminParams[i]].id] = x[i];
    }
}

async function fminComputeLossMag() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 2001) {
            error += event.values[0];
        }
    });
    return error;
}

async function fminComputeLossMagZ() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1006) {
            error += Math.abs(event.values[3] - event.values[11]);
        }
    });
    return error;
}

async function fminComputeLossMagXY() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1006) {
            error += Math.abs(event.values[1] - event.values[9]);
            error += Math.abs(event.values[2] - event.values[10]);
        }
    });
    return error;
}

async function fminComputeLossMagVectorToGyroXY() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1006) {
            error += Math.abs(event.values[1] - event.values[5]);
            error += Math.abs(event.values[2] - event.values[6]);
        }
    });
    return error;
}



async function fminComputeLossMagVectorToGyro() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1006) {
            error += Math.abs(event.values[1] - event.values[5]);
            error += Math.abs(event.values[2] - event.values[6]);
            error += Math.abs(event.values[3] - event.values[7]);
        }
    });
    return error;
}

async function fminComputeLossGyroPosition() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1010) {
            error += Math.abs(event.values[1]);
        }
    });
    return error;
}

async function fminComputeLossGyroRate() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1003) {
            error += Math.abs(wrapTo180(event.values[4]) - event.values[7]);
            error += Math.abs(event.values[5] - event.values[8]);
            error += Math.abs(event.values[6] - event.values[9]);
        }
    });
    return error;
}

async function fminComputeLossGyroPitchAndRoll() {
    var error = null;
    outputEvents.forEach(event => {
        if (event.id == 1003) {
            error += Math.abs(event.values[5] - event.values[8]);
            error += Math.abs(event.values[6] - event.values[9]);
        }
    });
    return error;
}



async function fminComputeLossGyro() {
    var angleError = null;
    await delay(1);
    outputEvents.forEach(event => {
        if (event.id == 2000) {
            angleError += Math.abs(event.values[0]);
        }
    });
    return angleError;
}

var fminComputeLoss = fminComputeLossMag;

async function runForFmin(x) {

    return new Promise(async (resolve, reject) => {
        setFminParams(x);

        parameters.realTimePlots = false;
        await run({ x: x, yieldingLoopCount: 1000 });

        parameters.realTimePlots = true;

        var loss = await fminComputeLoss();
        await delay(parameters.plotUpdateInterval);


        console.log(loss);
        resolve(loss);
    });

}

function optimize() {
    return fmin.nelderMead(runForFmin, getFminParams(), {
        maxIterations: parameters.nelderMeadIterations,
        nonZeroDelta: 1 + 5 * Math.pow(10, parameters.nelderMeadDeltaExponent),
        zeroDelta: 1 * Math.pow(10, parameters.nelderMeadDeltaExponent),
        minErrorDelta: 1e-6,
        maxErrorDelta: 1e-5,
        rho: 1,
        chi: 2,
        psi: -0.5,
        sigma: 0.5
    });
}

function optimizeIds(ids, computeLossFunction) {
    fminParams = [];
    for (index in nst_project.parameters) {
        var param = nst_project.parameters[index];
        if (ids.includes(param.id)) fminParams.push(Number(index));
    }
    console.log(fminParams);
    fminComputeLoss = computeLossFunction;
    return optimize();
}

var ids_gyro_offset = ['gyro_offset.x', 'gyro_offset.y', 'gyro_offset.z'];
var ids_gyro_scale = ['gyro_scale.x', 'gyro_scale.y', 'gyro_scale.z'];
var ids_gyro_alignment = ['gyro_alignment_hpr.x', 'gyro_alignment_hpr.y', 'gyro_alignment_hpr.z'];


var ids_mag_offset = ['mag_offset.x', 'mag_offset.y', 'mag_offset.z'];
var ids_mag_scale = ['mag_scale.x', 'mag_scale.y', 'mag_scale.z'];
var ids_mag_alignment = ['mag_alignment_matrix.m00',
    'mag_alignment_matrix.m01',
    'mag_alignment_matrix.m02',
    'mag_alignment_matrix.m10',
    'mag_alignment_matrix.m11',
    'mag_alignment_matrix.m12',
    'mag_alignment_matrix.m20',
    'mag_alignment_matrix.m21',
    'mag_alignment_matrix.m22'];


function optimizeGyroBias() {
    optimizeIds(['gyro_offset.x', 'gyro_offset.y', 'gyro_offset.z'], fminComputeLossGyro);
}

function optimizeGyroAlignment() {
    optimizeIds(['gyro_alignment_hpr.x', 'gyro_alignment_hpr.y', 'gyro_alignment_hpr.z'], fminComputeLossGyro);
}

function optimizeGyroFull() {
    optimizeIds(['gyro_offset.x', 'gyro_offset.y', 'gyro_offset.z', 'gyro_scale.x', 'gyro_scale.y', 'gyro_scale.z', 'gyro_alignment_hpr.x', 'gyro_alignment_hpr.y', 'gyro_alignment_hpr.z'], fminComputeLossGyro);
}

function optimizeGyroFullMag() {
    optimizeIds(['gyro_offset.x', 'gyro_offset.y', 'gyro_offset.z', 'gyro_scale.x', 'gyro_scale.y', 'gyro_scale.z', 'gyro_alignment_hpr.x', 'gyro_alignment_hpr.y', 'gyro_alignment_hpr.z'], fminComputeLossMagVectorToGyro);
}

function optimizeGyroFullPosition() {
    optimizeIds(['gyro_offset.x', 'gyro_offset.y', 'gyro_offset.z', 'gyro_scale.x', 'gyro_scale.y', 'gyro_scale.z', 'gyro_alignment_hpr.x', 'gyro_alignment_hpr.y', 'gyro_alignment_hpr.z'], fminComputeLossGyroPosition);
}

function optimizeMagBias() {
    optimizeIds(['mag_offset.x', 'mag_offset.y', 'mag_offset.z'], fminComputeLossMag);
}

function optimizeMagAlignment() {
    optimizeIds(['mag_alignment_hpr.x', 'mag_alignment_hpr.y', 'mag_alignment_hpr.z'], fminComputeLossMag);
}

function optimizeMagFull() {
    optimizeIds(['mag_offset.x', 'mag_offset.y', 'mag_offset.z', 'mag_scale.x', 'mag_scale.y', 'mag_scale.z', 'mag_alignment_hpr.x', 'mag_alignment_hpr.y', 'mag_alignment_hpr.z'], fminComputeLossMag);
}


async function runForFminTimeshift(x) {
    console.log(x);
    return new Promise(async (resolve, reject) => {
        shiftTimestamps(4, x[0]);

        parameters.realTimePlots = false;
        await run();

        parameters.realTimePlots = true;

        var loss = await fminComputeLossGyro();

        console.log(loss);
        resolve(loss);
    });

}

function optimizeTimeshift(initial) {
    fmin.nelderMead(runForFminTimeshift, [initial], {
        maxIterations: parameters.nelderMeadIterations,
        nonZeroDelta: 1 + 5 * Math.pow(10, parameters.nelderMeadDeltaExponent),
        zeroDelta: 1 * Math.pow(10, parameters.nelderMeadDeltaExponent),
        minErrorDelta: 1e3,
        maxErrorDelta: 1e4,
        rho: 1,
        chi: 2,
        psi: -0.5,
        sigma: 0.5
    }).then(function (value) {
        console.log('optimize complete')
        console.dir(value);
        parameters.runCurrentFile();
    });
}

async function runForFminTimeshiftMag(x) {
    console.log(x);
    return new Promise(async (resolve, reject) => {
        shiftTimestamps(2, x[0], x[1]);

        parameters.realTimePlots = false;
        await run();

        parameters.realTimePlots = true;

        var loss = await fminComputeLossMag();

        console.log(loss);
        resolve(loss);
    });

}

function optimizeTimeshiftMag(initial) {
    fmin.nelderMead(runForFminTimeshiftMag, [initial], {
        maxIterations: parameters.nelderMeadIterations,
        nonZeroDelta: 1 + 5 * Math.pow(10, parameters.nelderMeadDeltaExponent),
        zeroDelta: 1 * Math.pow(10, parameters.nelderMeadDeltaExponent),
        minErrorDelta: 1e3,
        maxErrorDelta: 1e4,
        rho: 1,
        chi: 2,
        psi: -0.5,
        sigma: 0.5
    }).then(function (value) {
        console.log('optimize complete')
        console.dir(value);
        parameters.runCurrentFile();
    });
}
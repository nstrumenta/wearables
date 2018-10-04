var SensorEvent = function (timestamp, id, values) {
    this.timestamp = timestamp;
    this.id = id;
    this.values = values;
}

var SensorEventUtils = {
    //systemTimeOffset is to recreate column 1 of pdg files from timestamps
    systemTimeOffset: 0,
    gyro_previous_cputime: null,

    eventFromMsg: function (msg) {
        return new SensorEvent(msg.timestamp, msg.id, msg.values);
    },

    eventFromPdg: function (pdgLine) {
        var event = new SensorEvent();
        var csvSplit = pdgLine.split(',');
        var timestamp = Number(csvSplit[2]);
        var eventSystemTimeMs = Number(csvSplit[0]);
        var timestampMs = Math.floor(timestamp * 1e-6);
        if (!isNaN(timestampMs)) {
            SensorEventUtils.systemTimeOffset = eventSystemTimeMs - timestampMs;
        }
        var id = Number(csvSplit[3]);
        var accuracy = Number(csvSplit[4]);
        var values = [];
        for (var i = 0; i < csvSplit.length - 5; i++) {
            values[i] = Number(csvSplit[5 + i]);
            if (isNaN(values[i])) {
                values[i] = 0;
            }
        }
        return new SensorEvent(timestamp, id, values);
    },

    pdgFromEvent: function (event) {
        var eventString = (Math.floor(event.timestamp * 1e-6) + SensorEventUtils.systemTimeOffset) + ',' + event.timestamp + ',' + event.timestamp + ',' + event.id + ',' + 0;
        for (var i = 0; i < event.values.length; i++) {
            eventString += ',' + event.values[i];
        }
        return eventString;
    },

    isValid(value, max, min) {
        return !isNaN(value) && ((value < max) && (value > min));
    },

    eventFromText: function (filename, line) {

        if (line != '') {
            switch (filename.toLowerCase()) {
                case 'nst-phone.csv':
                case 'android-device.csv':
                    var lineSplit = line.split(',');
                    var id = Number(lineSplit[2]);
                    var timestamp = Number(lineSplit[0]);
                    var values = [];
                    for (var i = 4; i < lineSplit.length; i++) {
                        values.push(Number(lineSplit[i]));
                        if (!this.isValid(values[values.length - 1], 1e5, -1e5)) {
                            console.log('rejecting  ' + filename + ": " + line);
                            return null;
                        }
                    }
                    return new SensorEvent(timestamp, id, values);
                case 'nst-events.ldjson':
                    var event = JSON.parse(line);
                    if (event.id == 'canlogger') {
                        var dataArray = new Uint8Array(event.data.data);
                        var dataView = new DataView(dataArray.buffer);
                        if (dataView.getUint8(0) == 0x7e) {
                            //start bit
                            if (dataView.getUint8(1) == 0x01) {
                                // Received CAN-bus message
                                // Description: The application data contain a CAN-bus message received by the logger. Format:
                                // ID 1
                                // Time 4 byte
                                // Time ms 2 byte
                                // Message ID 4 byte
                                // Data length 1 byte
                                // Data 0-8 byte
                                // The Time field is encoded as ”Epoch” seconds. The message ID is extended if bit 29 (indexed from zero) is set. Multi-byte fields shall be interpreted MSB (Most-Significant- Byte) first.

                                var canTimestamp = dataView.getUint32(2) * 1000 + dataView.getUint16(6);
                                var id = dataView.getUint32(8);
                                var values = [];
                                var dataLength = dataView.getUint8(12);
                                switch (id) {
                                    case 0x309:
                                        //vehicleSpeed
                                        var vehicleSpeedCan = dataView.getUint16(17);
                                        var vehicleSpeed = Number(vehicleSpeedCan) / 360;
                                        values.push(vehicleSpeed);
                                        return new SensorEvent(event.serverTimeMs, id, values);
                                    case 0x156:
                                        //steering wheel angle                                
                                        values.push(Number(dataView.getInt16(13)) / 360);
                                        return new SensorEvent(event.serverTimeMs, id, values);
                                    case 0x158:
                                        //wheel speed                               
                                        values.push(Number(dataView.getUint16(13)) / 360);
                                        values.push(Number(dataView.getUint16(17)) / 360);
                                        return new SensorEvent(event.serverTimeMs, id, values);
                                    case 0x1d0:
                                        values.push(Number(dataView.getUint16(13)) / 360);
                                        values.push(Number(dataView.getUint16(17)) / 360);
                                        return new SensorEvent(event.serverTimeMs, id, values);
                                    default:
                                        if (dataLength < dataArray.length - 12) {
                                            values = Array.from(new Uint8Array(dataArray.buffer, 13, dataLength));
                                        }
                                        return null;
                                    //return new SensorEvent(event.serverTimeMs,id,values);
                                }
                            }
                        }
                        return null;
                    } else {
                        if (event.id == 'trax') {
                            var dataArray = new Uint8Array(event.data.data);
                            var dataView = new DataView(dataArray.buffer);
                            //                             Output Data pkg
                            // 00 30 05 0a 01 c4 85 c0 00 02 44 f2 60 00 0a 45   
                            // 11 c0 00 0f 42 f4 00 00 10 c3 0c 00 00 11 46 7f     
                            // 2c 00 3d 76 90 3e ff fb 3f 00 01 40 ff ff 37 87        

                            // 00 30 -- total 48 bytes 0
                            // 05 -- kDataResp 2
                            // 0a -- 10 data fileds/IDs 3
                            // 01 -- Mag X ID 4
                            // c4 85 c0 00 -- Mag X 5
                            // 02 -- Mag Y ID 9
                            // 44 f2 60 00 -- Mag Y 10
                            // 0a -- Mag Z ID 14
                            // 45 11 c0 00 -- Mag Z 15
                            // 0f -- Acc X ID 19
                            // 42 f4 00 00 -- Acc X 20
                            // 10 -- Acc Y ID 24
                            // c3 0c 00 00 Acc Y 25 
                            // 11 -- Acc Z ID 29
                            // 46 7f 2c 00 Acc Z 30
                            // 3D -- Gyro timestamp ID 34
                            // 76 90 -- Gyro Tstamp 35
                            // 3e -- Gyro X ID 37
                            // ff fb -- Gyro X 38
                            // 3f -- Gyro Y ID 40
                            // 00 01 -- gyro Y 41
                            // 40 -- Gyro Z ID 43
                            // ff ff -- Gyro Z 44
                            // 37 87 – CRC 46
                            var timestamp = dataView.getUint16(35);
                            var values = [];
                            var id = 3001;

                                            values.push(dataView.getFloat32(20));
                                            values.push(dataView.getFloat32(25));
                                            values.push(dataView.getFloat32(30));
                                            
                                            values.push(dataView.getInt16(38,true));
                                            values.push(dataView.getInt16(41,true));
                                            values.push(dataView.getInt16(44,true));

                                            values.push(dataView.getFloat32(5));
                                            values.push(dataView.getFloat32(10));
                                            values.push(dataView.getFloat32(15));

                                            return new SensorEvent(timestamp, id, values);
                                    
                        }
                        else {
                            return new SensorEvent(event.sensorTimeNs, event.id, event.values);
                        }
                    }
                case 'acceleration.csv':
                    // acceleration.csv
                    // 	-rtmap_timestamp
                    // 	-cpu_timestamp
                    // 	-x (m/s^2)
                    // 	-y (m/s^2)
                    // 	-z (m/s^2)
                    var lineSplit = line.split(';');
                    var id = 1;
                    var timestamp = Number(lineSplit[0]);
                    var values = [];
                    for (var i = 2; i < 5; i++) {
                        values.push(Number(lineSplit[i]));
                        if (!this.isValid(values[values.length - 1], 1e5, -1e5)) {
                            console.log('rejecting  ' + filename + ": " + line);
                            return null;
                        }
                    }
                    return new SensorEvent(timestamp, id, values);
                case 'gyro.csv':
                    // Gyro.csv
                    // 	-rtmap_timestamp
                    // 	-cpu_timestamp
                    // 	-x (rad/sec)
                    // 	-y (rad/sec)
                    // 	-z (rad/sec)
                    var valid = true;
                    var lineSplit = line.split(';');
                    if (lineSplit.length != 5) {
                        console.log('wrong length ' + lineSplit.length);
                        valid = false;
                    }
                    var id = 4;
                    var timestamp = Number(lineSplit[0]);
                    if (this.gyro_previous_cputime) {
                        if (!this.isValid(Number(lineSplit[1]) - this.gyro_previous_cputime, 5e5, 0)) {
                            console.log('invalid cpu_timestamp ' + lineSplit[1]);
                            valid = false;

                        } else {
                            this.gyro_previous_cputime = Number(lineSplit[1]);
                        }

                    } else {
                        this.gyro_previous_cputime = Number(lineSplit[1]);
                    }
                    var values = [];
                    for (var i = 2; i < 5; i++) {
                        values.push(Number(lineSplit[i]));
                        if (!this.isValid(values[values.length - 1], 2e4, -2e4)) {
                            console.log('invalid point ' + values[values.length - 1]);
                            valid = false;
                        }
                    }
                    if (valid) {
                        return new SensorEvent(timestamp, id, values);
                    } else {
                        console.log('rejecting  ' + filename + ": " + line);
                        return null;
                    }
                case 'magnet.csv':
                    // Magnet.csv
                    //   -rtmap_timestamp
                    // 	-X
                    // 	-Y
                    // 	-Z

                    var lineSplit = line.split(';');
                    var id = 2;
                    var timestamp = Number(lineSplit[0]);
                    var values = [];
                    for (var i = 1; i < 4; i++) {
                        values.push(Number(lineSplit[i]));
                        if (!this.isValid(values[values.length - 1], 1e6, -1e6)) {
                            console.log('rejecting  ' + filename + ": " + line);
                            return null;
                        }
                    }
                    return new SensorEvent(timestamp, id, values);

                case 'gps_data.csv':
                case 'gps.csv':
                    // gps_data.csv
                    // 	-rtmap_timestamp
                    // 	-latitude
                    // 	-longitude
                    // 	-orthometric height
                    // 	-ellipsoidal height
                    // 	-bias    (when available or 0)
                    // 	-Quality Indicator 
                    // 						Meaning: 
                    // 						0 - fix not available, 
                    // 						1 - GPS fix, 
                    // 						2 - Differential GPS fix 
                    // 						3 = PPS fix 
                    // 						4 = Real Time Kinematic 
                    // 						5 = Float RTK 
                    // 						6 = estimated (dead reckoning) 
                    // 						7 = Manual input mode 
                    // 						8 = Simulation mode 
                    // 						Note: only 0 and 1 are available on most GPS receivers. 
                    // 	-DOP (meters)
                    // 	-speed over ground(km/h)
                    // 	-True course over ground (degree)
                    var lineSplit = line.split(';');
                    var id = 65666;
                    var timestamp = Number(lineSplit[0]);
                    var values = [];
                    for (var i = 1; i < 10; i++) {
                        values.push(Number(lineSplit[i]));
                        if (isNaN(values[values.length - 1])) {
                            console.log('rejecting NaN ' + filename + ": " + line);
                            return null;
                        }
                    }
                    return new SensorEvent(timestamp, id, values);
                case 'applanix.csv':
                    //             Applanix.csv
                    // 	-rtmap_timestamp
                    // 	-latitude
                    // 	-longitude
                    // 	-altitude
                    // 	-roll (degree)
                    // 	-pitch (degree)
                    // 	-heading (degree)
                    // 	-speed (mps)	

                    var lineSplit = line.split(';');
                    var id = 65668;
                    var timestamp = Number(lineSplit[0]);
                    var values = [];
                    for (var i = 1; i < lineSplit.length; i++) {
                        values.push(Number(lineSplit[i]));
                        if (isNaN(values[values.length - 1])) {
                            console.log('rejecting NaN ' + filename + ": " + line);
                            return null;
                        }
                    }
                    return new SensorEvent(timestamp, id, values);
                case 'vehicle_data.csv':

                    //  Vehicle_data.csv
                    // 	-rtmap_timestamp
                    // 	-Vehicle speed (kph)
                    // 	-Yaw rate (Degree/Sec)
                    // 	-Stering Wheel (Degree)
                    // 	-Front Left Wheel Speed (kph)
                    // 	-Front Right Wheel Speed (kph)
                    // 	-Rear Left Wheel Speed (kph)
                    // 	-Rear Right Wheel Speed (kph)
                    var lineSplit = line.split(';');
                    var id = 65667;
                    var timestamp = Number(lineSplit[0]);
                    var values = [];
                    for (var i = 1; i < lineSplit.length; i++) {
                        values.push(Number(lineSplit[i]));
                        if (isNaN(values[values.length - 1])) {
                            console.log('rejecting NaN ' + filename + ": " + line);
                            return null;
                        }
                    }
                    return new SensorEvent(timestamp, id, values);

                default:
                    break;
            }
        }
        return null;
    }

}

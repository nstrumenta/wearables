window.addEventListener('message', function (msg) {
    var event = msg.data;
    console.log(event);



    if (!sensorData.hasOwnProperty(event.id)) {
        sensorData[event.id] = { timestamps: [] , values: []};
        // for(var i = 0; i< event.values.length; i++){
        //     sensorData[event.id].values[i] = [];
        // }
        for(var i = 0; i< 1; i++){
            sensorData[event.id].values[i] = [];
        }
        var div = document.createElement('div');
        div.setAttribute('id', event.id);
        document.body.appendChild(div);
    }

    sensorData[event.id].timestamps.push(event.systemTime);
    // for(var i = 0; i< event.values.length; i++){
    //     sensorData[event.id].values[i].push(event.values[i]);
    // }
    for(var i = 0; i< 1; i++){
        sensorData[event.id].values[i].push(event.values[i]);
    }

    if (sensorData[event.id].timestamps.length > windowSize) {
        sensorData[event.id].timestamps.shift(1);
        // for(var i = 0; i< event.values.length; i++){
        //     sensorData[event.id].values[i].shift(1);
        // }
        for(var i = 0; i< 1; i++){
            sensorData[event.id].values[i].shift(1);
        }
    }

}, false);

var sensorData = {};

var timestamps = [];
var signal = [];
var deltaSignal = [];
var lastValue = 0;

var windowSize = 512;
var sampleRate;
//calculated at runtime

setInterval(function () {
    for (var sensorId in sensorData) {
        var plotData = [];
        for( var i = 0; i < sensorData[sensorId].values.length ; i++){
        plotData.push({ x: sensorData[sensorId].timestamps, y: sensorData[sensorId].values[i]});
        }

        Plotly.react(sensorId,
            plotData,
            {}, { displayModeBar: false })
    }
})

//     var phasors = [];
//     //fft data

//     var timeSeries = new Dygraph(document.getElementById("timeSeries"),phasors,{
//         drawPoints: false,
//         showRoller: false,
//         labels: ['time', 'mag']
//     });

//     var deltaCounts = new Dygraph(document.getElementById("deltaCounts"),phasors,{
//         drawPoints: false,
//         showRoller: false,
//         labels: ['time', 'deltaCounts']
//     });

//     setInterval(function() {
//         var plotData = [];
//         for (index in signal) {
//             plotData.push([timestamps[index], signal[index]]);
//         }
//         if (signal.length == windowSize) {
//             timeSeries.updateOptions({
//                 'file': plotData
//             });
//         }
//     }, 50)

//     setInterval(function() {
//         var plotData = [];
//         for (index in signal) {
//             plotData.push([timestamps[index], deltaSignal[index]]);
//         }
//         if (deltaSignal.length == windowSize) {
//             deltaCounts.updateOptions({
//                 'file': plotData
//             });
//         }
//     }, 50)

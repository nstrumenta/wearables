runs = [];
(async()=>{
    parameters.renderOnOutputEvent = false;

    for (var gyroScale = 1.00; gyroScale <= 1.06; gyroScale += 0.02) {
        for (var gyroBias = -0.0; gyroBias < 5.0; gyroBias += 5.0) {
            console.log('gyroScale: ' + gyroScale + ' gyroBias:' + gyroBias);

            var runDuration = 60e6;
            var runSpacing = 60e6;
            var startTime = events[0].timestamp;
            var finalEventTime = events[events.length - 1].timestamp;

            //construct runs of runDuration from startTimes spaced with runSpacing
            while (startTime + runDuration < finalEventTime) {
                var stopTime = startTime + runDuration;
                parameters.transportStartTime = startTime;
                parameters.transportStopTime = startTime + runDuration;
                parameters.x = gyroScale;
                parameters.y = gyroBias;

                modifyEventFunction = function(event) {
                    var newEvent; 
                    switch(event.id){
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

                await run({"modifyEvent":modifyEventFunction});

                const delay = ms => new Promise(r => setTimeout(r, ms));
                
                await delay(100);
                
                var angleError = null;
                outputEvents.forEach(event=>{
                    if (event.id == 1003) {
                        angleError = Math.max(angleError,event.values[0]);
                    }
                }
                );
                console.log(angleError);

                runs.push({
                    gyroScale: gyroScale,
                    gyroBias: gyroBias,
                    startTime: startTime,
                    stopTime: stopTime,
                    angleError: angleError
                })

                startTime += runSpacing;
            }
        }
    }
    parameters.renderOnOutputEvent = true
}
)()

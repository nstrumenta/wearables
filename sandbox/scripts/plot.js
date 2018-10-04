(async()=>{
    var dataByStopTime = {};
    runs.map(run=>{
        if (!dataByStopTime.hasOwnProperty(run.stopTime)) {
            dataByStopTime[run.stopTime] = {
                x: [],
                y: [],
                z: [],
                mode: 'markers',
                type: 'scatter3d',
                name: run.stopTime
            };
        }
        dataByStopTime[run.stopTime].x.push(run.gyroScale);
        dataByStopTime[run.stopTime].y.push(run.gyroBias);
        dataByStopTime[run.stopTime].z.push(run.angleError);
    }
    )
    var angleErrorScatterData = [];
    for (var prop in dataByStopTime) {
        angleErrorScatterData.push(dataByStopTime[prop]);
    }

    new AnalysisPlot('angleErrorScatter',angleErrorScatterData);
    document.getElementById('angleErrorScatter').on('plotly_click',function(data){
        parameters.x = data.points[0].x;
        parameters.y = data.points[0].y;
        console.dir(data.points[0])    
    });


    new AnalysisPlot('angleError',[{
        x: runs.map(run=>{
            return run.gyroBias
        }
        ),
        y: runs.map(run=>{
            return run.angleError
        }
        ),
        mode: 'markers'
    }])

}
)()

/* global IDBFiles */

var device;
var deviceLogString = "";

window.addEventListener("load", ()=>{
    const logsEl = document.querySelector("#logs");

    function clearLogs() {
        logsEl.innerHTML = "";
    }
    function appendLog(msg) {
        logsEl.textContent += msg;
    }

    document.querySelector("#clear-logs").onclick = clearLogs;

    async function startLogging() {
        await navigator.usb.requestDevice({filters:[]}).then(selectedDevice=>{device=selectedDevice;return device.open();// Begin a session.
        }).then(()=>device.selectConfiguration(1)).then(()=>device.claimInterface(1)).then(()=>device.controlTransferOut({requestType:'vendor',recipient:'device',request:3,value:1,index:1}))// Ready to receive data
        .then(()=>device.transferIn(1,64)).then(result=>{let decoder=new TextDecoder();console.log('Received: '+decoder.decode(result.data));}).catch (error=>{console.log(error);});

        readLoop();
    }

    function readLoop() {
        device.transferIn(1, 64).then(result=>{
            let decoder = new TextDecoder();
            let msg = decoder.decode(result.data);
            appendLog(msg);
            console.log(msg);
            deviceLogString += msg;
            readLoop();
        }
        )
    }

    document.querySelector("#start-logging").onclick = startLogging;

}
, {
    once: true
});

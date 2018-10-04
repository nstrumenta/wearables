# Bluecoin algorithm development

******* NOTE *******
If the screenshots do not render properly, please goto the following URL:  https://github.com/nstrumenta/wearables

Go to https://editor.nstrumenta.com in order to access the Nstrumenta Algorithm development and Sandbox platform.  You will see the following Sign In dialog box:

![Sign In Dialog](/screenshots/Sign_In_Dialog.png?raw=true "Sign In Dialog")

After successfully logging in with your email and password, you will see this screen.  Please click on “Open” button at top.

![Editor No Project](/screenshots/Editor_No_Project.png?raw=true "Editor No Project")

You will see the Open Project dialog box.  Please click on the “Bluecoin” button and then click “Open” button on the lower left corner of the dialog box.

![Open Project Dialog](/screenshots/Open_Project_Dialog.png?raw=true "Open Project Dialog")

You may browse the C source code by clicking the files in the left hand pane to see them open in the editor.

Build:  In order to launch the Bluecoin sandbox to run the Bluecoin unit, please push the “Build” button in the following window:

![Build Button Launch](/screenshots/Build_Button_Launch.png?raw=true "Build Button Launch")

In order to launch the Bluecoin Sandbox, please push the "Run" button next to the "Build" button.

![Run Button Launch](/screenshots/Run_Button_Launch.png?raw=true "Run Button Launch")

A new browser tab will be launched where the Bluecoin Sandbox will load:

![Bluecoin Sandbox](/screenshots/Bluecoin_Sandbox.png?raw=true "Bluecoin Sandbox")

Click ‘Record Bluetooth’ and locate the Bluecoin (NSTR102) in the list inside the Bluetooth dialog box.  Push the pair button.

![BLE Pairing Dialog](/screenshots/BLE_Pairing_Dialog.png?raw=true "BLE Pairing Dialog")

Perform motion with the Bluecoin device.  Your motions can be viewed live while a log file is being recorded.  If you want to see the sensor and processed outputs being graphed in the display window in real time, please enable the "Plot" checkbox.

![Active Recording](/screenshots/Active_Recording.png?raw=true "Active Recording")

Stop recording.  Upon completion, recorded log file will be downloaded and can later be reloaded with Load Files.  You may also push the “Run” button to see the last file you captured rerun.  You may do this with different parameter settings to see their effect on both the graphed outputs as well as the Bluecoin rendered object.

![Stop Recording BLE](/screenshots/Stop_Recording_BLE.png?raw=true "Stop Recording BLE")

Examine plots by clicking on the various tabs representing the different output data streams

You should run this on a Chrome browser.  It does not work in Safari.

******* You will also need to program your ST Bluecoin with the firmware image "nst-step.bin" contained in the "bluecoin_firmware" folder that you can find in the project folder tree.  Any ST programmer can be used. *******


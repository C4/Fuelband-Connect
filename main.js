// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const HID = require('node-hid')

const FEATURE_REPORT = 1

const OPCODE_VERSION = 5;
const OPCODE_EVENT_LOG = 7;
const OPCODE_BATTERY_STATE = 6;
const OPCODE_RTC = 9;
const OPCODE_SETTING_GET = 10;
const OPCODE_SETTING_SET = 11;
const OPCODE_DEBUG = 16;
const OPCODE_MEMORY_EXT = 18;
const OPCODE_DESKTOP_DATA = 19;
const OPCODE_UPLOAD_GRAPHIC = 21;
const OPCODE_UPLOAD_GRAPHICS_PACK = 22;
const OPCODE_STATUS = 32;

// Sub commands used with 'OPCODE_BATTERY_STATE'
const SUBCMD_BATT_DISABLE_CHARGER = 2;
const SUBCMD_BATT_DISCONNECT_BATTERY = 3;
const SUBCMD_BATT_ENABLE_CHARGER = 1;
const SUBCMD_BATT_QUERY_BATTERY = 0;

// Sub commands used with 'OPCODE_RTC'
const SUBCMD_RTC_GET_TIME = 2;
const SUBCMD_RTC_GET_DATE = 4;
const SUBCMD_RTC_SET_TIME_DATE = 5;

// Sub commands for doing memory read/write operations
const SUBCMD_END_TRANSACTION = 3;
const SUBCMD_START_READ = 4;
const SUBCMD_READ_CHUNK = 0;
const SUBCMD_START_WRITE = 2;
const SUBCMD_WRITE_CHUNK = 1;

const SETTING_SERIAL_NUMBER = 0;
const SETTING_GOAL_0 = 40; // 0 to 6 for days of week (0 = monday)
const SETTING_GOAL_1 = 41;
const SETTING_GOAL_2 = 42;
const SETTING_GOAL_3 = 43;
const SETTING_GOAL_4 = 44;
const SETTING_GOAL_5 = 45;
const SETTING_GOAL_6 = 46;
const SETTING_FUEL = 48;
const SETTING_MENU_CALORIES = 57;
const SETTING_MENU_STEPS = 58;
const SETTING_GOAL_CELECRATIONS = 59;
const SETTING_WEIGHT = 61;
const SETTING_HEIGHT = 62;
const SETTING_DATE_OF_BIRTH = 63;
const SETTING_GENDER = 64;
const SETTING_HANDEDNESS = 65; // orientation
const SETTING_MENU_STARS = 89; // hours won
const SETTING_LIFETIME_FUEL = 94;
const SETTING_FIRST_NAME = 97;

const SETTING_TEST = 59;

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })


})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const VENDOR_ID = 0x11AC;
const PRODUCT_ID = 0x317D;

// Define report IDs
const REPORT_ID = 0x01;

async function openHidDevice() {
    return new Promise((resolve, reject) => {
        try {
            const devices = HID.devices();
            //const deviceInfo = devices.find(device => device.vendorId === VENDOR_ID && device.productId === PRODUCT_ID);
            const deviceInfo = devices.find(device => device.vendorId === VENDOR_ID);
            if (!deviceInfo) {
                reject(new Error('Device not found'));
            }
            const device = new HID.HID(deviceInfo.path);
            //const product = deviceInfo.product;
            resolve(device);
        } catch (error) {
            reject(error);
        }
    });
}

function listHidDevices(vendorId) {
    const devices = HID.devices();
    const filteredDevices = devices.filter(device => device.vendorId === vendorId);
    return filteredDevices;
}

// Send a feature report asynchronously
async function sendDevice(device, data) {
    data = [0x01, 0x04, 0xFF, 0x0A, 0x01, 0x5E];
    return new Promise((resolve, reject) => {
        device.sendFeatureReport(data);
    });
}

// Receive a feature report asynchronously
async function get(device, size) {
    return new Promise((resolve, reject) => {
        device.getFeatureReport(REPORT_ID, size, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

// Close the HID device asynchronously
async function closeHidDevice(device) {
    return new Promise(resolve => {
        device.close();
        resolve();
    });
}

function toAscii(buf) {
    let t_buf = '';
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== 0x00) {
            t_buf += String.fromCharCode(buf[i]);
        }
    }
    return t_buf;
}

function stringToCharCodeArray(str) {
    if (typeof str !== 'string') {
        throw new TypeError('The input must be a string');
    }
    let charCodeArray = [];
    for (let i = 0; i < str.length; i++) {
        charCodeArray.push(str.charCodeAt(i));
    }
    return charCodeArray;
}

function convertWeight(weight_lbs){
    const lowByte = weight_lbs & 0xFF; // Extract the low byte
    const highByte = (weight_lbs >> 8) & 0xFF; // Extract the high byte
    const weightArray = [lowByte, highByte];
    return weightArray;
}

function intFromLittleEndian(buf) {
    let t_num = 0;
    for (let i = 0; i < buf.length; i++) {
        t_num |= buf[i] << (i * 8);
    }
    return t_num;
}

const deviceInfo = {

};


//These are the get functions for interfacing with the Fuelband
function getModelNumber(device){
    const featureDataToSend = [FEATURE_REPORT, 0x02, 0xFF, OPCODE_VERSION];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return toAscii(receivedData.slice(18));
}

function getSerialNumber(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_SERIAL_NUMBER];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return toAscii(receivedData.slice(7));
}

/* First Name Section */
function getFirstName(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_FIRST_NAME];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return toAscii(receivedData.slice(7));
}
function setFirstName(device, name){
    if (!name || name.trim() === "") {
        console.error("Name cannot be empty");
        return;
    } else{
        charCodeName = stringToCharCodeArray(name);
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_FIRST_NAME,charCodeName.length,...charCodeName];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend);
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
        return;
    }
}

/* Height Section */
function getHeight(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_HEIGHT];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    //console.log(receivedData);
    return receivedData[7];
}
function setHeight(device, height){
    if (!height || height.trim() === "") {
        console.error("Height cannot be empty");
        return;
    } else{
        charCodeHeight = parseInt(height, 10);
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_HEIGHT,1,charCodeHeight];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend);
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return;
    }
}

/* Weight Section */
function getWeight(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_WEIGHT];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    buf = receivedData.slice(-2); // Grab the last 2 digits in the response buffer
    return intFromLittleEndian(buf);
}
function setWeight(device, weight){
    if (!weight || weight.trim() === "") {
        console.error("Weight cannot be empty");
        return;
    } else{
        convertedWeight = convertWeight(weight);
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_WEIGHT,convertedWeight.length,...convertedWeight];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend);
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return;
    }
}

/* Gender Section */
function getGender(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_GENDER];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    if (receivedData[7] === 77) {
        return "MALE";
    } else if (receivedData[7] === 70) {
        return "FEMALE";
    } else {
        return "UNKNOWN";
    } 
}
function setGender(device, gender){
    if (gender == "MALE"){
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_GENDER,1,77];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend);
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
        return;
    } else if (gender == "FEMALE"){
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_GENDER,1,70];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend); 
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
        return;
    }    
}

/* Band Orientation Section */
function getBandOrientation(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_HANDEDNESS];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    console.log(receivedData);
    if (receivedData[7] === 1) {
        return "LEFT";
    } else if (receivedData[7] === 0) {
        return "RIGHT";
    } else {
        return "UNKNOWN";
    } 
}
function setBandOrientation(device, orientation){
    if (orientation == "LEFT"){
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_HANDEDNESS,1,1];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend);
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
        return;
    } else if (orientation == "RIGHT"){
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_HANDEDNESS,1,0];
        console.log(featureDataToSend);
        device.sendFeatureReport(featureDataToSend); 
        const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
        return;
    }    
}

function doFactoryReset(device){
    const featureDataToSend = [FEATURE_REPORT, 0x02, 0xFF, 0x02];
    device.sendFeatureReport(featureDataToSend);
    return;
}

function getLifetimeFuel(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_LIFETIME_FUEL];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return intFromLittleEndian(receivedData.slice(3));
}

function getTestValue(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_TEST];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    console.log(receivedData);
    return;
}
function setTestValue(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, SETTING_TEST,1,0];
    console.log(featureDataToSend);
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    return;
}

ipcMain.handle("get/device", async (event, args) => {
    try {
        device = await openHidDevice();
        const deviceModelNumber = getModelNumber(device);
        deviceInfo.deviceModelNumber = deviceModelNumber;

        const deviceSerialNumber = getSerialNumber(device);
        deviceInfo.deviceSerialNumber = deviceSerialNumber;

        const deviceFirstName = getFirstName(device);
        deviceInfo.deviceFirstName = deviceFirstName;

        const deviceHeight = getHeight(device);
        deviceInfo.deviceHieght = deviceHeight;

        const deviceWeight = getWeight(device);
        deviceInfo.deviceWeight = deviceWeight;

        const deviceGender = getGender(device);
        deviceInfo.deviceGender = deviceGender;

        const deviceBandOrientation = getBandOrientation(device);
        deviceInfo.deviceBandOrientation = deviceBandOrientation;

        const deviceLifetimeFuel = getLifetimeFuel(device);
        deviceInfo.deviceLifetimeFuel = deviceLifetimeFuel;

        const deviceTestValue= getTestValue(device);
        deviceInfo.deviceTestValue = deviceLifetimeFuel;

        // Close the HID device
        await closeHidDevice(device);
        return deviceInfo;
    } catch (error) {
        console.error('Error communicating with HID device:', error);
        return error;
    }
});

ipcMain.handle("set/device", async (event, setting) => {
    try {
        device = await openHidDevice();
        if (setting[0] == "BandOrientation"){
            setBandOrientation(device, setting[1]);
        } else if (setting[0] == "deviceFirstName"){
            setFirstName(device, setting[1]);
        } else if (setting[0] == "deviceGender"){
            setGender(device, setting[1]);
        } else if (setting[0] == "deviceHeight"){
            setHeight(device, setting[1]);
        } else if (setting[0] == "deviceWeight"){
            setWeight(device, setting[1]);
        } else if (setting[0] == "deviceTest"){
            setTestValue(device, setting[1]);
        }
        console.log(setting[0]);
        console.log(setting[1]);
        await closeHidDevice(device);
    } catch (error) {
        console.error('Error communicating with HID device:', error);
        return error;
    }
});

ipcMain.handle("reset/device", async (event, setting) => {
    try {
        device = await openHidDevice();
        doFactoryReset(device);
    } catch (error) {
        console.error('Error communicating with HID device:', error);
        return error;
    }
});
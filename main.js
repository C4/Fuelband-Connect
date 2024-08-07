// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const HID = require('node-hid')
const fs = require('fs');
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
const SETTING_GOAL_CELEBRATIONS = 59;
const SETTING_WEIGHT = 61;
const SETTING_HEIGHT = 62;
const SETTING_DATE_OF_BIRTH = 63;
const SETTING_GENDER = 64;
const SETTING_HANDEDNESS = 65; // orientation
const ACCESS_TOKEN = 66;
const REFRESH_TOKEN = 67;
const DISCOVERY_TOKEN = 75;
const BLE_AUTHENTICATION_KEY = 76;
const SETTING_MENU_STARS = 89; // hours won
const SETTING_LIFETIME_FUEL = 94;
const SETTING_FIRST_NAME = 97;

const SETTING_TEST = 0;

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: true
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
const VENDOR_ID = 0x11AC; //Nike
const PRODUCT_ID = 0x317D; //Fuelband SE

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

function stringToLittleEndianByteArray(numberString) {
    // Parse the string to an integer
    const number = parseInt(numberString, 10);
    // Create a buffer to hold the 4 bytes
    const buffer = Buffer.alloc(4);
    // Write the number to the buffer in little-endian format
    buffer.writeUInt32LE(number);
    // Convert the buffer to a byte array
    const byteArray = Array.from(buffer);
    return byteArray;
}

function decimalsToHex(decimalArray) {
    return decimalArray.map(num => {
        // Convert the number to a hex string
        let hexString = num.toString(16).toUpperCase();
        // Ensure the hex string is 2 characters long
        if (hexString.length === 1) {
            hexString = '0' + hexString;
        }
        return hexString;
    });
}

const deviceInfo = {

};


//These are the get functions for interfacing with the Fuelband
function getModelNumber(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_VERSION,0];

    device.write(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    console.log(receivedData);
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
function doInitSE(device){
    const packets = parseHexData(filePath);
    console.log(`Got to init device function`);
    for (const packet of packets) {
        console.log(packet);
        device.write(packet);
        console.log("packet sent");
    }
    return;
}
function doInitOG(device){
    console.log(`Got to init OG device function`);
    return;
}
const filePath = 'init/reset-fullworking.txt'; // Replace with your file path

function sendPackets(packets,device) {
    for (const packet of packets) {

        device.write(packet);
        console.log("packet sent");
    }
}
function parseHexData(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    const packets = [];
    let currentPacket = [];

    for (const line of lines) {
        const hexString = line.slice(6, 53).replace(/\s+/g, ''); // Extract the hex part
        if (hexString.length > 0) {
            const bytes = hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
            currentPacket = currentPacket.concat(bytes);
        } else if (currentPacket.length > 0) {
            packets.push(currentPacket);
            currentPacket = [];
        }
    }

    if (currentPacket.length > 0) {
        packets.push(currentPacket);
    }

    return packets;
}

function getFuelGoal(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,SETTING_GOAL_0];
    // Just getting the first day value here instead of trying to figure out day +1. On the setting side I'll set them all the same for now. 
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    buf = receivedData.slice(-4); // Grab the last 4 digits in the response buffer
    return intFromLittleEndian(buf);
}
function setFuelGoal(device, goal){
    if (!goal || goal.trim() === "") {
        console.error("Goal cannot be empty");
        return;
    } else{
        fuelGoal = stringToLittleEndianByteArray(goal);
        // Will write this to all of the days of the week. Setting codes are 40-46. 
        for (let i = 40; i <= 46; i++) {
            const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, i,fuelGoal.length,...fuelGoal];
            console.log(featureDataToSend);
            device.sendFeatureReport(featureDataToSend);
            const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
        }
    return;
    }
}

/*
function getTestValue(device){
    const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1,2];
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);
    console.log(intFromLittleEndian(receivedData.slice(-6)));
    return;
}*/
function getTestValue(device) {
    //for (let i = 0; i < 10; i++) {
        const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_GET, 1, BLE_AUTHENTICATION_KEY];
        //const featureDataToSend = [FEATURE_REPORT, 0x04, 0xFF, OPCODE_DESKTOP_DATA, SUBCMD_RTC_GET_DATE] 
        device.sendFeatureReport(featureDataToSend);
        const receivedData = device.getFeatureReport(FEATURE_REPORT, 128);
        console.log(`Output for setting ACCESS_TOKEN`, receivedData);
    //}
}
function setTestValue(device){
    // This is testing setting the 4 new values pointed out by Dan
    const featureDataToSend = [
        FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, ACCESS_TOKEN, 35,
        97, 99, 99, 101, 115, 115, 116, 111, 107, 101, 110, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0
     ];
    console.log(featureDataToSend);
    device.sendFeatureReport(featureDataToSend);
    const receivedData = device.getFeatureReport(FEATURE_REPORT,64);


    return;
}

function setUnknownValues(device){
    // Writing settings that are used from a working dump of the fuelband. Unknown what these settings are.
    // This is an attempt to get the fuelband working from a reset state. 
    // Data is from the working pink dump
    const featureDataToSend1 = [
        FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, ACCESS_TOKEN, 35,
        97, 99, 99, 101, 115, 115, 116, 111, 107, 101, 110, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
     ];
     console.log(featureDataToSend1);
     device.sendFeatureReport(featureDataToSend1);



     const featureDataToSend2 = [
        FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, REFRESH_TOKEN, 35,
        114, 101, 102, 114, 101, 115, 104, 116, 111, 107, 101, 110, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
     ];
     console.log(featureDataToSend2);
     device.sendFeatureReport(featureDataToSend2);

     const featureDataToSend3 = [
        FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, DISCOVERY_TOKEN, 6,
        212, 29, 140, 217, 143, 0
     ];
     console.log(featureDataToSend3);
     device.sendFeatureReport(featureDataToSend3);

     const featureDataToSend4= [
        FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, BLE_AUTHENTICATION_KEY, 16,
        66, 106, 115, 251, 121, 209, 242, 241, 246, 3, 189, 190, 238, 247, 49, 165
     ];
     console.log(featureDataToSend4);
     device.sendFeatureReport(featureDataToSend4);


 /*   const featureDataSetting66 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 66,  36,  99, 120,  86, 82, 111, 108,  49, 56,  65, 118, 107,  98,  67, 78,  73,  57, 110, 98, 105,  76,  77, 121, 105, 49,  80,  78,  57, 73,   0,   0,   0,   0,   0, 0,   0,   0];
    console.log(featureDataSetting66);
    device.sendFeatureReport(featureDataSetting66);

    const featureDataSetting67 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 67,  36,  99, 117, 102, 76,  81,  85,  65,  79, 67,  76, 104,  85, 100, 65, 114,  54, 111,  69, 77, 109,  98,  71,  75, 118, 109, 121,  82, 112, 54, 115,  79,  85,   0, 0,   0,   0];
    console.log(featureDataSetting67);
    device.sendFeatureReport(featureDataSetting67);

    const featureDataSetting69 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 69, 4,  80, 70, 0, 0];
    console.log(featureDataSetting69);
    device.sendFeatureReport(featureDataSetting69);

    const featureDataSetting70 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 70,   1, 60];
    console.log(featureDataSetting70);
    device.sendFeatureReport(featureDataSetting70);

    const featureDataSetting72 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 72, 36,  49,  48, 53, 102, 57,  57, 100, 50, 45, 48,  97,  99, 51, 45, 52, 102,  56, 99, 45, 57,  56, 102, 57,45, 98,  52, 100, 49, 50, 51, 102,  54, 98,102, 57,  56];
    console.log(featureDataSetting72);
    device.sendFeatureReport(featureDataSetting72);

    const featureDataSetting73 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 73, 36, 98, 98, 101,57, 99,  49, 55,  55, 45, 48, 56, 54,  50,45, 52,  98, 48,  55, 45, 97, 51, 53, 102,45, 49, 101, 49, 101, 56, 98, 97, 50, 101,55, 57,  99];
    console.log(featureDataSetting73);
    device.sendFeatureReport(featureDataSetting73);

    const featureDataSetting75 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 75,6, 212,  29, 140, 217, 143,0];
    console.log(featureDataSetting75);
    device.sendFeatureReport(featureDataSetting75);

    const featureDataSetting76 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET, 76,  16,72, 167, 201, 5, 207, 167,  32,86,   4, 252, 1, 189,   2, 135,221, 187];
    console.log(featureDataSetting76);
    device.sendFeatureReport(featureDataSetting76);  

    const featureDataSetting78 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  78, 4,   2, 0, 0,0];
    console.log(featureDataSetting78);
    device.sendFeatureReport(featureDataSetting78);  

    const featureDataSetting86 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  86, 4,   1, 0, 108,97];
    console.log(featureDataSetting86);
    device.sendFeatureReport(featureDataSetting86);  

    const featureDataSetting87 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  87, 4, 104, 19, 0,0];
    console.log(featureDataSetting87);
    device.sendFeatureReport(featureDataSetting87);  

    const featureDataSetting89 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  89,   1, 0];
    console.log(featureDataSetting89);
    device.sendFeatureReport(featureDataSetting89);   

    const featureDataSetting92 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  92, 4,   0, 255, 3,128];
    console.log(featureDataSetting92);
    device.sendFeatureReport(featureDataSetting92);  

    const featureDataSetting94 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  94, 4, 193, 215, 1,0];
    console.log(featureDataSetting94);
    device.sendFeatureReport(featureDataSetting94);  

    const featureDataSetting97 = [ FEATURE_REPORT, 0x04, 0xFF, OPCODE_SETTING_SET,  97, 25, 84, 65,77, 77,  89, 0, 0,  0,  0,  0,  0,0,  0,   0, 0, 0,  0,  0,  0,  0,0,  0,   0, 0, 0];
    console.log(featureDataSetting97);
    device.sendFeatureReport(featureDataSetting97);  
*/
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

        const deviceFuelGoal = getFuelGoal(device);
        deviceInfo.deviceFuelGoal = deviceFuelGoal;

        const deviceTestValue= getTestValue(device);
        deviceInfo.deviceTestValue = deviceTestValue;

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
        } else if (setting[0] == "deviceFuelGoal"){
            setFuelGoal(device, setting[1]);
        } else if (setting[0] == "deviceTest"){
            setTestValue(device, setting[1]);
        } else if (setting[0] == "deviceUnknown"){
            setUnknownValues(device,setting[1]);
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

ipcMain.handle("init/device", async (event, model) => {
    try {
        device = await openHidDevice();
        if (model[0] == "SE"){
            doInitSE(device);
        } else if (model[0] == "OG"){
            doInitOG(device);
        }
    } catch (error) {
        console.error('Error communicating with HID device:', error);
        return error;
    }
});



class MemoryReader {
    constructor(sendFunction, memoryErrorToStr) {
      this.send = sendFunction;
      this.memoryErrorToStr = memoryErrorToStr;
    }
  
    async memoryStartOperation(opCode, startSubCmd, options = {}) {
      const verbose = options.verbose || false;
      const buf = await this.send([opCode, startSubCmd, 0x01, 0x00], { reportId: 10, verbose });
      if (buf.length !== 1 || buf[0] !== 0x00) {
        throw new Error(`Failed to start memory operation! status = 0x${buf[0].toString(16)} (${this.memoryErrorToStr(buf[0])}); buf = ${buf}`);
      }
    }
  
    async memoryEndTransaction(opCode, options = {}) {
      const verbose = options.verbose || false;
      const buf = await this.send([opCode, 'SUBCMD_END_TRANSACTION'], { reportId: 10, verbose });
      if (buf.length !== 1 || buf[0] !== 0x00) {
        throw new Error(`Failed to end memory transaction! status = 0x${buf[0].toString(16)} (${this.memoryErrorToStr(buf[0])}); buf = ${buf}`);
      }
    }
  
    async memoryRead(opCode, addr, size, options = {}) {
      const verbose = options.verbose || false;
      const warnOnTruncated = options.warnOnTruncated || true;
  
      await this.memoryStartOperation(opCode, 'SUBCMD_START_READ', { verbose });
  
      let readData = [];
      let bytesRemaining = size;
      let offset = addr;
      const cmdBuf = [opCode, 'SUBCMD_READ_CHUNK', 0, 0, 0, 0];
  
      while (bytesRemaining > 0) {
        let bytesThisRead = bytesRemaining;
        if (bytesThisRead > 58) {
          bytesThisRead = 58;
        }
        cmdBuf[2] = offset & 0xff;
        cmdBuf[3] = (offset >> 8) & 0xff;
        cmdBuf[4] = bytesThisRead & 0xff;
        cmdBuf[5] = (bytesThisRead >> 8) & 0xff;
  
        const rsp = await this.send(cmdBuf, { reportId: 10, verbose });
        if (rsp.length >= 1 && rsp[0] !== 0x00) {
          throw new Error(`Read failed! status = 0x${rsp[0].toString(16)} (${this.memoryErrorToStr(rsp[0])})`);
        }
        if (rsp.length >= 2 && rsp[1] < bytesThisRead) {
          if (warnOnTruncated) {
            console.warn(`WARN: truncated read! expected = ${bytesThisRead}; actual = ${rsp[1]}`);
          }
          readData = readData.concat(rsp.slice(2));
          break;
        } else if (rsp.length >= 2 && rsp[1] > bytesThisRead) {
          console.warn(`WARN: read size > than expected! expected = ${bytesThisRead}; actual = ${rsp[1]}`);
          readData = readData.concat(rsp.slice(2));
          break;
        } else {
          readData = readData.concat(rsp.slice(2));
        }
        bytesRemaining -= bytesThisRead;
        offset += bytesThisRead;
      }
  
      await this.memoryEndTransaction(opCode, { verbose });
  
      return readData;
    }
  
    async readDesktopData(addr, size) {
      const data = await this.memoryRead('OPCODE_DESKTOP_DATA', addr, size);
      this.printHexWithAscii(data);
    }
  
    printHexWithAscii(data) {
      let hexString = '';
      let asciiString = '';
      for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        hexString += byte.toString(16).padStart(2, '0') + ' ';
        asciiString += (byte > 31 && byte < 127) ? String.fromCharCode(byte) : '.';
        if ((i + 1) % 16 === 0) {
          console.log(hexString + ' ' + asciiString);
          hexString = '';
          asciiString = '';
        }
      }
      if (hexString.length > 0) {
        console.log(hexString.padEnd(48, ' ') + ' ' + asciiString);
      }
    }
  }
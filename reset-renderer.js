/**
 * This file is loaded via the <script> tag in the reset.html file and will
 * be executed in the reset-renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

//const get_device = async () => {
async function get_device(){
    return window.api.GetDevice(); // Ensure that GetDevice() returns a Promise
}

async function set_device(value){
    return window.api.SetDevice(value); // Ensure that GetDevice() returns a Promise
}

async function reset_device(){
    return window.api.ResetDevice(); // Ensure that GetDevice() returns a Promise
}

async function init_device(model){
    return window.api.InitDevice(model); // Ensure that GetDevice() returns a Promise
}

// Get a reference to the button element
const connectBtn = document.getElementById('connectBtn');
const modelNumberInput = document.getElementById('modelNumber');
const serialNumberInput = document.getElementById('serialNumber');

// Define the click event handler function
function handleClick() {
    get_device().then(device => {
        console.log(device); // Log the returned value
        modelNumberInput.value = device.deviceModelNumber;
        serialNumberInput.value = device.deviceSerialNumber;

    }).catch(error => {
        console.error('Error:', error); // Log any errors that occur
    });
}

// Attach the click event handler function to the button's click event
connectBtn.addEventListener('click', handleClick);


// Add event listener to reset button
document.getElementById('resetDeviceBtn').addEventListener('click', function() {
    // Show the modal
    document.getElementById('confirmResetModal').classList.add('show');
    document.getElementById('confirmResetModal').style.display = 'block';
});

document.getElementById('resetConfirmedButton').addEventListener('click', function() {
    // Perform reset action here
    document.getElementById('confirmResetModal').classList.remove('show');
    document.getElementById('confirmResetModal').style.display = 'none';
    reset_device().then(device => {
        alert('Device is being reset...');
    })
});

// Add event listener to cancel button
document.querySelector('#confirmResetModal').addEventListener('click', function() {
    // Hide the modal
    document.getElementById('confirmResetModal').classList.remove('show');
    document.getElementById('confirmResetModal').style.display = 'none';
    //document.querySelector('.modal-overlay').style.display = 'none';
});


// Add event listener to init button
document.getElementById('initDeviceBtn').addEventListener('click', function() {
    // Show the modal
    document.getElementById('confirmInitModal').classList.add('show');
    document.getElementById('confirmInitModal').style.display = 'block';
});

document.getElementById('initConfirmedButton').addEventListener('click', function() {
    // Perform reset action here
    document.getElementById('confirmInitModal').classList.remove('show');
    document.getElementById('confirmInitModal').style.display = 'none';
    init_device(['SE']);
});

// Add event listener to cancel button
document.querySelector('#confirmInitModal').addEventListener('click', function() {
    // Hide the modal
    document.getElementById('confirmInitModal').classList.remove('show');
    document.getElementById('confirmInitModal').style.display = 'none';
});
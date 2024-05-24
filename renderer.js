/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
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

// Get a reference to the button element
const connectBtn = document.getElementById('connectBtn');
const modelNumberInput = document.getElementById('modelNumber');
const serialNumberInput = document.getElementById('serialNumber');
//First Name
const firstNameInput = document.getElementById('firstName');
const setFirstNameButton = document.getElementById('setFirstName');
//Height
const heightInput = document.getElementById('height');
const setHeightButton = document.getElementById('setHeight');
//Weight
const weightInput = document.getElementById('weight');
const setWeightButton = document.getElementById('setWeight');
//Gender
const genderInput = document.getElementById('gender');
const setGenderButton = document.getElementById('setGender');
//Fuel Goal
const fuelGoalInput = document.getElementById('fuelGoal');
const setFuelGoalButton = document.getElementById('setFuelGoal');

const bandOrientationInput = document.getElementById('bandOrientation');
const setBandOrientationButton = document.getElementById('setBandOrientation');

const testInput = document.getElementById('testValue');
const setTestValueButton = document.getElementById('setTestValue');

const setUnknownValuesButton = document.getElementById('setUnknownValues');

// Define the click event handler function
function handleClick() {
    get_device().then(device => {
        console.log(device); // Log the returned value
        modelNumberInput.value = device.deviceModelNumber;
        serialNumberInput.value = device.deviceSerialNumber;
        firstNameInput.value = device.deviceFirstName;
        heightInput.value = device.deviceHieght;
        weightInput.value = device.deviceWeight;
        fuelGoalInput.value = device.deviceFuelGoal;

        // Set band orientation dropdown
        // Clear any existing options
        bandOrientationInput.innerHTML = '';
        // Create option elements for LEFT and RIGHT
        const leftOption = document.createElement('option');
        leftOption.textContent = "LEFT";
        bandOrientationInput.appendChild(leftOption);

        const rightOption = document.createElement('option');
        rightOption.textContent = "RIGHT";
        bandOrientationInput.appendChild(rightOption);
        
        if (device.deviceBandOrientation == "LEFT") {
            bandOrientationInput.selectedIndex = 0;
        } else if (device.deviceBandOrientation == "RIGHT") {
            bandOrientationInput.selectedIndex = 1;
        } else if (device.deviceBandOrientation == "UNKNOWN") {
            bandOrientationInput.selectedIndex = -1;
        } else {
            bandOrientationInput.innerHTML = '';
        }

        // Set gender select dropdown
        // Clear any existing options
        genderInput.innerHTML = '';
        // Create option elements for MALE and FEMALE
        const maleOption = document.createElement('option');
        maleOption.textContent = "MALE";
        genderInput.appendChild(maleOption);
        const femaleOption = document.createElement('option');
        femaleOption.textContent = "FEMALE";
        genderInput.appendChild(femaleOption);

        if (device.deviceGender == "MALE") {
            genderInput.selectedIndex = 0;
        } else if (device.deviceGender == "FEMALE") {
            genderInput.selectedIndex = 1;
        } else if (device.deviceGender == "UNKNOWN") {
            genderInput.selectedIndex = -1;
        } else {
            genderInput.innerHTML = '';
        }

    }).catch(error => {
        console.error('Error:', error); // Log any errors that occur
    });
}

// Attach the click event handler function to the button's click event
connectBtn.addEventListener('click', handleClick);

// Event listener for button click
setBandOrientationButton.addEventListener('click', () => {
    const selectedValue = bandOrientationInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["BandOrientation",selectedValue]);
});
setFirstNameButton.addEventListener('click', () => {
    const selectedValue = firstNameInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["deviceFirstName",selectedValue]);
});
setGenderButton.addEventListener('click', () => {
    const selectedValue = genderInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["deviceGender",selectedValue]);
});
setHeightButton.addEventListener('click', () => {
    const selectedValue = heightInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["deviceHeight",selectedValue]);
});
setWeightButton.addEventListener('click', () => {
    const selectedValue = weightInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["deviceWeight",selectedValue]);
});
setFuelGoalButton.addEventListener('click', () => {
    const selectedValue = fuelGoalInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["deviceFuelGoal",selectedValue]);
});


//Testing remove later
setTestValueButton.addEventListener('click', () => {
    const selectedValue = testInput.value;
    console.log("Selected value:", selectedValue); // Do something with the selected value
    set_device(["deviceTest",selectedValue]);
});

setUnknownValuesButton.addEventListener('click', () => {
    console.log("Sending unknown values");
    set_device(["deviceUnknown"],"1");
});

// Add event listener to reset button
document.getElementById('resetDeviceBtn').addEventListener('click', function() {
    // Show the modal
    document.getElementById('confirmResetModal').classList.add('show');
    document.getElementById('confirmResetModal').style.display = 'block';
    //document.querySelector('.modal-overlay').style.display = 'block'; // Show overlay
});

document.getElementById('resetConfirmedButton').addEventListener('click', function() {
    // Perform reset action here
    document.getElementById('confirmResetModal').classList.remove('show');
    document.getElementById('confirmResetModal').style.display = 'none';
    //document.querySelector('.modal-overlay').style.display = 'none';
    reset_device().then(device => {
        alert('Device has been reset.');
    })
});

// Add event listener to cancel button
document.querySelector('#confirmResetModal').addEventListener('click', function() {
    // Hide the modal
    document.getElementById('confirmResetModal').classList.remove('show');
    document.getElementById('confirmResetModal').style.display = 'none';
    //document.querySelector('.modal-overlay').style.display = 'none';
});
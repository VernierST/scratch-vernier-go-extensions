(function (ext) {
  var device = null;
  var currentReading = 0;

  var CMD_GET_STATUS = 0x10,
    CMD_READ_MEMORY = 0x27,
    CMD_GET_SENSOR_ID = 0x28,
    CMD_START_MEASUREMENTS = 0x18,
    CMD_STOP_MEASUREMENTS = 0x19,
    CMD_INIT = 0x1A,
    CMD_SET_MEASUREMENT_PERIOD = 0x1B,
    CMD_SET_LED_STATE = 0x1D;

  var CMD_INIT_RESPONSE = 0x9a,
    CMD_SENSOR_ID_RESPONSE = 0x5d,
    CMD_RESPONSE = 0x5a,
    CMD_MEASUREMENT_RESPONSE = 0x01,
    CMD_READ_MEMORY_RESPONSE = 0x4f,
    CMD_READ_MIDDLE_MEMORY_RESPONSE = 0x47,
    CMD_READ_FINAL_MEMORY_RESPONSE = 0x52;

  var initReceived = false;
  var sensorIDReceived = false;
  var sensorNameRead = false;
  var sensorUnitsRead = false;
  var calibrationRead = false;
  var calibrationEqRead = false;
  var ledSet = false;
  var periodSet = false;
  var memRead = new Uint8Array(16);

  var sensorName = String(" ");
  var sensorUnits = String(" ");
  var calCoefficients = [0, 0, 0];
  var calEquationType = 0;

  function initializeDevice(inputData) {

    if (!initReceived) {
      if (inputData[0] === CMD_INIT_RESPONSE) {
        console.log("Go!Link initialized");
        initReceived = true;
        var out = [0, CMD_GET_SENSOR_ID, 0x0, 0x0, 0, 0, 0, 0];  // Get sensorID number
        device.write(new Uint8Array(out).buffer);
      } else {
        var initCmd = [0, CMD_INIT, 1, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(initCmd).buffer);
      }
      return;
    }

    if (!sensorIDReceived) {
      if (inputData[0] === CMD_SENSOR_ID_RESPONSE) {
        console.log("Connected sensor identified");
        memRead.set(inputData, 0);
        sensorID = memRead[2];
        console.log("Sensor ID number: ", sensorID);
        sensorIDReceived = true;
        // Use sensorID to set sensorName, sensorUnits, calCoefficients, and calEquationType
        // SensorID numbers < 20 are for resistor-ID'd sensors, > 20 are smart sensors
        if (sensorID < 20) {
          console.log("Resistor-ID sensor");
          switch(sensorID) {
            // Resistor ID sensors
            // Thermocouple
            case 1:
              sensorName = "Thermocouple";
              sensorUnits = "°C";
              calCoefficients = [6.2115, -2.454455, 0];
              calEquationType = 1;
              break;
            // Voltage Probe
            case 2:
              sensorName = "Voltage (+/-10 V)";
              sensorUnits = "V";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
            break;
            // Current Probe
            case 3:
              sensorName = "Current";
              sensorUnits = "A";
              calCoefficients = [6.325, -2.665, 0];
              calEquationType = 1;
              break;
            // Resistance Probe
            case 4:
              sensorName = "Resistance";
              sensorUnits = "Ohms";
              calCoefficients = [6.25, -2.5, 0];
              calEquationType = 1;
            break;
            // Differential Voltage
            case 8:
              sensorName = "Differential Voltage";
              sensorUnits = "V";
              calCoefficients = [6.25, -2.5, 0];
              calEquationType = 1;
              break;
            // Current Probe
            case 9:
              sensorName = "Current";
              sensorUnits = "A";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
            break;
            // Temperature Probe
            case 10:
              sensorName = "Temperature";
              sensorUnits = "°C";
              calCoefficients = [0.00102119, 0.000222468, 1.33342E-7];
              calEquationType = 12;
              break;
            // Temperature
            case 11:
              sensorName = "Temperature";
              sensorUnits = "°C";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
            break;
            // TI Light Probe
            case 12:
              sensorName = "TI Light";
              sensorUnits = "(rel)";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
              break;
            // Exercise Heart Rate
            case 13:
              sensorName = "Heart Rate";
              sensorUnits = "V";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
            break;
            // Voltage
            case 14:
              sensorName = "Voltage";
              sensorUnits = "V";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
              break;
            // EKG
            case 15:
              sensorName = "EKG";
              sensorUnits = "V";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
            break;
            // Carbon Dioxide Gas Sensor
            case 17:
              sensorName = "CO2";
              sensorUnits = "ppm";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
              break;
            // Oxygen Gas Sensor
            case 18:
              sensorName = "O2";
              sensorUnits = "%";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
            break;
            // Unknown sensor
            default:
              sensorName = "Unidentified";
              sensorUnits = "volts";
              calCoefficients = [0, 1, 0];
              calEquationType = 1;
              break;
          }
          // Sensor characteristics are determined, now turn on the Go!Link LED
          sensorNameRead = true;
          sensorUnitsRead = true;
          calibrationRead = true;
          calibrationEqRead = true;
          console.log("Calibration set!");
          console.log("Sensor name: ", sensorName);
          console.log("Sensor units: ", sensorUnits);
          console.log("Sensor calibration coefficients: ", calCoefficients);
          console.log("Calibration equation type: ", calEquationType);
          var out = [0, CMD_SET_LED_STATE, 0x80, 0x10, 0, 0, 0, 0]; // Set LED state
          device.write(new Uint8Array(out).buffer);

        } else {
          // If sensor ID number > 20, it's a smart sensor, we'll read the DDS to get calibration information
          console.log("Smart Sensor");
          // Assign sensorName and sensorUnits
          switch(sensorID) {
            // pH Sensor ()
            case 20:
              sensorName = "pH Sensor";
              sensorUnits = "pH";
              break;
            // Conductivity Probe (0-200)
            case 21:
              sensorName = "Conductivity Probe";
              sensorUnits = "µS/cm";
              break;
            // Conductivity Probe (0-2000)
            case 22:
              sensorName = "Conductivity Probe";
              sensorUnits = "µS/cm";
              break;
            // Conductivity Probe (0-20000)
            case 23:
              sensorName = "Conductivity Probe";
              sensorUnits = "µS/cm";
              break;
            // Gas Pressure Sensor
            case 24:
              sensorName = "Gas Pressure Sensor";
              sensorUnits = "kPa";
              break;
            // Dual-Range Force Sensor (+/-10 N)
            case 25:
              sensorName = "Dual-Range Force Sensor";
              sensorUnits = "N";
              break;
            // Dual-Range Force Sensor (+/-50 N)
            case 26:
              sensorName = "Dual-Range Force Sensor";
              sensorUnits = "N";
              break;
            // 25-g Accelerometer
            case 27:
              sensorName = "25G Accelerometer";
              sensorUnits = "m/s^2";
              break;
            // Low-g Accelerometer
            case 28:
              sensorName = "Low-g Accelerometer";
              sensorUnits = "m/s^2";
              break;
            // Light Sensor (0-600)
            case 34:
              sensorName = "Light Sensor";
              sensorUnits = "lux";
              break;
            // Light Sensor (0-6000)
            case 35:
              sensorName = "Light Sensor";
              sensorUnits = "lux";
              break;
            // Light Sensor (0-150000)
            case 36:
              sensorName = "Light Sensor";
              sensorUnits = "lux";
              break;
            // Magnetic Field Sensor (0.32mT)
            case 44:
              sensorName = "Magnetic Field Sensor (0.32mT)";
              sensorUnits = "mT";
              break;
            // Magnetic Field Sensor  (6.4mT)
            case 45:
              sensorName = "Magnetic Field Sensor (6.4mT)";
              sensorUnits = "mT";
              break;
            // Barometer
            case 46:
              sensorName = "Barometer";
              sensorUnits = "kPa";
              break;
            // Relative Humidity Sensor
            case 47:
              sensorName = "Relative Humidity Sensor";
              sensorUnits = "%";
              break;
            // Force Plate (850 N range)
            case 50:
              sensorName = "Force Plate";
              sensorUnits = "N";
              break;
            // Force Plate (3500 N range)
            case 51:
              sensorName = "Force Plate";
              sensorUnits = "N";
              break;
            // UVA Sensor
            case 52:
              sensorName = "UVA Sensor";
              sensorUnits = "mW/m2";
              break;
            // UVB Sensor
            case 53:
              sensorName = "UVB Sensor";
              sensorUnits = "mW/m2";
              break;
            // Salinity Sensor
            case 61:
              sensorName = "Salinity Sensor";
              sensorUnits = "ppt";
              break;
            // Hand Dynamometer
            case 67:
              sensorName = "Hand Dynamometer";
              sensorUnits = "N";
              break;
            // Soil Moisture Sensor
            case 70:
              sensorName = "Soil Moisture Sensor";
              sensorUnits = "%";
              break;
            // Sound Level Meter
            case 74:
              sensorName = "Sound Level Meter";
              sensorUnits = "dB";
              break;
            // O2 Gas Sensor
            case 77:
              sensorName = "O2 Gas Sensor";
              sensorUnits = "%";
              break;
            // Anemometer
            case 91:
              sensorName = "Anemometer";
              sensorUnits = "m/s";
              break;
            // Sound Level Sensor
            case 98:
              sensorName = "Optical Dissolved Oxygen Sensor";
              sensorUnits = "%";
              break;
            // Sound Level Sensor
            case 118:
              sensorName = "Sound Level Sensor";
              sensorUnits = "dB";
              break;
            // Unknown sensor
            default:
              sensorName = "Unidentified Sensor";
              sensorUnits = "volts";
              break;
          }
          sensorNameRead = true;
          sensorUnitsRead = true;
          var out = [0, CMD_READ_MEMORY, 0x46, 0x0C, 0, 0, 0, 0]; // Read the calibration coefficients from the DDS, starts on 70d = 0x46 , 12d = 0xC bytes long
          device.write(new Uint8Array(out).buffer);
          console.log("Reading calibration");
        }

      } else {
        var sensorIDCmd = [0, CMD_GET_SENSOR_ID, 0, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(sensorIDCmd).buffer);
      }
      return;
    }


    if (!calibrationRead) {
      if (inputData[0] === CMD_READ_MEMORY_RESPONSE) {
        memRead.set(inputData, 0);
        console.log("Calibration 1");
      } else if (inputData[0] === 0x56) { // Final memory packet header: 56h = 40h (last response packet) + 6 NV mem bytes + 10h
        if (memRead[0] != CMD_READ_MEMORY_RESPONSE) {
          var out = [0, CMD_READ_MEMORY, 0x46, 0x0C, 0, 0, 0, 0];
          device.write(new Uint8Array(out).buffer);
          return;
        }
        console.log("Calibration 2");
        memRead.set(inputData, 8);
        console.log(memRead);
        calCoefficients[0] = IEEEtoFloat([memRead[2], memRead[3], memRead[4], memRead[5]]);
        calCoefficients[1] = IEEEtoFloat([memRead[6], memRead[7], memRead[9], memRead[10]]);
        calCoefficients[2] = IEEEtoFloat([memRead[11], memRead[12], memRead[13], memRead[14]]);
        console.log("Sensor calibration read: ", calCoefficients);
        calibrationRead = true;
        memRead.fill(0); // Clear out memRead
        console.log("memRead cleared?", memRead, memRead.length);
        var out = [0, CMD_READ_MEMORY, 0x3A, 0x01, 0, 0, 0, 0]; // Sensor calibration equation type: Starts on 58d = 0x3A, 1d = 0x1 byte long
        device.write(new Uint8Array(out).buffer);
      } else {
        var out = [0, CMD_READ_MEMORY, 0x46, 0x0C, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      }
      return;
    }


    if (!calibrationEqRead) {
      if (inputData[0] === 0x5A) {
        memRead.set(inputData, 0);
        calEquationType = memRead[2];
        console.log("Calibration equation type read: ", calEquationType);
        calibrationEqRead = true;
        memRead.fill(0); // Clear out memRead
        console.log("memRead cleared?", memRead, memRead.length);
        var out = [0, CMD_SET_LED_STATE, 0x80, 0x10, 0, 0, 0, 0]; // Set LED to green
        device.write(new Uint8Array(out).buffer);
      } else {
        var out = [0, CMD_READ_MEMORY, 0x3A, 0x01, 0, 0, 0, 0]; // Sensor calibration equation type: Starts on 58d = 0x3A, 1d = 0x1 byte long
        device.write(new Uint8Array(out).buffer);
      }
      return;
    }

    if (!ledSet) {
      if (inputData[1] === CMD_SET_LED_STATE) {
        console.log("Go!Link LED is on");
        console.log("Go!Link Testing Message")
        var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0x27, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
        ledSet = true;
      } else {
        var out = [0, CMD_SET_LED_STATE, 0x80, 0x10, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      }
      return;
    }

    if (!periodSet) {
      if (inputData[1] === CMD_SET_MEASUREMENT_PERIOD) {
        console.log("Go!Link measurement period set");
        var out = [0, CMD_START_MEASUREMENTS, 0, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
        periodSet = true;

        clearInterval(poller);
        poller = setInterval(function() {
          device.read(function(rawData) {
            var data = new Uint8Array(rawData);
            if (data.length > 0)
              processInput(data);
          });
        }, 50);

      } else {
        var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0x27, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      }
      return;
    }
  }

  function processInput(inputData) {
    if (inputData[0] === CMD_MEASUREMENT_RESPONSE) {
      // Convert to a 16-bit unsigned int
      var measurement = (inputData[3] << 8) | (inputData[2] & 0xFF);

      // Convert to a 16-bit signed int (bit 15 indicates sign)
      if ((measurement & 0x8000) > 0) {
        measurement = measurement - 0x10000;
      }

      // Convert to volts
      var volts = ((2.5 / 32768) * measurement) + 2.5;

      // Convert to a sensor reading
      switch (calEquationType) {
        case 1:
          currentReading = calCoefficients[0] + (calCoefficients[1] * volts);
          break;
        case 2:
          currentReading = calCoefficients[0] + (calCoefficients[1] * volts) + (calCoefficients[2] * volts * volts);
          break;
        case 12:
          var temp = 15000 * volts / (5 - volts);
          temp = Math.log(temp);
          temp = 1 / (calCoefficients[0] + calCoefficients[1] * temp + calCoefficients[2] * temp * temp * temp);
          currentReading = temp - 273.15;
          break;
        default:
          currentReading = volts;
          break;
      }

      console.log(currentReading);
    }
  }

  function IEEEtoFloat(bytes) {
    var s = bytes[3] >> 7;
    var e = ((bytes[3] & 0x7F) << 1) | (bytes[2] >> 7);
    var f = ((bytes[2] & 0x7F) << 16) | (bytes[1] << 8) | bytes[0];
    if (e === 0 && f != 0) {
      e = -126;
      var m = 0.0;
    } else {
      e -= 127;
      var m = 1.0;
    }
    for (var i=0; i < 23; i++) {
      if ((f >> (23 - i)) & 0x1) {
        m += Math.pow(2, -i);
      }
    }
    return Math.pow(-1, s) * Math.pow(2, e) * m;
  }

  ext.getReading = function() {
    var temp = currentReading;
    return parseFloat(Math.round(temp * 100) / 100).toFixed(2);
  };

  ext.getSensorName = function() {
    return sensorName;
  };

  ext.getSensorUnits = function() {
    return sensorUnits;
  };

  ext.compareReading = function(op, limit) {
    var temp = ext.getReading();
    if (op == '>') {
      return temp > limit;
    } else if (op == '<') {
      return temp < limit;
    } else if (op == '=') {
      return temp == limit;
    } else {
      return false;
    }
  };

  var poller = null;
  ext._deviceConnected = function (dev) {
    if (device) return;

    device = dev;
    device.open(function(dev) {
      if (dev == null) {
        device = null;
        return;
      }

      var initCmd = [0, CMD_INIT, 1, 0, 0, 0, 0, 0];
      device.write(new Uint8Array(initCmd).buffer);

      poller = setInterval(function() {
        device.read(function(rawData) {
          var inputData = new Uint8Array(rawData);
          if (inputData.length > 0)
            initializeDevice(inputData);
        });
      }, 20);
    });
  };

  ext._deviceRemoved = function (dev) {
    if (device != dev) return;
    if (poller) poller = clearInterval(poller);
    device = null;

    //Reset init flags when device is removed
    initReceived = false;
    sensorIDReceived = false;
    sensorNameRead = false;
    sensorUnitsRead = false;
    calibrationRead = false;
    calibrationEqRead = false;
    ledSet = false;
    periodSet = false;
  };

  ext._shutdown = function () {
    if (poller) poller = clearInterval(poller);
    if (device) {
      var out = [0, CMD_SET_LED_STATE, 0, 0x04, 0, 0, 0, 0];
      device.write(new Uint8Array(out).buffer);
      out = [0, CMD_STOP_MEASUREMENTS, 0, 0, 0, 0, 0, 0];
      device.write(new Uint8Array(out).buffer);
      device.close();
    }
    device = null;
  };

  ext._getStatus = function () {
    if (!device) return {status: 1, msg: 'Go!Link disconnected'};
    return {status: 2, msg: ' Go!Link connected'};
  };

  var descriptor = {
    blocks: [
      ['r', 'Sensor reading', 'getReading'],
      ['r', 'Sensor name', 'getSensorName'],
      ['r', 'Sensor units', 'getSensorUnits'],
      ['h', 'When sensor reading %m.ops %n', 'compareReading', '>', '20']
    ],
    menus: {
      ops:  ['>','<','=']
    },
    url: 'https://www.vernier.com/products/interfaces/go-link/'
  };

  ScratchExtensions.register('Vernier Go!Link', descriptor, ext, {type: 'hid', vendor: 0x08f7, product: 3});
})({});

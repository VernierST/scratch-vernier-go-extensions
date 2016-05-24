(function (ext) {
  var device = null;
  var currentTemp = 0;

  var CMD_GET_STATUS = 0x10,
    CMD_READ_MEMORY = 0x17,
    CMD_START_MEASUREMENTS = 0x18,
    CMD_STOP_MEASUREMENTS = 0x19,
    CMD_INIT = 0x1A,
    CMD_SET_MEASUREMENT_PERIOD = 0x1B,
    CMD_SET_LED_STATE = 0x1D;

  var CMD_INIT_RESPONSE = 0x9a,
    CMD_RESPONSE = 0x5a,
    CMD_MEASUREMENT_RESPONSE = 0x01,
    CMD_READ_MEMORY_RESPONSE = 0x4f,
    CMD_READ_FINAL_MEMORY_RESPONSE = 0x52;

  var initReceived = false;
  var calibrationRead = false;
  var ledSet = false;
  var periodSet = false;
  var memRead = new Uint8Array(16);

  var intercept = 0;
  var slope = 0;
  
  function initializeDevice(inputData) {

    if (!initReceived) {
      if (inputData[0] === CMD_INIT_RESPONSE) {
        console.log("Go!Temp initialized");
        initReceived = true;
        var out = [0, CMD_READ_MEMORY, 0x46, 0x8, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      } else {
        var initCmd = [0, CMD_INIT, 0, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(initCmd).buffer);
      }
      return;
    }

    if (!calibrationRead) {
      if (inputData[0] === CMD_READ_MEMORY_RESPONSE) {
        memRead.set(inputData, 0);
      } else if (inputData[0] === CMD_READ_FINAL_MEMORY_RESPONSE) {
        if (memRead[0] != CMD_READ_MEMORY_RESPONSE) {
          var out = [0, CMD_READ_MEMORY, 0x46, 0x8, 0, 0, 0, 0];
          device.write(new Uint8Array(out).buffer);
          return;
        }
        memRead.set(inputData, 8);
        intercept = IEEEtoFloat([memRead[2], memRead[3], memRead[4], memRead[5]]);
        slope = IEEEtoFloat([memRead[6], memRead[7], memRead[9], memRead[10]]);
        console.log("Go!Temp calibration read");
        calibrationRead = true;
        var out = [0, CMD_SET_LED_STATE, 0x80, 0x10, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      } else {
        var out = [0, CMD_READ_MEMORY, 0x46, 0x8, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      }
      return;
    }

    if (!ledSet) {
      if (inputData[1] === CMD_SET_LED_STATE) {
        console.log("Go!Temp LED is on");
        var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0x43, 0x0F, 0, 0, 0, 0];
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
        console.log("Go!Temp measurement period set");
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
        var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0x43, 0x0F, 0, 0, 0, 0];
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

      // Convert to degrees Celcius
      currentTemp = (slope * volts) + intercept;
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

  ext.getTemp = function(scale) {
    var temp = currentTemp;
    if (scale === '\u00B0F')
      temp = (temp * 1.8) + 32;
    return parseFloat(Math.round(temp * 100) / 100).toFixed(2);
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

      var initCmd = [0, CMD_INIT, 0, 0, 0, 0, 0, 0];
      device.write(new Uint8Array(initCmd).buffer);

      poller = setInterval(function() {
        device.read(function(rawData) {
          var inputData = new Uint8Array(rawData);
          if (inputData.length > 0)
            initializeDevice(inputData);
        });
      }, 10);
    });
  };

  ext._deviceRemoved = function (dev) {
    if (device != dev) return;
    if (poller) poller = clearInterval(poller);
    device = null;
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
    if (!device) return {status: 1, msg: 'Go!Temp disconnected'};
    return {status: 2, msg: ' Go!Temp connected'};
  };

  var descriptor = {
    blocks: [
      ['r', 'temperature %m.scale', 'getTemp', '\u00B0C'],
    ],
    menus: {
      scale: ['\u00B0C', '\u00B0F']
    },
    url: 'http://www.vernier.com/products/sensors/temperature-sensors/go-temp/'
  };

  ScratchExtensions.register('Vernier Go!Temp', descriptor, ext, {type: 'hid', vendor: 0x08f7, product: 2});
})({});

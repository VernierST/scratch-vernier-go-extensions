(function (ext) {
  var device = null;
  var currentPosition = 0;

  var CMD_GET_STATUS = 0x10,
    CMD_START_MEASUREMENTS = 0x18,
    CMD_STOP_MEASUREMENTS = 0x19,
    CMD_INIT = 0x1A,
    CMD_SET_MEASUREMENT_PERIOD = 0x1B,
    CMD_SET_LED_STATE = 0x1D;

  var CMD_INIT_RESPONSE = 0x9a,
    CMD_RESPONSE = 0x5a,
    CMD_MEASUREMENT_RESPONSE = 0x01;

  var initReceived = false;
  var ledSet = false;
  var periodSet = false;
  var memRead = new Uint8Array(16);

  var intercept = 0;
  var slope = 0;
  
  function initializeDevice(inputData) {

    if (!initReceived) {
      if (inputData[0] === CMD_INIT_RESPONSE) {
        console.log("Go!Motion initialized");
        initReceived = true;
        var out = [0, CMD_SET_LED_STATE, 0x80, 0x10, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      } else {
        var initCmd = [0, CMD_INIT, 0, 0, 0, 0, 0, 0];
        device.write(new Uint8Array(initCmd).buffer);
      }
      return;
    }

    if (!ledSet) {
      if (inputData[1] === CMD_SET_LED_STATE) {
        console.log("Go!Motion LED is on");
        var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0xF4, 0x01, 0, 0, 0, 0];
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
        console.log("Go!Motion measurement period set");
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
        }, 10);

      } else {
        var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0xF4, 0x01, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
      }
      return;
    }
  }

  function processInput(inputData) {
    if (inputData[0] === CMD_MEASUREMENT_RESPONSE) {
      var measurement = (inputData[5] << 32) | (inputData[4] << 16) | (inputData[3] << 8) | (inputData[2]);
      currentPosition = measurement * 0.000001;
    }
  }

  ext.getPosition = function(scale) {
    var position = currentPosition;
    if (scale === 'ft')
      position = (position * 3.28084);
    return parseFloat(Math.round(position * 100) / 100).toFixed(2);
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
      var out = [0, CMD_STOP_MEASUREMENTS, 0, 0, 0, 0, 0, 0];
      device.write(new Uint8Array(out).buffer);     
      out = [0, CMD_SET_LED_STATE, 0, 0x04, 0, 0, 0, 0];
      device.write(new Uint8Array(out).buffer);
      
      device.close();
    }
    device = null;
  };

  ext._getStatus = function () {
    if (!device) return {status: 1, msg: 'Go!Motion disconnected'};
    return {status: 2, msg: ' Go!Motion connected'};
  };

  var descriptor = {
    blocks: [
      ['r', 'position %m.scale', 'getPosition', 'm'],
    ],
    menus: {
      scale: ['m', 'ft']
    },
    url: 'http://www.vernier.com/products/sensors/motion-detectors/go-mot'
  };

  ScratchExtensions.register('Vernier Go!Motion', descriptor, ext, {type: 'hid', vendor: 0x08f7, product: 4});
})({});

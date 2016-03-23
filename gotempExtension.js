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
    CMD_READ_MEMORY_RESPONSE = 0x4f;

  function processData(inputData) {
    var data = new Uint8Array(inputData);

    switch (data[0]) {
      case CMD_MEASUREMENT_RESPONSE:
        var measurement = (data[3] << 8) | (data[2] & 0xFF);
        var volts = ((2.5 / 32768) * measurement) + 2.5;
        var reading = (102.4 * volts) - 257.812988281;
        currentTemp = parseFloat(Math.round(reading * 100) / 100).toFixed(2);
        break;
      case CMD_INIT_RESPONSE:
        console.log('Received init response');
        var out = [0, CMD_SET_LED_STATE, 0x80, 0x10, 0, 0, 0, 0];
        device.write(new Uint8Array(out).buffer);
        break;
      case CMD_RESPONSE:
        switch (data[1]) {
          case CMD_SET_LED_STATE:
            console.log('Received LED state response');
            var out = [0, CMD_SET_MEASUREMENT_PERIOD, 0x43, 0x0F, 0, 0, 0, 0];
            device.write(new Uint8Array(out).buffer);
            break;
          case CMD_SET_MEASUREMENT_PERIOD:
            console.log('Received measurement period response');
            var out = [0, CMD_START_MEASUREMENTS, 0, 0, 0, 0, 0, 0];
            device.write(new Uint8Array(out).buffer);
            break;
          case CMD_START_MEASUREMENTS:
            break;
        }  
        break;
      default:
        console.log("Unknown command:");
        console.log(data);
        break;
    }
  }

  ext.getTemp = function(scale) {
    if (scale === '\u00B0C')
      return currentTemp;
    else
      return (currentTemp * 1.8) + 32;
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
        device.read(function(inputData) {
          processData(inputData);
        });
      }, 50);
    });
  };

  ext._deviceRemoved = function (dev) {
    if (device != dev) return;
    if (poller) poller = clearInterval(poller);
    device = null;
  };

  ext._shutdown = function () {
    if (poller) poller = clearInterval(poller);
    if (device) device.close();
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

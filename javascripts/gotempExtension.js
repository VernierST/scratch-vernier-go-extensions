(function (ext) {
  var device = null;
  var rawData = null;
  var reading = 0;

  var CMD_INIT = 0x1a,
    CMD_INIT_RESPONSE = 0x9a,
    CMD_LED = 0x1d;

  ext.getTemp = function() {
    if (!rawData) return null;
    var measurement = (rawData[3] << 8) | (rawData[2] & 0xFF);
    var volts = ((2.5 / 32768) * measurement) + 2.5;
    return (102.4 * volts) - 256;
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

      var initCmd = [CMD_INIT, 0, 0, 0, 0, 0, 0, 0];
      var ledCmd = [CMD_LED, 0x80, 0x10, 0, 0, 0, 0, 0];

      device.write(new Uint8Array(initCmd).buffer);
      device.write(new Uint8Array(ledCmd).buffer);

      poller = setInterval(function() {
        device.read(function (data3) {
          rawData = new Uint8Array(data3);
          console.log(rawData);
        });
      }, 20);
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
      ['r', 'temperature', 'getTemp'],
    ],
    url: 'http://www.vernier.com/products/sensors/temperature-sensors/go-temp/'
  };

  ScratchExtensions.register('Vernier Go!Temp', descriptor, ext, {type: 'hid', vendor: 0x08f7, product: 2});
})({});

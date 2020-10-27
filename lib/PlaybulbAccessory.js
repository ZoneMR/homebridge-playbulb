var PlaybulbDiscovery = require('./PlaybulbDiscovery.js');

var Accessory, Characteristic, Service;

class PlaybulbAccessory {
    constructor(log, config) {
        this.log = log;

        //Configuration
        this.name = config["name"];
        this.address = config["address"];

        //Bluetooth Connection
        this.bulb = null;

        //Timers
        this.writeTimer = null;
        this.timerInterval = null;
        this.timer = 0;

        //HomeKit Characteristic State
        this.on = 0;
        this.hue = 0;
        this.saturation = 0;
        this.brightness = 0;

        this.configureServices();

        PlaybulbDiscovery.onAddressConnected(this.address, this.connected.bind(this));
    }

    static setHomebridge(homebridge) {
        Accessory = homebridge.platformAccessory;
        Service = homebridge.hap.Service;
        Characteristic = homebridge.hap.Characteristic;
    }

    configureServices() {
        var service = this.service = new Service.Lightbulb(this.name);
        service.getCharacteristic(Characteristic.On).on('get', this.getPower.bind(this));
        service.getCharacteristic(Characteristic.On).on('set', this.setPower.bind(this));
        service.addCharacteristic(Characteristic.Brightness).on('get', this.getBrightness.bind(this));
        service.getCharacteristic(Characteristic.Brightness).on('set', this.setBrightness.bind(this));
        service.addCharacteristic(Characteristic.Hue).on('get', this.getHue.bind(this));
        service.getCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this));
        service.addCharacteristic(Characteristic.Saturation).on('get', this.getSaturation.bind(this));
        service.getCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this));

        var timerService = this.timerService = new Service.Timer('Auto Off Timer');
        timerService.getCharacteristic(Characteristic.Timer).on('get', this.getTimer.bind(this));
        timerService.getCharacteristic(Characteristic.Timer).on('set', this.setTimer.bind(this));

        var infoService = this.infoService = new Service.AccessoryInformation();
        infoService.setCharacteristic(Characteristic.Manufacturer, "Mipow");
        infoService.setCharacteristic(Characteristic.Model, "Playbulb Candle");
        infoService.setCharacteristic(Characteristic.SerialNumber, this.address);

	var batteryService = this.batteryService = new Service.BatteryService();
	batteryService.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGEABLE);
	batteryService.getCharacteristic(Characteristic.StatusLowBattery).on('get', this.getStatusLowBattery.bind(this));
	batteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
    }

    getServices() {
        return [this.service, this.timerService, this.infoService, this.batteryService];
    }

    connected(bulb) {
        this.log("Connected on address " + this.address);

        this.bulb = bulb;
        this.bulb.on('disconnect', this.disconnect.bind(this));

        this.writeColor();
    }

    reconnected() {
        this.log("Playbulb Reconnected", this.address);

        this.writeColor();
    }

    identification(paired, callback) {
        this.log.info("Identify candle " + this.name);
        callback();
    }

    disconnect(error) {
        this.log("Playbulb Disconnected", this.address);

        this.bulbColorCharacteristic = null;

        setTimeout(() => {
            this.bulb.connect((error) => {
                if (!error) {
                    this.reconnected();
                }
            });
        }, 1000);
    }

    timerTick() {
        this.timer -= 5;

        //this.log("Timer Tick. Remaining Seconds:", this.timer);

        if(this.timer <= 0) {
            this.service.setCharacteristic(Characteristic.On, 0);

            this.timer = 0;
        }

        this.timerService.setCharacteristic(Characteristic.Timer, this.timer);
    }

    getStatusLowBattery(callback) {
        this.log.info("getStatusLowBattery");
        this.bulb.readHandle(0x0022, (error, data) => {
             this.log.info("getStatusLowBattery read", error, data && data[0] <= 90);
             callback(error, data && data[0] <= 90);
        });
    }

    getBatteryLevel(callback) {
        this.log.info("getBatteryLevel");
	this.bulb.readHandle(0x0022, (error, data) => {
             this.log.info("getBatteryLevel read", error, data && data[0]);
             callback(error, data && data[0]);
        });
    }

    getPower(callback) {
        this.log.info("getPower", this.on);
        callback(null, this.on);
    }

    setPower(value, callback) {
        this.on = value;
        this.log('setPower', value);
        this.delayedWriteColor();
        callback(null);
    }

    getTimer(callback) {
        this.log.info("getTimer", this.timer);
        callback(null, this.timer);
    }

    setTimer(value, callback) {
        this.timer = value;
        this.log('setTimer', value);

        clearInterval(this.timerInterval);

        if(value) {
            this.timerInterval = setInterval(this.timerTick.bind(this), 5000);
        }

        callback(null);
    }

    getHue(callback) {
        this.log.info("getHue", this.hue);
        callback(null, this.hue);
    }

    setHue(value, callback) {
        this.hue = value;
        this.log('setHue', value);
        this.delayedWriteColor();
        callback(null);
    }

    getSaturation(callback) {
        this.log.info("getSaturation", this.saturation);
        callback(null, this.saturation);
    }

    setSaturation(value, callback) {
        this.saturation = value;
        this.log('setSaturation', value);
        this.delayedWriteColor();
        callback(null);
    }

    getBrightness(callback) {
        this.log.info("getBrightness", this.brightness);
        callback(null, this.brightness);
    }

    setBrightness(value, callback) {
        this.brightness = value;
        this.log('setBrightness', value);
        this.delayedWriteColor();
        callback(null);
    }

    delayedWriteColor() {
        if (!this.writeTimer) {
            this.writeTimer = setTimeout(() => {
                this.writeColor();
                this.writeTimer = null;
            }, 50);
        }
    }

    writeColor() {
        /*if (!this.bulbColorCharacteristic) {
            this.log("Can't writeColor, bulb is AWOL");
            return;
        }*/

        this.log("writeColor");

        var rgb = this._hsvToRgb(this.hue, this.saturation, this.brightness);
        var buf = Buffer.from([0, rgb.R, rgb.G, rgb.B]);

        if (!this.on) {
            buf = Buffer.from([0, 0, 0, 0]);
        }

        if(this.flicker) {
		this.bulb.writeHandle(0x0017, Buffer.from([buf[0], buf[1], buf[2], buf[3], 4, 0, 15, 15]), true, (error) => {
        	    if (error) {
               	 	this.log.info("Error while setting value on addres " + this.address + ": " + error);
	            	}
        	});

return;
	}

        this.bulb.writeHandle(0x0019, buf, true, (error) => {
            if (error) {
                this.log.info("Error while setting value on addres " + this.address + ": " + error);
            }
        });
    }

    _hsvToRgb(h, s, v) {
        var c = (v / 100.0) * (s / 100.0);
        var x = c * (1.0 - Math.abs(((h / 60.0) % 2) - 1));
        var m = (v / 100.0) - c;
        var rt = c;
        var gt = 0.0;
        var bt = x;
        if (h >= 0.0 && h < 60.0) {
            rt = c;
            gt = x;
            bt = 0.0;
        } else if (h >= 60.0 && h < 120.0) {
            rt = x;
            gt = c;
            bt = 0.0;
        } else if (h >= 120.0 && h < 180.0) {
            rt = 0.0;
            gt = c;
            bt = x;
        } else if (h >= 180.0 && h < 240.0) {
            rt = 0.0;
            gt = x;
            bt = c;
        } else if (h >= 240.0 && h < 300.0) {
            rt = x;
            gt = 0.0;
            bt = c;
        }
        var r = Math.round((rt + m) * 255.0);
        var g = Math.round((gt + m) * 255.0);
        var b = Math.round((bt + m) * 255.0);
        return { R: r, G: g, B: b };
    }

    _rgbToHsv(r, g, b) {
        var rt = r / 255.0;
        var gt = g / 255.0;
        var bt = b / 255.0;
        var cmax = Math.max(rt, gt, bt);
        var cmin = Math.min(rt, gt, bt);
        var delta = cmax - cmin;
        var h = 0;
        if (delta !== 0) {
            if (cmax === rt) {
                h = 60.0 * (((gt - bt) / delta) % 6);
            } else if (cmax === gt) {
                h = 60.0 * (((bt - rt) / delta) + 2);
            } else {
                h = 60.0 * (((rt - gt) / delta) + 4);
            }
        }
        var s = 0;
        if (cmax !== 0) {
            s = (delta / cmax) * 100.0;
        }
        var v = cmax * 100.0;
        return { H: h, S: s, V: v };
    }
}

module.exports = PlaybulbAccessory;

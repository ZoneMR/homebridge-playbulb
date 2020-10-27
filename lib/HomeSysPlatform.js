const util = require('util');

var Accessory, Characteristic, Service;

class HomeSysPlatform {
    constructor() {}

    static setHomebridge(homebridge) {
        Accessory = homebridge.platformAccessory;
        Service = homebridge.hap.Service;
        Characteristic = homebridge.hap.Characteristic;

        this.registerCustomServices();
    }

    static registerCustomServices() {
        //Timer Characteristic
        Characteristic.Timer = function() {
            Characteristic.call(this, 'Timer', Characteristic.Timer.UUID);
            this.setProps({
                format: Characteristic.Formats.INT,
                unit: Characteristic.Units.SECONDS,
                minValue: 0,
                maxValue: 7200,
                stepValue: 60,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
                    Characteristic.Perms.WRITE
                ]
            });
            this.value = this.getDefaultValue();
        };
        util.inherits(Characteristic.Timer, Characteristic);
        Characteristic.Timer.UUID = '00000001-8CB6-4DD0-BF4E-7805C5EC89F7';

        //Timer Service
        Service.Timer = function(displayName, subtype) {
            Service.call(this, displayName, Service.Timer.UUID, subtype);
            this.addCharacteristic(Characteristic.Timer);
        };
        util.inherits(Service.Timer, Service);
        Service.Timer.UUID = '10000001-8CB6-4DD0-BF4E-7805C5EC89F7';
    }
}

module.exports = HomeSysPlatform;

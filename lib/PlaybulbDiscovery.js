var noble = require('noble');

var DISCOVER_SERVICE_TYPES = ['ff02'];

class PlaybulbDiscovery {
    constructor() {
        this.discoveredBulbs = [];
        this.connectionCallbacks = {};

        noble.on('stateChange', this.nobleStateChange.bind(this));
        noble.on('discover', this.bulbDiscovered.bind(this));

        setTimeout(() => {
            var requiredCount = Object.keys(this.connectionCallbacks).length;

            console.log(`Looking for ${requiredCount} bulbs.`);

            if (requiredCount) {
                this.initiateScanning();
            }
        }, 1000);
    }

    onAddressConnected(address, callback) {
        this.connectionCallbacks[address] = callback;
    }

    initiateScanning() {
        if (noble.state === "poweredOn") {
            console.log("Starting BLE Scanning");

            noble.startScanning(DISCOVER_SERVICE_TYPES, false);
        }
        else {
            console.log("Cannot initiate BLE scanning", noble.state);
        }
    }

    nobleStateChange(state) {
        console.log("BT State ->", state);

        /*if (state !== 'poweredOn') {
            console.log("Stopped scanning");
            noble.stopScanning();
        }

        this.initiateScanning();*/
    }

    bulbDiscovered(bulb) {
        var address = bulb.address;

        if (this.connectionCallbacks[address]) {
            console.log("Discovered Playbulb.", address);

            this.discoveredBulbs.push(bulb);

            var requiredCount = Object.keys(this.connectionCallbacks).length;

            console.log(`Found ${this.discoveredBulbs.length} / ${requiredCount} bulbs`);

            if (this.discoveredBulbs.length == requiredCount) {
                console.log("Done scanning.");
                noble.stopScanning();

                setTimeout(this.connectToNextBulb.bind(this), 500);
            }
        } else {
            console.log("Discovered Playbulb (not in config)", address);
        }
    }

    connectToNextBulb() {
        var bulb = this.discoveredBulbs.shift();

        bulb.connect(function(error) {
            this.bulbConnected(error, bulb);
        }.bind(this));
    }

    bulbConnected(error, bulb) {
        if (error) {
            console.log("Failed to connect to candle on address " + bulb.address + ": " + error);
            return;
        }

        var address = bulb.address;
        console.log("Connected to Playbulb", address);

        var callback = this.connectionCallbacks[address];

        if (callback && !error) {
            callback(bulb);
            
            delete this.connectionCallbacks[address];
        }

        if(this.discoveredBulbs.length) {
            setTimeout(this.connectToNextBulb.bind(this), 500);
        } else {
            console.log("Connection has now been attempted to all configured bulbs.");
        }
    }
}

module.exports = new PlaybulbDiscovery;

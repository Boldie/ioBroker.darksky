'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const apiurl = 'https://api.darksky.net/forecast/';
const adapterName = require('./package.json').name.split('.').pop();

function createOrSetState(id, setobj, setval) {
	adapter.getObject(id, function(err, obj) {
		if(err || !obj) {
			adapter.setObject(id, setobj, function() {
				adapter.setState(id, setval, true);
			});
		} else {
			adapter.setState(id, setval, true);
		}
	});
}

function setOrUpdateState(id, name, setval, setunit, settype, setrole) {
	if(!setunit) {
		setunit = '';
	}
	if(!settype) {
		settype = 'number';
	}
	if(!setrole) {
		setrole = 'value';
	}
	
	let obj = {
		type: 'state',
		common: {
			name: name,
			type: settype,
			role: setrole,
			read: true,
			write: false,
			unit: setunit
		},
		native: {}
	};
	createOrSetState(id, obj, setval);
}

let adapter;
var secretKey;
var request = require('request');

function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		name: 'darksky'
	});

	adapter = new utils.Adapter(options);

	adapter.on('unload', function(callback) {
		adapter.log.info('[END] Stopping DarkSky adapter...');
	});

	adapter.on('ready', function() {
		if(!adapter.config.secretKey) {
			adapter.log.warn('[START] API key not set');
			adapter.stop();
		} else {
			adapter.log.info('[START] Starting DarkSky adapter');
			adapter.getForeignObject('system.config', (err, obj) => {
				if (obj && obj.native && obj.native.secret) {
					//noinspection JSUnresolvedVariable
					adapter.config.secretKey = decrypt(obj.native.secret, adapter.config.secretKey);
				} else {
					//noinspection JSUnresolvedVariable
					adapter.config.secretKey = decrypt('ZgfrC6gFeD1jJOM', adapter.config.secretKey);
				}
				
				if(obj && obj.common) {
					adapter.config.iob_lon = obj.common.longitude;
					adapter.config.iob_lat = obj.common.latitude;
				}
				
				
				if(!adapter.config.iob_lon || !adapter.config.iob_lat) {
					adapter.log.warn('Could not start adapter because the system\'s longitude and latitude were not found. Please check system config.');
					adapter.stop();
					return;
				}
				
				main();
			});
		}
	});

	return adapter;
}


function main() {
	secretKey = adapter.config.secretKey;

	let req_opts = {url: apiurl + secretKey + '/' + adapter.config.iob_lat + ',' + adapter.config.iob_lon + '?units=si&lang=de', method: 'GET'};
	request(req_opts, function (error, response, body) {
		//adapter.log.info('Request result: ' + JSON.stringify([error, response, body]));
		if(error || !response || !response.statusCode || response.statusCode != 200) {
			adapter.log.warn('API request failed with code ' + (response && response.statusCode || 'unknown') + ': ' + JSON.stringify([req_opts]));
			adapter.stop();
			return;
		}
		
		body = JSON.parse(body);
		
		setOrUpdateState('latitude', 'Latitude', body.latitude, '°', 'number', 'value.gps.latitude');
		setOrUpdateState('longitude', 'Longitude', body.longitude, '°', 'number', 'value.gps.longitude');
		setOrUpdateState('timezone', 'Time zone', body.timezone, '', 'string', 'text');
		
		setOrUpdateState('current.time', 'Time of values', (body.currently.time * 1000), '', 'number', 'date');

		setOrUpdateState('current.icon', 'Weather icon', body.currently.icon, '', 'string', 'text');
		setOrUpdateState('current.precipIntensity', 'Precipitation intensity', body.currently.precipIntensity, 'mm/h', 'number', 'value');
		setOrUpdateState('current.precipProbability', 'Precipitation probability', (body.currently.precipProbability * 100), '%', 'number', 'value.probability');
		setOrUpdateState('current.precipType', 'Precipitation type', body.currently.precipType, '', 'string', 'text');
		setOrUpdateState('current.temperature', 'Temperature', body.currently.temperature, '°C', 'number', 'value.temperature');
		setOrUpdateState('current.apparentTemperature', 'Apparent temperature', body.currently.apparentTemperature, '°C', 'number', 'value.temperature');
		setOrUpdateState('current.dewPoint', 'Dew point', body.currently.dewPoint, '°C', 'number', 'value.temperature');
		setOrUpdateState('current.humidity', 'Hunidity', (body.currently.humidity * 100), '%', 'number', 'value.humidity');
		setOrUpdateState('current.pressure', 'Pressure', body.currently.pressure, 'hPa', 'number', 'value.pressure');
		setOrUpdateState('current.windSpeed', 'Wind speed', body.currently.windSpeed, 'm/s', 'number', 'value.speed');
		setOrUpdateState('current.windGust', 'Wind gust', body.currently.windGust, 'm/s', 'number', 'value.speed');
		setOrUpdateState('current.windBearing', 'Wind bearing', body.currently.windBearing, '°', 'number', 'value.direction');
		setOrUpdateState('current.cloudCover', 'Cloud coverage', (body.currently.cloudCover * 100), '%', 'number', 'value');
		setOrUpdateState('current.uvIndex', 'UV index', body.currently.uvIndex, '', 'number', 'value');
		setOrUpdateState('current.visibility', 'Visibility', body.currently.visibility, 'km', 'number', 'value.distance.visibility');
		setOrUpdateState('current.ozone', 'Ozone', body.currently.ozone, 'DU', 'number', 'value');

		setOrUpdateState('hourly.summary', 'Weather', body.hourly.summary, '','string', 'text');

		let i = 0;
		body.hourly.data.forEach(function(value) {
			setOrUpdateState('hourly.' + i + '.time', 'Time of values', (value.time * 1000), '', 'number', 'date');

			setOrUpdateState('hourly.' + i + '.summary', 'Weather', value.summary, '', 'string', 'text');
			setOrUpdateState('hourly.' + i + '.icon', 'Weather icon', value.icon, '', 'string', 'text');
			setOrUpdateState('hourly.' + i + '.precipIntensity', 'Precipitation intensity', value.precipIntensity, 'mm/h', 'number', 'value');
			setOrUpdateState('hourly.' + i + '.precipProbability', 'Precipitation probability', (value.precipProbability * 100), '%', 'number', 'value.probability');
			setOrUpdateState('hourly.' + i + '.precipType', 'Precipitation type', value.precipType, '', 'string', 'text');
			setOrUpdateState('hourly.' + i + '.temperature', 'Temperature', value.temperature, '°C', 'number', 'value.temperature');
			setOrUpdateState('hourly.' + i + '.apparentTemperature', 'Apparent temperature', value.apparentTemperature, '°C', 'number', 'value.temperature');
			setOrUpdateState('hourly.' + i + '.dewPoint', 'Dew point', value.dewPoint, '°C', 'number', 'value.temperature');
			setOrUpdateState('hourly.' + i + '.humidity', 'Humidity', (value.humidity * 100), '%', 'number', 'value.humidity');
			setOrUpdateState('hourly.' + i + '.pressure', 'Pressure', value.pressure, 'hPa', 'number', 'value.pressure');
			setOrUpdateState('hourly.' + i + '.windSpeed', 'Wind speed', value.windSpeed, 'm/s', 'number', 'value.speed');
			setOrUpdateState('hourly.' + i + '.windGust', 'Wind gust', value.windGust, 'm/s', 'number', 'value.speed');
			setOrUpdateState('hourly.' + i + '.windBearing', 'Wind bearing', value.windBearing, '°', 'number', 'value.direction');
			setOrUpdateState('hourly.' + i + '.cloudCover', 'Cloud coverage', (value.cloudCover * 100), '%', 'number', 'value');
			setOrUpdateState('hourly.' + i + '.uvIndex', 'UV index', value.uvIndex, '', 'number', 'value');
			setOrUpdateState('hourly.' + i + '.visibility', 'Visibility', value.visibility, 'km', 'number', 'value.distance.visibility');
			setOrUpdateState('hourly.' + i + '.ozone', 'Ozone', value.ozone, 'DU', 'number', 'value');
				
			i++;
		});
		
		setOrUpdateState('daily.summary', 'Weather', body.daily.summary, '','string', 'text');

		i = 0;
		body.daily.data.forEach(function(value) {
			setOrUpdateState('daily.' + i + '.time', 'Time of values', (value.time * 1000), '', 'number', 'date');

			setOrUpdateState('daily.' + i + '.summary', 'Weather', value.summary, '', 'string', 'text');
			setOrUpdateState('daily.' + i + '.icon', 'Weather icon', value.icon, '', 'string', 'text');

			setOrUpdateState('daily.' + i + '.sunriseTime', 'Time of sunrise', (value.sunriseTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.sunsetTime', 'Time of sunset', (value.sunsetTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.moonPhase', 'Moon phase', (value.moonPhase * 100), '%', 'number', 'value');
			
			setOrUpdateState('daily.' + i + '.precipIntensity', 'Precipitation intensity', value.precipIntensity, 'mm/h', 'number', 'value');
			setOrUpdateState('daily.' + i + '.precipIntensityMax', 'Max. precipitation intensity', value.precipIntensityMax, 'mm/h', 'number', 'value');
			setOrUpdateState('daily.' + i + '.precipIntensityMaxTime', 'Max precipitation time', (value.precipIntensityMaxTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.precipProbability', 'Precipitation probability', (value.precipProbability * 100), '%', 'number', 'value.probability');
			setOrUpdateState('daily.' + i + '.precipType', 'Precipitation type', value.precipType, '', 'string', 'text');
			setOrUpdateState('daily.' + i + '.temperatureLow', 'Temperature low', value.temperatureLow, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.temperatureLowTime', 'Temperature low time', (value.temperatureLowTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.temperatureHigh', 'Temperature high', value.temperatureHigh, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.temperatureHighTime', 'Temperature high time', (value.temperatureHighTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.apparentTemperatureLow', 'Apparent temperature low', value.apparentTemperatureLow, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.apparentTemperatureLowTime', 'Apparent temperature low time', (value.apparentTemperatureLowTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.apparentTemperatureHigh', 'Apparent temperature high', value.apparentTemperatureHigh, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.apparentTemperatureHighTime', 'Apparent temperature high time', (value.apparentTemperatureHighTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.temperatureMin', 'Min. temperature', value.temperatureMin, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.temperatureMinTime', 'Min. temperature time', (value.temperatureMinTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.temperatureMax', 'Max. temperature', value.temperatureMax, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.temperatureMaxTime', 'Max. temperature time', (value.temperatureMaxTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.apparentTemperatureMin', 'Min. apparent temperature', value.apparentTemperatureMin, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.apparentTemperatureMinTime', 'Min. apparent temperature time', (value.apparentTemperatureMinTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.apparentTemperatureMax', 'Max. apparent temperature', value.apparentTemperatureMax, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.apparentTemperatureMaxTime', 'Max. apparent temperature time', (value.apparentTemperatureMaxTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.dewPoint', 'Dew point', value.dewPoint, '°C', 'number', 'value.temperature');
			setOrUpdateState('daily.' + i + '.humidity', 'Hunidity', (value.humidity * 100), '%', 'number', 'value.humidity');
			setOrUpdateState('daily.' + i + '.pressure', 'Pressure', value.pressure, 'hPa', 'number', 'value.pressure');
			setOrUpdateState('daily.' + i + '.windSpeed', 'Wind speed', value.windSpeed, 'm/s', 'number', 'value.speed');
			setOrUpdateState('daily.' + i + '.windGust', 'Wind gust', value.windGust, 'm/s', 'number', 'value.speed');
			setOrUpdateState('daily.' + i + '.windGustTime', 'Wind gust time', (value.windGustTime * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.windBearing', 'Wind bearing', value.windBearing, '°', 'number', 'value.direction');
			setOrUpdateState('daily.' + i + '.cloudCover', 'Cloud coverage', (value.cloudCover * 100), '%', 'number', 'value');
			setOrUpdateState('daily.' + i + '.uvIndex', 'UV index', value.uvIndex, '', 'number', 'value');
			setOrUpdateState('daily.' + i + '.uvIndexTime', 'UV index time', (value.uvIndex * 1000), '', 'number', 'date');
			setOrUpdateState('daily.' + i + '.visibility', 'Visibility', value.visibility, 'km', 'number', 'value.distance.visibility');
			setOrUpdateState('daily.' + i + '.ozone', 'Ozone', value.ozone, 'DU', 'number', 'value');
				
			i++;
		});
		
		setTimeout(function() {
			adapter.stop();
		}, 5000);
	});
}

function decrypt(key, value) {
	var result = '';
	for(var i = 0; i < value.length; ++i) {
		result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
	}
	return result;
}


// If started as allInOne/compact mode => return function to create instance
if(module && module.parent) {
	module.exports = startAdapter;
} else {
	// or start the instance directly
	startAdapter();
} // endElse
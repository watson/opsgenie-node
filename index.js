'use strict';

var util = require('util');
var https = require('https');
var os = require('os');
var EventEmitter = require('events').EventEmitter;

var httpsOptions = {
  hostname: 'api.opsgenie.com',
  path: '/v1/json/customer/heartbeat',
  method: 'POST'
};

var OpsGenie = function () {};
util.inherits(OpsGenie, EventEmitter);

OpsGenie.prototype.heartbeat      = start;
OpsGenie.prototype._error         = error;
OpsGenie.prototype._config        = config;
OpsGenie.prototype._sendHeartbeat = sendHeartbeat;

var opsgenie = module.exports = exports = new OpsGenie();

// auto-configure using environment variables
process.nextTick(function () {
  if (opsgenie._configuration) return;
  opsgenie.heartbeat();
});

function start(options) {
  if (!opsgenie._config(options)) {
    console.warn('[opsgenie] could not find API key - heartbeat agent disabled!');
    return;
  }
  opsgenie._sendHeartbeat();
  setInterval(opsgenie._sendHeartbeat, 5000 * 60);
}

function config(options) {
  if (!options) options = {};
  opsgenie._configuration = {
    apiKey: options.apiKey || process.env.OPSGENIE_API_KEY,
    source: options.source || process.env.OPSGENIE_SOURCE || os.hostname()
  };
  return !!opsgenie._configuration.apiKey;
}

function error(err) {
  if (opsgenie.listeners('error').length)
    opsgenie.emit('error', err);
}

function sendHeartbeat() {
  var req = https.request(httpsOptions, function (res) {
    var data = '';

    res.setEncoding('utf8');

    res.on('data', function (chunk) {
      data += chunk;
    });

    res.on('end', function () {
      var json = {};

      if (data) {
        try {
          json = JSON.parse(data);
        } catch (err) {
          error(err);
          return;
        }
      }

      if (res.statusCode !== 200 || json.code !== 200)
        error(new Error('Unexpected OpsGenie response (code: ' + res.statusCode + ', msg: ' + json.status + ')'));

      if (data)
        opsgenie.emit('heartbeat', json);
    });
  });

  req.on('error', error);

  req.end(JSON.stringify({
    apiKey: opsgenie._configuration.apiKey,
    source: opsgenie._configuration.source
  }));
}

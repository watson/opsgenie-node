'use strict';

var util = require('util');
var https = require('https');
var os = require('os');
var EventEmitter = require('events').EventEmitter;

var httpsOptions = {
  hostname: 'api.opsgenie.com',
  path: '/v1/json/heartbeat/send',
  method: 'POST'
};

var OpsGenie = function () {};
util.inherits(OpsGenie, EventEmitter);

OpsGenie.prototype.heartbeat       = start;
OpsGenie.prototype._error          = error;
OpsGenie.prototype._config         = config;
OpsGenie.prototype._sendHeartbeat  = sendHeartbeat;
OpsGenie.prototype._queueHeartbeat = queueHeartbeat;

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
  opsgenie._queueHeartbeat();
}

function config(options) {
  if (!options) options = {};
  // `source` and `OPSGENIE_SOURCE` below is there for backwards compatibility
  opsgenie._configuration = {
    apiKey: options.apiKey || process.env.OPSGENIE_API_KEY,
    name: options.name || options.source || process.env.OPSGENIE_NAME || process.env.OPSGENIE_SOURCE || os.hostname()
  };
  return !!opsgenie._configuration.apiKey;
}

function error(err) {
  if (opsgenie.listeners('error').length)
    opsgenie.emit('error', err);
  opsgenie._queueHeartbeat();
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
        opsgenie._response = json;
      }

      if (res.statusCode !== 200 || json.code !== 200)
        error(new Error('Unexpected OpsGenie response (code: ' + res.statusCode + ', msg: ' + json.status + ')'));

      if (data)
        opsgenie.emit('heartbeat', json);

      opsgenie._queueHeartbeat();
    });
  });

  req.on('error', error);

  req.end(JSON.stringify({
    apiKey: opsgenie._configuration.apiKey,
    name: opsgenie._configuration.name
  }));
}

// If the current heartbeat exprires in 10 minutes, send the next heartbeat in 5
function queueHeartbeat() {
  var now = new Date().getTime(),
      expires = opsgenie._response && opsgenie._response.willExpireAt || now,
      diff = expires - now,
      next = diff / 2;

  // avoid DoS'ing OpsGenie
  if (next < 1000) next = 1000;

  clearTimeout(opsgenie._queue);
  opsgenie._queue = setTimeout(opsgenie._sendHeartbeat, next);
}

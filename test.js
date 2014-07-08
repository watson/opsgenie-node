'use strict';

var assert = require('assert');
var os = require('os');
var sinon = require('sinon');
var nock = require('nock');
var opsgenie = require('./index');

nock.disableNetConnect();

assert('heartbeat' in opsgenie, 'Expected opsgenie to expose a heartbeat function');
assert('_config' in opsgenie, 'Expected opsgenie to expose a _config function');
assert('_error' in opsgenie, 'Expected opsgenie to expose an _error function');
assert('_sendHeartbeat' in opsgenie, 'Expected opsgenie to expose a _sendHeartbeat function');
assert(!('_configuration' in opsgenie), 'Opsgenie should wait to configure it self until after the first tick');

var testConf = function () {
  var conf = { apiKey: 'api-key', source: 'source' };
  opsgenie._config(conf);
  return conf;
};

var testResponse = function () {
  return {
    heartbeat: 1,
    status: 'successful',
    code: 200
  };
};

sinon.stub(opsgenie, 'heartbeat'); // we have to stub this before next tick
describe('OpsGenie object', function () {
  after(function () {
    opsgenie.heartbeat.restore();
  });

  it('should auto-start', function () {
    sinon.assert.calledOnce(opsgenie.heartbeat);
  });
});

describe('._config()', function () {
  var origConf;

  beforeEach(function () {
    origConf = opsgenie._configuration;
  });

  afterEach(function () {
    opsgenie._configuration = origConf;
  });

  it('should set the _configuration object', function () {
    var conf = { apiKey: 1, source: 1 };
    opsgenie._config(conf);
    assert.deepEqual(opsgenie._configuration, conf);
  });

  it('should fall back to environment variables', function () {
    process.env.OPSGENIE_API_KEY = 'env_api_key';
    process.env.OPSGENIE_SOURCE = 'env_source';

    var conf = { apiKey: process.env.OPSGENIE_API_KEY, source: process.env.OPSGENIE_SOURCE };

    opsgenie._config();
    assert.deepEqual(opsgenie._configuration, conf);

    delete process.env.OPSGENIE_API_KEY;
    delete process.env.OPSGENIE_SOURCE;
  });

  it('should fall back to os hostname', function () {
    opsgenie._config();
    assert.equal(opsgenie._configuration.source, os.hostname());
  });

  it('should return true if it could find an API key', function () {
    assert(opsgenie._config({ apiKey: 1 }));
  });

  it('should return false if it couldn\'t find an API key', function () {
    assert(!opsgenie._config());
  });
});

describe('._error()', function () {
  it('should not emit if nobody is listening', function () {
    opsgenie._error(new Error()); // would throw if it didn't work
  });

  it('should emit if a listener is added', function () {
    var err = new Error();
    var spy = sinon.spy();
    opsgenie.on('error', spy);
    opsgenie._error(err);
    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, err);
    opsgenie.removeListener('error', spy);
  });
});

describe('.heartbeat()', function () {
  var clock;

  beforeEach(function () {
    clock = sinon.useFakeTimers('setInterval');
    sinon.stub(opsgenie, '_sendHeartbeat');
  });

  afterEach(function () {
    clock.restore();
    opsgenie._sendHeartbeat.restore();
  });

  it('should send a heartbeat immediately', function () {
    opsgenie.heartbeat({ apiKey: 1 });
    sinon.assert.calledOnce(opsgenie._sendHeartbeat);
  });

  it('should send a heartbeat again after 5 minutes', function () {
    opsgenie.heartbeat({ apiKey: 1 });
    clock.tick(5000 * 60);
    sinon.assert.calledTwice(opsgenie._sendHeartbeat);
  });

  it('should not start if no API key was given', function () {
    sinon.stub(console, 'warn');
    opsgenie.heartbeat();
    clock.tick(5000 * 60);
    sinon.assert.notCalled(opsgenie._sendHeartbeat);
    sinon.assert.calledOnce(console.warn);
    console.warn.restore();
  });
});

describe('._sendHeartbeat()', function () {
  var api;

  describe('everything ok', function () {
    beforeEach(function () {
      api = nock('https://api.opsgenie.com')
        .post('/v1/json/customer/heartbeat', testConf())
        .reply(200, {
          heartbeat: 1,
          status: 'successful',
          code: 200
        });
    });

    afterEach(function () {
      nock.cleanAll();
    });

    it('should send a heartbeat to OpsGenie', function (done) {
      setTimeout(function () {
        api.done();
        done();
      }, 25);
      opsgenie._sendHeartbeat();
    });

    it('should emit a heartbeat event', function (done) {
      opsgenie.once('heartbeat', function (res) {
        assert.deepEqual(res, testResponse());
        done();
      });
      opsgenie._sendHeartbeat();
    });
  });

  describe('error handling', function () {
    afterEach(function () {
      nock.cleanAll();
    });

    it('should emit a error event if the response have a bad status code', function (done) {
      nock('https://api.opsgenie.com')
        .post('/v1/json/customer/heartbeat', testConf())
        .reply(500);

      opsgenie.once('error', function (err) {
        assert(err instanceof Error);
        done();
      });

      opsgenie._sendHeartbeat();
    });

    it('should emit a error event if the response json isn\'t as expected', function (done) {
      nock('https://api.opsgenie.com')
        .post('/v1/json/customer/heartbeat', testConf())
        .reply(200, {
          heartbeat: 1,
          status: 'successful',
          code: 500
        });

      opsgenie.once('error', function (err) {
        assert(err instanceof Error);
        done();
      });

      opsgenie._sendHeartbeat();
    });
  });
});

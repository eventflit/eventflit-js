var TestEnv = require('testenv');
var Eventflit = require('eventflit_integration');

if (TestEnv === "web") {
  window.Eventflit = Eventflit;
  var Dependencies = require('dom/dependencies').Dependencies;
  var DependenciesReceivers = require('dom/dependencies').DependenciesReceivers;
  var DependencyLoader = require('dom/dependency_loader').default;
}

var Integration = require("integration");
var Collections = require("core/utils/collections");
var util = require("core/util").default;
var Runtime = require('runtime').default;
var Defaults = require('core/defaults').default;
var transports = Runtime.Transports;

Integration.describe("Cluster Configuration", function() {

  var TRANSPORTS = transports;

  function subscribe(eventflit, channelName, callback) {
    var channel = eventflit.subscribe(channelName);
    channel.bind("eventflit:subscription_succeeded", function(param) {
      callback(channel, param);
    });
    return channel;
  }

  var eventflit;

  function describeClusterTest(options) {
    var environment = { encrypted: options.encrypted };
    if (!TRANSPORTS[options.transport].isSupported(environment)) {
      return;
    }

    describe("with " + options.transport + ", encrypted=" + options.encrypted, function() {
      beforeEach(function() {
        Collections.objectApply(TRANSPORTS, function(transport, name) {
          spyOn(transport, "isSupported").andReturn(false);
        });
        TRANSPORTS[options.transport].isSupported.andReturn(true);
        spyOn(Runtime, "getLocalStorage").andReturn({});
      });

      it("should open a connection to the 'eu' cluster", function() {

        var authTransport = (TestEnv === "web") ? 'jsonp' : 'ajax';

        eventflit = new Eventflit("4d31fbea7080e3b4bf6d", {
          authTransport: authTransport,
          authEndpoint: Integration.API_EU_URL + "/auth",
          cluster: "eu",
          encrypted: options.encrypted,
          disableStats: true
        });
        waitsFor(function() {
          return eventflit.connection.state === "connected";
        }, "connection to be established", 20000);
      });

      it("should subscribe and receive a message sent via REST API", function() {
        var channelName = Integration.getRandomName("private-integration");

        var onSubscribed = jasmine.createSpy("onSubscribed");
        var channel = subscribe(eventflit, channelName, onSubscribed);

        var eventName = "integration_event";
        var data = { x: 1, y: "z" };
        var received = null;

        waitsFor(function() {
          return onSubscribed.calls.length;
        }, "subscription to succeed", 10000);
        runs(function() {
          channel.bind(eventName, function(message) {
            received = message;
          });
          Integration.sendAPIMessage({
            url: Integration.API_EU_URL + "/v2/send",
            channel: channelName,
            event: eventName,
            data: data
          });
        });
        waitsFor(function() {
          return received !== null;
        }, "message to get delivered", 10000);
        runs(function() {
          expect(received).toEqual(data);
          eventflit.unsubscribe(channelName);
        });
      });

      it("should disconnect the connection", function() {
        eventflit.disconnect();
      });
    });
  }

  var _VERSION;
  var _channel_auth_transport;
  var _channel_auth_endpoint;
  var _Dependencies;

  it("should prepare the global config", function() {
    // TODO fix how versions work in unit tests
    _VERSION = Defaults.VERSION;
    _channel_auth_transport = Defaults.channel_auth_transport;
    _channel_auth_endpoint = Defaults.channel_auth_endpoint;
    _Dependencies = Dependencies;

    Defaults.VERSION = "8.8.8";
    Defaults.channel_auth_transport = "";
    Defaults.channel_auth_endpoint = "";

    if (TestEnv === "web") {
      Dependencies = new DependencyLoader({
        cdn_http: Integration.JS_HOST,
        cdn_https: Integration.JS_HOST,
        version: Defaults.VERSION,
        suffix: "",
        receivers: DependenciesReceivers
      });
    }
  });

  if (TestEnv !== "web" || !/version\/5.*safari/i.test(navigator.userAgent)) {
    // Safari 5 uses hixie-75/76, which is not supported on EU
    describeClusterTest({ transport: "ws", encrypted: false});
    describeClusterTest({ transport: "ws", encrypted: true});
  }

  if (Runtime.isXHRSupported()) {
    // CORS-compatible browsers
    if (TestEnv !== "web" || !/Android 2\./i.test(navigator.userAgent)) {
      // Android 2.x does a lot of buffering, which kills streaming
      describeClusterTest({ transport: "xhr_streaming", encrypted: false});
      describeClusterTest({ transport: "xhr_streaming", encrypted: true});
    }
    describeClusterTest({ transport: "xhr_polling", encrypted: false});
    describeClusterTest({ transport: "xhr_polling", encrypted: true});
  } else if (Runtime.isXDRSupported(false)) {
    describeClusterTest({ transport: "xdr_streaming", encrypted: false});
    describeClusterTest({ transport: "xdr_streaming", encrypted: true});
    describeClusterTest({ transport: "xdr_polling", encrypted: false});
    describeClusterTest({ transport: "xdr_polling", encrypted: true});
    // IE can fall back to SockJS if protocols don't match
    // No SockJS encrypted tests due to the way JS files are served
    describeClusterTest({ transport: "sockjs", encrypted: false});
  } else {
    // Browsers using SockJS
    describeClusterTest({ transport: "sockjs", encrypted: false});
    describeClusterTest({ transport: "sockjs", encrypted: true});
  }
});

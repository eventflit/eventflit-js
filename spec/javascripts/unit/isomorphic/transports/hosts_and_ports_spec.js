var TestEnv = require('testenv');
var Eventflit = require('core/eventflit').default;
var NetInfo  = require('net_info').NetInfo;
var Mocks = require('mocks');
var Defaults = require('core/defaults').default;
var version = Defaults.VERSION;
var cdn_http = Defaults.cdn_http;
var cdn_https = Defaults.cdn_https;
var dependency_suffix = Defaults.dependency_suffix;
var Runtime = require('runtime').default;

describe("Host/Port Configuration", function() {
  var transport;
  var eventflit;
  var Transports;

  beforeEach(function() {
    spyOn(Runtime, 'getNetwork').andCallFake(function(){
      var network = new NetInfo();
      network.isOnline = jasmine.createSpy("isOnline")
        .andReturn(true);
      return network;
    });
    spyOn(Runtime, "getLocalStorage").andReturn({});
  });

  afterEach(function() {
    eventflit.disconnect();
  });

  describe("WebSockets", function() {
    var _WebSocket;

    beforeEach(function() {
      spyOn(Runtime, 'createWebSocket').andReturn(Mocks.getTransport());

      var Transports = Runtime.Transports;

      spyOn(Transports.ws, "isSupported").andReturn(true);
      spyOn(Transports.xhr_streaming, "isSupported").andReturn(false);
      spyOn(Transports.xhr_polling, "isSupported").andReturn(false);
    });

    it("should connect to ws://service.eventflit.com:80 by default", function() {
      eventflit = new Eventflit("foobar");
      eventflit.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "ws://service.eventflit.com:80/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });

    it("should connect to wss://service.eventflit.com:443 by default when encrypted", function() {
      eventflit = new Eventflit("foobar", { encrypted: true });
      eventflit.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "wss://service.eventflit.com:443/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });

    it("should connect using wsHost and wsPort when specified in options", function() {
      eventflit = new Eventflit("foobar", { wsHost: "example.com", wsPort: 1999 });
      eventflit.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "ws://example.com:1999/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });

    it("should connect using wsHost and wssPort when specified in options and encrypted", function() {
      eventflit = new Eventflit("foobar", { wsHost: "example.org", wssPort: 4444, encrypted: true });
      eventflit.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "wss://example.org:4444/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });
  });
});

var Runtime = require('runtime').default;
var Dependencies = require('dom/dependencies').Dependencies;
var Mocks = require('mocks');
var NetInfo  = require('net_info').NetInfo;
var Eventflit = require('core/eventflit').default;
var Defaults = require('core/defaults').default;
var version = Defaults.VERSION;
var cdn_http = Defaults.cdn_http;
var cdn_https = Defaults.cdn_https;
var dependency_suffix = Defaults.dependency_suffix;

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
    Transports = Runtime.Transports;
  });

  afterEach(function() {
    eventflit.disconnect();
  });

  describe("SockJS", function() {
    var _SockJS;

    beforeEach(function() {
      spyOn(Transports.ws, "isSupported").andReturn(false);
      spyOn(Transports.xdr_streaming, "isSupported").andReturn(false);
      spyOn(Transports.xhr_streaming, "isSupported").andReturn(false);
      spyOn(Transports.xdr_polling, "isSupported").andReturn(false);
      spyOn(Transports.xhr_polling, "isSupported").andReturn(false);
      spyOn(Transports.sockjs, "isSupported").andReturn(true);

      spyOn(Dependencies, "load").andCallFake(function(file, callback) {
        callback();
      });

      _SockJS = window.WebSocket;
      window.SockJS = jasmine.createSpy("WebSocket").andCallFake(function() {
        return Mocks.getTransport();
      });
    });

    afterEach(function() {
      window.SockJS = _SockJS;
    });

    it("should connect to http://service.eventflit.com:80 by default", function() {
      eventflit = new Eventflit("foobar");
      eventflit.connect();

      expect(window.SockJS).toHaveBeenCalledWith(
        "http://service.eventflit.com:80/eventflit",
        null,
        { js_path: cdn_http + '/' + version + '/sockjs'+dependency_suffix+'.js',
          ignore_null_origin: undefined
        }
      );
    });

    it("should connect to https://service.eventflit.com:443 by default when encrypted", function() {
      eventflit = new Eventflit("foobar", { encrypted: true });
      eventflit.connect();

      expect(window.SockJS).toHaveBeenCalledWith(
        "https://service.eventflit.com:443/eventflit",
        null,
        { js_path: cdn_https+'/'+version +'/sockjs'+dependency_suffix+'.js',
          ignore_null_origin: undefined
        }
      );
    });

    it("should connect using httpHost and httpPort when specified in options", function() {
      eventflit = new Eventflit("foobar", { httpHost: "example.com", httpPort: 1999 });
      eventflit.connect();

      expect(window.SockJS).toHaveBeenCalledWith(
        "http://example.com:1999/eventflit",
        null,
        { js_path: cdn_http + '/' + version + '/sockjs'+dependency_suffix+'.js',
          ignore_null_origin: undefined
        }
      );
    });

    it("should connect using httpHost and httpsPort when specified in options and encrypted", function() {
      eventflit = new Eventflit("foobar", { httpHost: "example.org", httpsPort: 4444, encrypted: true });
      eventflit.connect();

      expect(window.SockJS).toHaveBeenCalledWith(
        "https://example.org:4444/eventflit",
        null,
        { js_path: cdn_https+'/'+version +'/sockjs'+dependency_suffix+'.js',
          ignore_null_origin: undefined
        }
      );
    });

    it("should connect using httpPath when specified in options", function() {
      eventflit = new Eventflit("foobar", { httpPath: "/test" });
      eventflit.connect();

      expect(window.SockJS).toHaveBeenCalledWith(
        "http://service.eventflit.com:80/test",
        null,
        { js_path: cdn_http + '/' + version + '/sockjs'+dependency_suffix+'.js',
          ignore_null_origin: undefined
        }
      );
    });
  });
});

var Eventflit = require('eventflit_integration');
var TestEnv = require('testenv');

if (TestEnv === "web") window.Eventflit = Eventflit;

var Integration = require("integration");
var Mocks = require("mocks");
var Network = require("net_info").Network;
var util = require("core/util").default;
var Runtime = require('runtime').default;
var transports = Runtime.Transports;
var Defaults = require('core/defaults').default;

if (TestEnv == "web") {
  var BASE_FALLBACK = "sockjs"
} else {
  var BASE_FALLBACK = "xhr_polling"
}

Integration.describe("Timeout Configuration", function() {
  var transport;
  var eventflit;

  beforeEach(function() {
    spyOn(Network, "isOnline").andReturn(true);

    spyOn(transports.ws, "isSupported").andReturn(true);
    spyOn(transports[BASE_FALLBACK], "isSupported").andReturn(false);

    spyOn(Runtime, "getLocalStorage").andReturn({});

    spyOn(transports.ws, "createConnection").andCallFake(function() {
      transport = Mocks.getTransport(true);
      transport.supportsPing.andReturn(false);
      return transport;
    });
    jasmine.Clock.useMock();
  });

  afterEach(function() {
    eventflit.disconnect();
  });

  it("should transition to unavailable after default timeout", function() {
    var onUnavailable = jasmine.createSpy("onUnavailable");

    eventflit = new Eventflit("foobar");
    eventflit.connect();
    eventflit.connection.bind("unavailable", onUnavailable);

    jasmine.Clock.tick(Defaults.unavailable_timeout - 1);
    expect(onUnavailable).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(onUnavailable).toHaveBeenCalled();
  });

  it("should transition to unavailable after timeout passed as an option", function() {
    var onUnavailable = jasmine.createSpy("onUnavailable");

    eventflit = new Eventflit("foobar", { unavailable_timeout: 2345 });
    eventflit.connect();
    eventflit.connection.bind("unavailable", onUnavailable);

    jasmine.Clock.tick(2344);
    expect(onUnavailable).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(onUnavailable).toHaveBeenCalled();
  });

  it("should obey the server's activity timeout and the default pong timeout", function() {
    eventflit = new Eventflit("foobar");
    eventflit.connect();

    var firstTransport = transport;

    firstTransport.state = "initialized";
    firstTransport.emit("initialized");
    firstTransport.state = "open";
    firstTransport.emit("open");
    firstTransport.emit("message", {
      data: JSON.stringify({
        event: "eventflit:connection_established",
        data: {
          socket_id: "123.456",
          activity_timeout: 12
        }
      })
    });

    expect(eventflit.connection.state).toEqual("connected");
    jasmine.Clock.tick(12000 - 1);
    expect(firstTransport.send).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(firstTransport.send).toHaveBeenCalled();

    jasmine.Clock.tick(Defaults.pong_timeout - 1);
    expect(firstTransport.close).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(firstTransport.close).toHaveBeenCalled();
  });

  it("should obey the activity timeout from the handshake if it's lower than one specified in options", function() {
    eventflit = new Eventflit("foobar", {
      activity_timeout: 16000,
      pong_timeout: 2222
    });
    eventflit.connect();

    var firstTransport = transport;

    firstTransport.state = "initialized";
    firstTransport.emit("initialized");
    firstTransport.state = "open";
    firstTransport.emit("open");
    firstTransport.emit("message", {
      data: JSON.stringify({
        event: "eventflit:connection_established",
        data: {
          socket_id: "123.456",
          activity_timeout: 15
        }
      })
    });

    expect(eventflit.connection.state).toEqual("connected");
    jasmine.Clock.tick(15000 - 1);
    expect(firstTransport.send).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(firstTransport.send).toHaveBeenCalled();
  });

  it("should obey the activity timeout specified in options if it's lower than one from the handshake", function() {
    eventflit = new Eventflit("foobar", {
      activity_timeout: 15555,
      pong_timeout: 2222
    });
    eventflit.connect();

    var firstTransport = transport;

    firstTransport.state = "initialized";
    firstTransport.emit("initialized");
    firstTransport.state = "open";
    firstTransport.emit("open");
    firstTransport.emit("message", {
      data: JSON.stringify({
        event: "eventflit:connection_established",
        data: {
          socket_id: "123.456",
          activity_timeout: 17
        }
      })
    });

    expect(eventflit.connection.state).toEqual("connected");
    jasmine.Clock.tick(15555 - 1);
    expect(firstTransport.send).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(firstTransport.send).toHaveBeenCalled();
  });

  it("should obey the pong timeout passed in options", function() {
    eventflit = new Eventflit("foobar", {
      pong_timeout: 2222
    });
    eventflit.connect();

    var firstTransport = transport;

    firstTransport.state = "initialized";
    firstTransport.emit("initialized");
    firstTransport.state = "open";
    firstTransport.emit("open");
    firstTransport.emit("message", {
      data: JSON.stringify({
        event: "eventflit:connection_established",
        data: {
          socket_id: "123.456",
          activity_timeout: 120
        }
      })
    });

    // first, send the ping
    jasmine.Clock.tick(120000);
    // wait for the pong timeout
    jasmine.Clock.tick(2221);
    expect(firstTransport.close).not.toHaveBeenCalled();
    jasmine.Clock.tick(1);
    expect(firstTransport.close).toHaveBeenCalled();
  });
});

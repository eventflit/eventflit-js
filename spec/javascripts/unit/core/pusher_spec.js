var TestEnv = require('testenv');
var Util = require('core/util').default;
var Collections = require('core/utils/collections');
var Logger = require('core/logger').default;
var StrategyBuilder = require('core/strategies/strategy_builder');
var Defaults = require('core/defaults').default;
var DefaultConfig = require('core/config');
var TimelineSender = require('core/timeline/timeline_sender').default;
var Eventflit = require('core/eventflit').default;
var Mocks = require('../../helpers/mocks');
var Factory = require('core/utils/factory').default;
var Runtime = require('runtime').default;

describe("Eventflit", function() {
  var _isReady, _instances, _logToConsole;

  switch (TestEnv) {
    case "worker":
    case "node":
      var timelineTransport = "xhr";
      break;
    case "web":
      var timelineTransport = "jsonp";
      break
    default:
      throw("Please specify the test environment as an external.")
  }

  beforeEach(function() {
    _instances = Eventflit.instances;
    _isReady = Eventflit.isReady;
    _logToConsole = Eventflit.logToConsole;
    Eventflit.isReady = false;
    Eventflit.instances = [];

    spyOn(StrategyBuilder, "build").andCallFake(function(definition, options) {
      var strategy = Mocks.getStrategy(true);
      strategy.definition = definition;
      strategy.options = options;
      return strategy;
    });

    spyOn(Factory, "createConnectionManager").andCallFake(function(key, options) {
      var manager = Mocks.getConnectionManager();
      manager.key = key;
      manager.options = options;
      return manager;
    });
    spyOn(Factory, "createChannel").andCallFake(function(name, _) {
      return Mocks.getChannel(name);
    });

    if (TestEnv === "web") {
      spyOn(Runtime, "getDocument").andReturn({
        location: {
          protocol: "http:"
        }
      });
    }
  });

  afterEach(function() {
    Eventflit.instances = _instances;
    Eventflit.isReady = _isReady;
    Eventflit.logToConsole = _logToConsole;
  });

  describe("app key validation", function() {
    it("should throw on a null key", function() {
      expect(function() { new Eventflit(null) }).toThrow("You must pass your app key when you instantiate Eventflit.");
    });

    it("should throw on an undefined key", function() {
      expect(function() { new Eventflit() }).toThrow("You must pass your app key when you instantiate Eventflit.");
    });

    it("should allow a hex key", function() {
      spyOn(Logger, "warn");
      var eventflit = new Eventflit("1234567890abcdef", { cluster: "mt1" });
      expect(Logger.warn).not.toHaveBeenCalled();
    });

    it("should warn if no cluster is supplied", function() {
      spyOn(Logger, "warn");
      var eventflit = new Eventflit("1234567890abcdef");
      expect(Logger.warn).toHaveBeenCalled();
    });

    it("should not warn if no cluster is supplied if wsHost or httpHost are supplied", function() {
      spyOn(Logger, "warn");
      var wsEventflit = new Eventflit("1234567890abcdef", { wsHost: 'example.com' });
      var httpEventflit = new Eventflit("1234567890abcdef", { httpHost: 'example.com' });
      expect(Logger.warn).not.toHaveBeenCalled();
      expect(Logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("after construction", function() {
    var eventflit;

    beforeEach(function() {
      eventflit = new Eventflit("foo");
    });

    it("should create a timeline with the correct key", function() {
      expect(eventflit.timeline.key).toEqual("foo");
    });

    it("should create a timeline with a session id", function() {
      expect(eventflit.timeline.session).toEqual(eventflit.sessionID);
    });

    it("should pass the cluster name to the timeline", function() {
      var eventflit = new Eventflit("foo");
      expect(eventflit.timeline.options.cluster).toBe(undefined);

      eventflit = new Eventflit("foo", { cluster: "spec" });
      expect(eventflit.timeline.options.cluster).toEqual("spec");
    });

    it("should pass a feature list to the timeline", function() {
      spyOn(Eventflit, "getClientFeatures").andReturn(["foo", "bar"]);
      var eventflit = new Eventflit("foo");
      expect(eventflit.timeline.options.features).toEqual(["foo", "bar"]);
    });

    it("should pass the version number to the timeline", function() {
      expect(eventflit.timeline.options.version).toEqual(Defaults.VERSION);
    });

    it("should pass per-connection timeline params", function() {
      eventflit = new Eventflit("foo", { timelineParams: { horse: true } });
      expect(eventflit.timeline.options.params).toEqual({ horse: true });
    });

    it("should find subscribed channels", function() {
      var channel = eventflit.subscribe("chan");
      expect(eventflit.channel("chan")).toBe(channel);
    });

    it("should not find unsubscribed channels", function() {
      expect(eventflit.channel("chan")).toBe(undefined);
      eventflit.subscribe("chan");
      eventflit.unsubscribe("chan");
      expect(eventflit.channel("chan")).toBe(undefined);
    });

    describe("encryption", function() {
      it("should be off by default", function() {
        expect(eventflit.isEncrypted()).toBe(false);
      });

      it("should be on when 'encrypted' parameter is passed", function() {
        var eventflit = new Eventflit("foo", { encrypted: true });
        expect(eventflit.isEncrypted()).toBe(true);
      });

      if (TestEnv === "web") {
        it("should be on when using https", function() {
          Runtime.getDocument.andReturn({
            location: {
              protocol: "https:"
            }
          });
          expect(eventflit.isEncrypted()).toBe(true);
        });
      }
    });

    describe("with getStrategy function", function() {
      it("should construct a strategy instance", function() {
        var strategy = eventflit.connection.options.getStrategy();
        expect(strategy.isSupported).toEqual(jasmine.any(Function));
        expect(strategy.connect).toEqual(jasmine.any(Function));
      });

      it("should pass per-connection strategy options", function() {
        eventflit = new Eventflit("foo", { encrypted: true });

        var expectedConfig = Collections.extend(
          DefaultConfig.getGlobalConfig(),
          { encrypted: true }
        );

        var getStrategy = eventflit.connection.options.getStrategy;
        expect(getStrategy().options).toEqual(expectedConfig);
        expect(getStrategy().definition).toEqual(
          Runtime.getDefaultStrategy(expectedConfig)
        );
      });

      it("should pass options to the strategy builder", function() {
        var expectedConfig = Collections.extend(
          DefaultConfig.getGlobalConfig(),
          { encrypted: true }
        );

        var getStrategy = eventflit.connection.options.getStrategy;
        expect(getStrategy({ encrypted: true }).options).toEqual(
          expectedConfig
        );
        expect(getStrategy({ encrypted: true }).definition).toEqual(
          Runtime.getDefaultStrategy(expectedConfig)
        );
      });
    });

    describe("connection manager", function() {
      it("should have the right key", function() {
        var eventflit = new Eventflit("beef");
        expect(eventflit.connection.key).toEqual("beef");
      });

      it("should have default timeouts", function() {
        var eventflit = new Eventflit("foo");
        var options = eventflit.connection.options;

        expect(options.activityTimeout).toEqual(Defaults.activity_timeout);
        expect(options.pongTimeout).toEqual(Defaults.pong_timeout);
        expect(options.unavailableTimeout).toEqual(Defaults.unavailable_timeout);
      });

      it("should use user-specified timeouts", function() {
        var eventflit = new Eventflit("foo", {
          activityTimeout: 123,
          pongTimeout: 456,
          unavailableTimeout: 789
        });
        var options = eventflit.connection.options;

        expect(options.activityTimeout).toEqual(123);
        expect(options.pongTimeout).toEqual(456);
        expect(options.unavailableTimeout).toEqual(789);
      });

      it("should be unencrypted by default", function() {
        var eventflit = new Eventflit("foo");
        expect(eventflit.connection.options.encrypted).toBe(false);
      });

      it("should be encrypted when specified in Eventflit constructor", function() {
        var eventflit = new Eventflit("foo", { encrypted: true });
        expect(eventflit.connection.options.encrypted).toBe(true);
      });

      if (TestEnv === "web") {
        it("should be encrypted when using HTTPS", function() {
          Runtime.getDocument.andReturn({
            location: {
              protocol: "https:"
            }
          });
          var eventflit = new Eventflit("foo", { encrypted: true });
          expect(eventflit.connection.options.encrypted).toBe(true);
        });
      }
    });
  });

  describe(".ready", function() {
    it("should start connection attempts for instances", function() {
      var eventflit = new Eventflit("01234567890abcdef");
      spyOn(eventflit, "connect");

      expect(eventflit.connect).not.toHaveBeenCalled();
      Eventflit.ready();
      expect(eventflit.connect).toHaveBeenCalled();
    });
  });

  describe("#connect", function() {
    it("should call connect on connection manager", function() {
      var eventflit = new Eventflit("foo", { disableStats: true });
      eventflit.connect();
      expect(eventflit.connection.connect).toHaveBeenCalledWith();
    });
  });

  describe("after connecting", function() {
    beforeEach(function() {
      eventflit = new Eventflit("foo", { disableStats: true });
      eventflit.connect();
      eventflit.connection.state = "connected";
      eventflit.connection.emit("connected");
    });

    it("should subscribe to all channels", function() {
      var eventflit = new Eventflit("foo", { disableStats: true });

      var subscribedChannels = {
        "channel1": eventflit.subscribe("channel1"),
        "channel2": eventflit.subscribe("channel2")
      };

      expect(subscribedChannels.channel1.subscribe).not.toHaveBeenCalled();
      expect(subscribedChannels.channel2.subscribe).not.toHaveBeenCalled();

      eventflit.connect();
      eventflit.connection.state = "connected";
      eventflit.connection.emit("connected");

      expect(subscribedChannels.channel1.subscribe).toHaveBeenCalled();
      expect(subscribedChannels.channel2.subscribe).toHaveBeenCalled();
    });

    it("should send events via the connection manager", function() {
      eventflit.send_event("event", { key: "value" }, "channel");
      expect(eventflit.connection.send_event).toHaveBeenCalledWith(
        "event", { key: "value" }, "channel"
      );
    });

    describe("#subscribe", function() {
      it("should return the same channel object for subsequent calls", function() {
        var channel = eventflit.subscribe("xxx");
        expect(channel.name).toEqual("xxx");
        expect(eventflit.subscribe("xxx")).toBe(channel);
      });

      it("should subscribe the channel", function() {
        var channel = eventflit.subscribe("xxx");
        expect(channel.subscribe).toHaveBeenCalled();
      });

      it("should reinstate cancelled pending subscription", function() {
        var channel = eventflit.subscribe("xxx");
        channel.subscriptionPending = true;
        channel.subscriptionCancelled = true;
        eventflit.subscribe("xxx");

        expect(channel.reinstateSubscription).toHaveBeenCalled();
      })
    });

    describe("#unsubscribe", function() {
      it("should unsubscribe the channel if subscription is not pending", function() {
        var channel = eventflit.subscribe("yyy");
        expect(channel.unsubscribe).not.toHaveBeenCalled();

        eventflit.unsubscribe("yyy");
        expect(channel.unsubscribe).toHaveBeenCalled();
      });

      it("should remove the channel from .channels if subscription is not pending", function () {
        var channel = eventflit.subscribe("yyy");
        expect(eventflit.channel("yyy")).toBe(channel);

        eventflit.unsubscribe("yyy");
        expect(eventflit.channel("yyy")).toBe(undefined);
      });

      it("should delay unsubscription if the subscription is pending", function () {
        var channel = eventflit.subscribe("yyy");
        channel.subscriptionPending = true;

        eventflit.unsubscribe("yyy");
        expect(eventflit.channel("yyy")).toBe(channel);
        expect(channel.unsubscribe).not.toHaveBeenCalled();
        expect(channel.cancelSubscription).toHaveBeenCalled();
      })
    });
  });

  describe("on message", function() {
    var eventflit;

    beforeEach(function() {
      eventflit = new Eventflit("foo", { disableStats: true });
    });

    it("should pass events to their channels", function() {
      var channel = eventflit.subscribe("chan");

      eventflit.connection.emit("message", {
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
      expect(channel.handleEvent).toHaveBeenCalledWith(
        "event", { key: "value" }
      );
    });

    it("should not publish events to other channels", function() {
      var channel = eventflit.subscribe("chan");
      var onEvent = jasmine.createSpy("onEvent");
      channel.bind("event", onEvent);

      eventflit.connection.emit("message", {
        channel: "different",
        event: "event",
        data: {}
      });
      expect(onEvent).not.toHaveBeenCalled();
    });

    it("should publish per-channel events globally (deprecated)", function() {
      var onEvent = jasmine.createSpy("onEvent");
      eventflit.bind("event", onEvent);

      eventflit.connection.emit("message", {
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
      expect(onEvent).toHaveBeenCalledWith({ key: "value" });
    });

    it("should publish global events (deprecated)", function() {
      var onEvent = jasmine.createSpy("onEvent");
      var onAllEvents = jasmine.createSpy("onAllEvents");
      eventflit.bind("global", onEvent);
      eventflit.bind_global(onAllEvents);

      eventflit.connection.emit("message", {
        event: "global",
        data: "data"
      });
      expect(onEvent).toHaveBeenCalledWith("data");
      expect(onAllEvents).toHaveBeenCalledWith("global", "data");
    });

    it("should not publish internal events", function() {
      var onEvent = jasmine.createSpy("onEvent");
      eventflit.bind("eventflit_internal:test", onEvent);

      eventflit.connection.emit("message", {
        event: "eventflit_internal:test",
        data: "data"
      });
      expect(onEvent).not.toHaveBeenCalled();
    });
  });

  describe("#unbind", function() {
    it("should allow a globally bound callback to be removed", function() {
      var onEvent = jasmine.createSpy("onEvent");
      eventflit.bind("event", onEvent);
      eventflit.unbind("event", onEvent);

      eventflit.connection.emit("message", {
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
      expect(onEvent).not.toHaveBeenCalled();
    });
  });

  describe("#disconnect", function() {
    it("should call disconnect on connection manager", function() {
      var eventflit = new Eventflit("foo");

      eventflit.disconnect();
      expect(eventflit.connection.disconnect).toHaveBeenCalledWith();
    });
  });

  describe("after disconnecting", function() {
    it("should disconnect channels", function() {
      var eventflit = new Eventflit("foo", { disableStats: true });
      var channel1 = eventflit.subscribe("channel1");
      var channel2 = eventflit.subscribe("channel2");

      eventflit.connection.state = "disconnected";
      eventflit.connection.emit("disconnected");

      expect(channel1.disconnect).toHaveBeenCalledWith();
      expect(channel2.disconnect).toHaveBeenCalledWith();
    });
  });

  describe("on error", function() {
    it("should log a warning to console", function() {
      var eventflit = new Eventflit("foo", { disableStats: true });

      spyOn(Logger, "warn");
      eventflit.connection.emit("error", "something");
      expect(Logger.warn).toHaveBeenCalledWith("Error", "something");
    });
  });

  describe("metrics", function() {
    var timelineSender;
    var eventflit;

    beforeEach(function() {
      jasmine.Clock.useMock();

      timelineSender = Mocks.getTimelineSender();
      spyOn(Factory, "createTimelineSender").andReturn(timelineSender);

      eventflit = new Eventflit("foo");
    });

    it("should be sent to stats.eventflit.com by default", function() {
      expect(Factory.createTimelineSender.calls.length).toEqual(1);
      expect(Factory.createTimelineSender).toHaveBeenCalledWith(
        eventflit.timeline, { host: "stats.eventflit.com", path: "/timeline/v2/" + timelineTransport }
      );
    });

    it("should be sent to a hostname specified in constructor options", function() {
      var eventflit = new Eventflit("foo", {
        statsHost: "example.com"
      });
      expect(Factory.createTimelineSender).toHaveBeenCalledWith(
        eventflit.timeline, { host: "example.com", path: "/timeline/v2/" + timelineTransport }
      );
    });

    it("should not be sent if disableStats option is passed", function() {
      var eventflit = new Eventflit("foo", { disableStats: true });
      eventflit.connect();
      eventflit.connection.options.timeline.info({});
      jasmine.Clock.tick(1000000);
      expect(timelineSender.send.calls.length).toEqual(0);
    });

    it("should not be sent before calling connect", function() {
      eventflit.connection.options.timeline.info({});
      jasmine.Clock.tick(1000000);
      expect(timelineSender.send.calls.length).toEqual(0);
    });

    it("should be sent every 60 seconds after calling connect", function() {
      eventflit.connect();
      expect(Factory.createTimelineSender.calls.length).toEqual(1);

      eventflit.connection.options.timeline.info({});

      jasmine.Clock.tick(59999);
      expect(timelineSender.send.calls.length).toEqual(0);
      jasmine.Clock.tick(1);
      expect(timelineSender.send.calls.length).toEqual(1);
      jasmine.Clock.tick(60000);
      expect(timelineSender.send.calls.length).toEqual(2);
    });

    it("should be sent after connecting", function() {
      eventflit.connect();
      eventflit.connection.options.timeline.info({});

      eventflit.connection.state = "connected";
      eventflit.connection.emit("connected");

      expect(timelineSender.send.calls.length).toEqual(1);
    });

    it("should not be sent after disconnecting", function() {
      eventflit.connect();
      eventflit.disconnect();

      eventflit.connection.options.timeline.info({});

      jasmine.Clock.tick(1000000);
      expect(timelineSender.send.calls.length).toEqual(0);
    });

    it("should be sent unencrypted if connection is unencrypted", function() {
      eventflit.connection.isEncrypted.andReturn(false);

      eventflit.connect();
      eventflit.connection.options.timeline.info({});

      eventflit.connection.state = "connected";
      eventflit.connection.emit("connected");

      expect(timelineSender.send).toHaveBeenCalledWith(false);
    });

    it("should be sent encrypted if connection is encrypted", function() {
      eventflit.connection.isEncrypted.andReturn(true);

      eventflit.connect();
      eventflit.connection.options.timeline.info({});

      eventflit.connection.state = "connected";
      eventflit.connection.emit("connected");

      expect(timelineSender.send).toHaveBeenCalledWith(true);
    });
  });
});

var Eventflit = require('eventflit_integration');
var TestEnv = require('testenv');

if (TestEnv === "web") {
  window.Eventflit = Eventflit;
  var DependencyLoader = require('dom/dependency_loader').default;
  var DependenciesReceivers = require('dom/dependencies').DependenciesReceivers;
  var Dependencies = require('dom/dependencies').Dependencies;
}

var Integration = require("integration");
var util = require("core/util").default;
var Timer = require("core/utils/timers").OneOffTimer;
var Collections = require('core/utils/collections');
var Defaults = require('core/defaults').default;
var Runtime = require('runtime').default;
var transports = Runtime.Transports;

Integration.describe("Eventflit", function() {
  // Integration tests in Jasmine need to have setup and teardown phases as
  // separate specs to make sure we share connections between actual specs.
  // This way we can also make sure connections are closed even when tests fail.
  //
  // Ideally, we'd have a separate connection per spec, but this introduces
  // significant delays and triggers security mechanisms in some browsers.

  function canRunTwoConnections(transport, encrypted) {
    if (transport !== "sockjs") {
      return true;
    }
    return !/(MSIE [67])|(Version\/(4|5\.0).*Safari)/.test(navigator.userAgent);
  }

  var TRANSPORTS = transports;

  function subscribe(eventflit, channelName, callback) {
    var channel = eventflit.subscribe(channelName);
    channel.bind("eventflit:subscription_succeeded", function(param) {
      callback(channel, param);
    });
    return channel;
  }

  function buildPublicChannelTests(getEventflit, prefix) {
    it("should subscribe and receive a message sent via REST API", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

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
          url: Integration.API_URL + "/v2/send",
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

    it("should not receive messages after unsubscribing", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      var onSubscribed = jasmine.createSpy("onSubscribed");
      var channel = subscribe(eventflit, channelName, onSubscribed);

      var eventName = "after_unsubscribing";
      var received = null;
      var timer = null;

      waitsFor(function() {
        return onSubscribed.calls.length;
      }, "subscription to succeed", 10000);
      runs(function() {
        channel.bind(eventName, function(message) {
          received = message;
        });
        eventflit.unsubscribe(channelName);
        Integration.sendAPIMessage({
          url: Integration.API_URL + "/v2/send",
          channel: channelName,
          event: eventName,
          data: {}
        });
        timer = new Timer(3000, function() {});
      });
      waitsFor(function() {
        return !timer.isRunning();
      }, "timer to finish", 3210);
      runs(function() {
        expect(received).toBe(null);
      });
    });

    it("should handle unsubscribing as an idempotent operation", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      var onSubscribed = jasmine.createSpy("onSubscribed");
      subscribe(eventflit, channelName, onSubscribed);

      waitsFor(function() {
        return onSubscribed.calls.length;
      }, "subscription to succeed", 10000);
      runs(function() {
        eventflit.unsubscribe(channelName);
        eventflit.unsubscribe(channelName);
        eventflit.unsubscribe(channelName);
      });
    });

    it("should handle cancelling pending subscription", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      var eventName = "after_unsubscribing";
      var received = null;
      var timer = null;

      var channel = eventflit.subscribe(channelName);
      channel.bind(eventName, function(message) {
        received = message;
      });

      eventflit.unsubscribe(channelName);
      waitsFor(function() {
        return !channel.subscriptionPending;
      }, "subscription to succeed", 10000);
      runs(function () {
        Integration.sendAPIMessage({
          url: Integration.API_URL + "/v2/send",
          channel: channelName,
          event: eventName,
          data: {}
        });
        timer = new Timer(3000, function() {});
      });
      waitsFor(function() {
        return !timer.isRunning();
      }, "timer to finish", 10000);
      runs(function() {
        expect(channel.subscribed).toEqual(false);
        expect(received).toBe(null);
      });
    });

    it("should handle reinstating cancelled pending subscription", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      var eventName = "after_subscribing";
      var received = null;
      var timer = null;

      var channel = eventflit.subscribe(channelName);
      channel.bind(eventName, function(message) {
        received = message;
      });

      eventflit.unsubscribe(channelName);
      eventflit.subscribe(channelName);
      waitsFor(function() {
        return !channel.subscriptionPending;
      }, "subscription to succeed", 10000);
      runs(function () {
        Integration.sendAPIMessage({
          url: Integration.API_URL + "/v2/send",
          channel: channelName,
          event: eventName,
          data: {}
        });
        timer = new Timer(3000, function() {});
      });
      waitsFor(function() {
        return !timer.isRunning();
      }, "timer to finish", 10000);
      runs(function() {
        expect(channel.subscribed).toEqual(true);
        expect(received).not.toBe(null);
      });
    });
  }

  function buildSubscriptionStateTests(getEventflit, prefix) {
    it("sub-sub = sub", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);
      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      waitsFor(function() {
        return eventflit.channel(channelName).subscribed;
      }, "subscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName).subscribed).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);
      });
    });

    it("sub-wait-sub = sub", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      waitsFor(function() {
        return eventflit.channel(channelName).subscribed;
      }, "subscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName).subscribed).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

        eventflit.subscribe(channelName)
        expect(eventflit.channel(channelName).subscribed).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);
      });
    });

    it("sub-unsub = NOP", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      eventflit.unsubscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(true);

      waitsFor(function() {
        return !eventflit.channel(channelName);
      }, "unsubscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName)).toBe(undefined);
      });
    });

    it("sub-wait-unsub = NOP", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      waitsFor(function() {
        return eventflit.channel(channelName).subscribed;
      }, "subscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName).subscribed).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

        eventflit.unsubscribe(channelName)
        expect(eventflit.channel(channelName)).toBe(undefined);
      });
    });

    it("sub-unsub-sub = sub", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      eventflit.unsubscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(true);

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      waitsFor(function() {
        return eventflit.channel(channelName).subscribed;
      }, "subscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName).subscribed).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);
      });
    });

    it("sub-unsub-wait-sub = sub", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      eventflit.unsubscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(true);

      waitsFor(function() {
        return !eventflit.channel(channelName);
      }, "unsubscription to finish", 10000);
      runs(function() {
        expect(eventflit.channel(channelName)).toBe(undefined);

        eventflit.subscribe(channelName)
        expect(eventflit.channel(channelName).subscribed).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);
      });

      waitsFor(function() {
        return eventflit.channel(channelName).subscribed;
      }, "subscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName).subscribed).toEqual(true);
        expect(eventflit.channel(channelName).subscriptionPending).toEqual(false);
        expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);
      });
    });

    it("sub-unsub-unsub = NOP", function() {
      var eventflit = getEventflit();
      var channelName = Integration.getRandomName((prefix || "") + "integration");

      eventflit.subscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(false);

      eventflit.unsubscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(true);

      eventflit.unsubscribe(channelName)
      expect(eventflit.channel(channelName).subscribed).toEqual(false);
      expect(eventflit.channel(channelName).subscriptionPending).toEqual(true);
      expect(eventflit.channel(channelName).subscriptionCancelled).toEqual(true);

      waitsFor(function() {
        return !eventflit.channel(channelName);
      }, "unsubscription to finish", 10000);

      runs(function() {
        expect(eventflit.channel(channelName)).toBe(undefined);
      });
    });
  }

  function buildClientEventsTests(getEventflit1, getEventflit2, prefix) {
    it("should receive a client event sent by another connection", function() {
      var eventflit1 = getEventflit1();
      var eventflit2 = getEventflit2();

      var channelName = Integration.getRandomName((prefix || "") + "integration_client_events");

      var channel1, channel2;
      var onSubscribed1 = jasmine.createSpy("onSubscribed1");
      var onSubscribed2 = jasmine.createSpy("onSubscribed2");

      var eventName = "client-test";
      var data = { foo: "bar" };
      var onEvent1 = jasmine.createSpy("onEvent1");
      var onEvent2 = jasmine.createSpy("onEvent2");

      runs(function() {
        channel1 = subscribe(eventflit1, channelName, onSubscribed1);
        channel2 = subscribe(eventflit2, channelName, onSubscribed2);
      });
      waitsFor(function() {
        return onSubscribed1.calls.length > 0 && onSubscribed2.calls.length > 0;
      }, "both connections to subscribe", 10000);
      runs(function() {
        channel1.bind(eventName, onEvent1);
        channel2.bind(eventName, onEvent2);
        eventflit1.send_event(eventName, data, channelName);
      });
      waitsFor(function() {
        return onEvent2.calls.length;
      }, "second connection to receive a message", 10000);
      runs(function() {
        eventflit1.unsubscribe(channelName);
        eventflit2.unsubscribe(channelName);
      });
    });

    it("should not receive a client event sent by itself", function() {
      var eventflit = getEventflit1();

      var channelName = Integration.getRandomName((prefix || "") + "integration_client_events");
      var onSubscribed = jasmine.createSpy("onSubscribed");

      var eventName = "client-test";
      var onEvent = jasmine.createSpy("onEvent");
      var timer = null;

      var channel = subscribe(eventflit, channelName, onSubscribed);
      waitsFor(function() {
        return onSubscribed.calls.length > 0;
      }, "connection to subscribe", 10000);
      runs(function() {
        channel.bind(eventName, onEvent);
        eventflit.send_event(eventName, {}, channelName);
        timer = new Timer(3000, function() {});
      });
      waitsFor(function() {
        return !timer.isRunning();
      }, "timer to finish", 3210);
      runs(function() {
        expect(onEvent).not.toHaveBeenCalled();
        eventflit.unsubscribe(channelName);
      });
    });
  }

  function buildPresenceChannelTests(getEventflit1, getEventflit2) {
    it("should get connection's member data", function() {
      var eventflit = getEventflit1();
      var channelName = Integration.getRandomName("presence-integration_me");

      var members = null;
      subscribe(eventflit, channelName, function(channel, ms) {
        members = ms;
      });

      waitsFor(function() {
        return members !== null;
      }, "channel to subscribe", 10000);
      runs(function() {
        expect(members.me).toEqual({
          id: eventflit.connection.socket_id,
          info: {
            name: "Integration " + eventflit.connection.socket_id,
            email: "integration-" + eventflit.connection.socket_id + "@example.com"
          }
        });
      });
    });

    it("should receive a member added event", function() {
      var eventflit1 = getEventflit1();
      var eventflit2 = getEventflit2();
      var channelName = Integration.getRandomName("presence-integration_member_added");

      var member = null;
      subscribe(eventflit1, channelName, function(channel) {
        channel.bind("eventflit:member_added", function(m) {
          member = m;
        });

        subscribe(eventflit2, channelName, function() {});
      });

      waitsFor(function() {
        return member !== null;
      }, "the member added event", 10000);
      runs(function() {
        expect(member.id).toEqual(eventflit2.connection.socket_id);
        expect(member).toEqual({
          id: eventflit2.connection.socket_id,
          info: {
            name: "Integration " + eventflit2.connection.socket_id,
            email: "integration-" + eventflit2.connection.socket_id + "@example.com"
          }
        });

        eventflit1.unsubscribe(channelName);
        eventflit2.unsubscribe(channelName);
      });
    });

    it("should receive a member removed event", function() {
      var eventflit1 = getEventflit1();
      var eventflit2 = getEventflit2();
      var channelName = Integration.getRandomName("presence-integration_member_removed");

      var member = null;
      subscribe(eventflit2, channelName, function(channel) {
        channel.bind("eventflit:member_added", function(_) {
          channel.bind("eventflit:member_removed", function(m) {
            member = m;
          });
          eventflit1.unsubscribe(channelName);
        });

        subscribe(eventflit1, channelName, function() {});
      });

      waitsFor(function() {
        return member !== null;
      }, "the member removed event", 10000);
      runs(function() {
        expect(member.id).toEqual(eventflit1.connection.socket_id);
        expect(member).toEqual({
          id: eventflit1.connection.socket_id,
          info: {
            name: "Integration " + eventflit1.connection.socket_id,
            email: "integration-" + eventflit1.connection.socket_id + "@example.com"
          }
        });

        eventflit2.unsubscribe(channelName);
      });
    });

    it("should maintain correct members count", function() {
      var eventflit1 = getEventflit1();
      var eventflit2 = getEventflit2();
      var channelName = Integration.getRandomName("presence-integration_member_count");

      var channel1, channel2;

      var onSubscribed1 = jasmine.createSpy("onSubscribed1");
      var onSubscribed2 = jasmine.createSpy("onSubscribed2");
      var onMemberAdded = jasmine.createSpy("onMemberAdded");
      var onMemberRemoved = jasmine.createSpy("onMemberRemoved");

      runs(function() {
        channel1 = subscribe(eventflit1, channelName, onSubscribed1);
        expect(channel1.members.count).toEqual(0);
      });
      waitsFor(function() {
        return onSubscribed1.calls.length > 0;
      }, "first connection to subscribe", 10000);
      runs(function() {
        expect(channel1.members.count).toEqual(1);
        channel1.bind("eventflit:member_added", onMemberAdded);
        channel2 = subscribe(eventflit2, channelName, onSubscribed2);
      });
      waitsFor(function() {
        return onSubscribed2.calls.length > 0;
      }, "second connection to subscribe", 10000);
      runs(function() {
        expect(channel2.members.count).toEqual(2);
      });
      waitsFor(function() {
        return onMemberAdded.calls.length > 0;
      }, "member added event", 10000);
      runs(function() {
        expect(channel1.members.count).toEqual(2);
        channel2.bind("eventflit:member_removed", onMemberRemoved);
        eventflit1.unsubscribe(channelName);
      });
      waitsFor(function() {
        return onMemberRemoved.calls.length > 0;
      }, "member removed event", 10000);
      runs(function() {
        expect(channel2.members.count).toEqual(1);
      });
    });

    it("should maintain correct members data", function() {
      var eventflit1 = getEventflit1();
      var eventflit2 = getEventflit2();
      var channelName = Integration.getRandomName("presence-integration_member_count");

      var channel1, channel2;

      var onSubscribed1 = jasmine.createSpy("onSubscribed1");
      var onSubscribed2 = jasmine.createSpy("onSubscribed2");
      var onMemberAdded = jasmine.createSpy("onMemberAdded");
      var onMemberRemoved = jasmine.createSpy("onMemberRemoved");

      var member1 = {
        id: eventflit1.connection.socket_id,
        info: {
          name: "Integration " + eventflit1.connection.socket_id,
          email: "integration-" + eventflit1.connection.socket_id + "@example.com"
        }
      };
      var member2 = {
        id: eventflit2.connection.socket_id,
        info: {
          name: "Integration " + eventflit2.connection.socket_id,
          email: "integration-" + eventflit2.connection.socket_id + "@example.com"
        }
      };

      runs(function() {
        channel1 = subscribe(eventflit1, channelName, onSubscribed1);
      });
      waitsFor(function() {
        return onSubscribed1.calls.length > 0;
      }, "first connection to subscribe", 10000);
      runs(function() {
        expect(channel1.members.get(eventflit1.connection.socket_id))
          .toEqual(member1);
        expect(channel1.members.get(eventflit2.connection.socket_id))
          .toBe(null);

        expect(channel1.members.me).toEqual(member1);

        channel1.bind("eventflit:member_added", onMemberAdded);
        channel2 = subscribe(eventflit2, channelName, onSubscribed2);
      });
      waitsFor(function() {
        return onSubscribed2.calls.length > 0;
      }, "second connection to subscribe", 10000);
      runs(function() {
        expect(channel2.members.get(eventflit1.connection.socket_id))
          .toEqual(member1);
        expect(channel2.members.get(eventflit2.connection.socket_id))
          .toEqual(member2);

        expect(channel2.members.me).toEqual(member2);
      });
      waitsFor(function() {
        return onMemberAdded.calls.length > 0;
      }, "member added event", 10000);
      runs(function() {
        expect(channel1.members.get(eventflit1.connection.socket_id))
          .toEqual(member1);
        expect(channel1.members.get(eventflit2.connection.socket_id))
          .toEqual(member2);

        channel2.bind("eventflit:member_removed", onMemberRemoved);
        eventflit1.unsubscribe(channelName);
      });
      waitsFor(function() {
        return onMemberRemoved.calls.length > 0;
      }, "member removed event", 10000);
      runs(function() {
        expect(channel2.members.get(eventflit1.connection.socket_id))
          .toBe(null);
        expect(channel2.members.get(eventflit2.connection.socket_id))
          .toEqual(member2);
      });
    });
  }

  function buildIntegrationTests(transport, encrypted) {
    if (!TRANSPORTS[transport].isSupported({ encrypted: encrypted })) {
      return;
    }

    describe("with " + (transport ? transport + ", " : "") + "encrypted=" + encrypted, function() {
      var eventflit1, eventflit2;

      beforeEach(function() {
        Collections.objectApply(TRANSPORTS, function(t, name) {
          spyOn(t, "isSupported").andReturn(false);
        });
        TRANSPORTS[transport].isSupported.andReturn(true);
      });

      describe("setup", function() {
        it("should open connections", function() {
          eventflit1 = new Eventflit("7324d55a5eeb8f554761", {
            encrypted: encrypted,
            disableStats: true
          });
          if (canRunTwoConnections(transport, encrypted)) {
            eventflit2 = new Eventflit("7324d55a5eeb8f554761", {
              encrypted: encrypted,
              disableStats: true
            });
            waitsFor(function() {
              return eventflit2.connection.state === "connected";
            }, "second connection to be established", 20000);
          }
          waitsFor(function() {
            return eventflit1.connection.state === "connected";
          }, "first connection to be established", 20000);
        });

      });

      describe("with a public channel", function() {
        buildPublicChannelTests(
          function() { return eventflit1; }
        );
      });

      describe("with a private channel", function() {
        var channelName = Integration.getRandomName("private-integration");
        var channel1, channel2;

        buildPublicChannelTests(
          function() { return eventflit1; }
        );

        buildSubscriptionStateTests(
          function() { return eventflit1; },
          "private-"
        );

        if (canRunTwoConnections(transport, encrypted)) {
          buildClientEventsTests(
            function() { return eventflit1; },
            function() { return eventflit2; },
            "private-"
          );
        }
      });

      describe("with a presence channel", function() {
        buildPublicChannelTests(
          function() { return eventflit1; }
        );

        buildSubscriptionStateTests(
          function() { return eventflit1; },
          "presence-"
        );

        if (canRunTwoConnections(transport, encrypted)) {
          buildClientEventsTests(
            function() { return eventflit1; },
            function() { return eventflit2; },
            "presence-"
          );
          buildPresenceChannelTests(
            function() { return eventflit1; },
            function() { return eventflit2; }
          );
        }
      });

      describe("teardown", function() {
        if (canRunTwoConnections(transport, encrypted)) {
          it("should disconnect second connection", function() {
            eventflit2.disconnect();
          });
        }

        it("should disconnect first connection", function() {
          eventflit1.disconnect();
        });
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
    Defaults.channel_auth_transport = (TestEnv === 'web') ? 'jsonp' : 'ajax';
    Defaults.channel_auth_endpoint = Integration.API_URL + "/auth";
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

  buildIntegrationTests("ws", false);
  buildIntegrationTests("ws", true);

  if (Runtime.isXHRSupported()) {
    // CORS-compatible browsers
    if (TestEnv !== "web" || !/Android 2\./i.test(navigator.userAgent)) {
      // Android 2.x does a lot of buffering, which kills streaming
      buildIntegrationTests("xhr_streaming", false);
      buildIntegrationTests("xhr_streaming", true);
    }
    buildIntegrationTests("xhr_polling", false);
    buildIntegrationTests("xhr_polling", true);
  } else if (Runtime.isXDRSupported(false)) {
    buildIntegrationTests("xdr_streaming", false);
    buildIntegrationTests("xdr_streaming", true);
    buildIntegrationTests("xdr_polling", false);
    buildIntegrationTests("xdr_polling", true);
    // IE can fall back to SockJS if protocols don't match
    // No SockJS encrypted tests due to the way JS files are served
    buildIntegrationTests("sockjs", false);
  } else {
    // Browsers using SockJS
    buildIntegrationTests("sockjs", false);
    buildIntegrationTests("sockjs", true);
  }

  it("should restore the global config", function() {
    Dependencies = _Dependencies;
    Defaults.channel_auth_endpoint = _channel_auth_endpoint;
    Defaults.channel_auth_transport = _channel_auth_transport;
    Defaults.VERSION = _VERSION;
  });
});

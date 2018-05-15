var Errors = require('core/errors');
var Factory = require('core/utils/factory').default;
var Mocks = require("mocks");

describe("Channel", function() {
  var eventflit;
  var channel;
  var Channel = require('core/channels/channel').default;

  beforeEach(function() {
    eventflit = Mocks.getEventflit();
    channel = new Channel("test", eventflit);
  });

  describe("after construction", function() {
    it("#subscribed should be false", function() {
      expect(channel.subscribed).toEqual(false);
    });

    it("#subscriptionPending should be false", function() {
      expect(channel.subscriptionPending).toEqual(false);
    });

    it("#subscriptionCancelled should be false", function() {
      expect(channel.subscriptionCancelled).toEqual(false);
    });
  });

  describe("#authorize", function() {
    it("should call back with false, {} immediately", function() {
      var callback = jasmine.createSpy("callback");
      channel.authorize("1.1", callback);
      expect(callback).toHaveBeenCalledWith(false, {});
    });
  });

  describe("#trigger", function() {
    it("should raise an exception if the event name does not start with client-", function() {
      expect(function() {
        channel.trigger("whatever", {});
      }).toThrow(jasmine.any(Errors.BadEventName));
    });

    it("should call send_event on connection", function() {
      channel.trigger("client-test", { k: "v" });
      expect(eventflit.send_event)
        .toHaveBeenCalledWith("client-test", { k: "v" }, "test");
    });

    it("should return true if connection sent the event", function() {
      eventflit.send_event.andReturn(true);
      expect(channel.trigger("client-test", {})).toBe(true);
    });

    it("should return false if connection didn't send the event", function() {
      eventflit.send_event.andReturn(false);
      expect(channel.trigger("client-test", {})).toBe(false);
    });
  });

  describe("#disconnect", function() {
    it("should set subscribed to false", function() {
      channel.handleEvent("eventflit_internal:subscription_succeeded");
      channel.disconnect();
      expect(channel.subscribed).toEqual(false);
    });

    it("should set subscriptionPending to false", function() {
      channel.subscriptionPending = true;
      
      channel.disconnect();

      expect(channel.subscriptionPending).toEqual(false);
    });
  });

  describe("#handleEvent", function() {
    it("should not emit eventflit_internal:* events", function() {
      var callback = jasmine.createSpy("callback");
      channel.bind("eventflit_internal:test", callback);
      channel.bind_global(callback);

      channel.handleEvent("eventflit_internal:test");

      expect(callback).not.toHaveBeenCalled();
    });

    describe("on eventflit_internal:subscription_succeeded", function() {
      it("should emit eventflit:subscription_succeeded", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("eventflit:subscription_succeeded", callback);

        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(callback).toHaveBeenCalledWith("123");
      });

      it("should set #subscribed to true", function() {
        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(channel.subscribed).toEqual(true);
      });

      it("should set #subscriptionPending to false", function() {
        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(channel.subscriptionPending).toEqual(false);
      });
    });

    describe("eventflit_internal:subscription_succeeded but subscription cancelled", function() {
      it("should not emit eventflit:subscription_succeeded", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("eventflit:subscription_succeeded", callback);

        channel.cancelSubscription();
        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(callback).not.toHaveBeenCalled();
      });

      it("should set #subscribed to true", function() {
        channel.cancelSubscription();
        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(channel.subscribed).toEqual(true);
      });

      it("should set #subscriptionPending to false", function() {
        channel.cancelSubscription();
        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(channel.subscriptionPending).toEqual(false);
      });

      it("should call #eventflit.unsubscribe", function() {
        expect(eventflit.unsubscribe).not.toHaveBeenCalled();

        channel.cancelSubscription();
        channel.handleEvent("eventflit_internal:subscription_succeeded", "123");

        expect(eventflit.unsubscribe).toHaveBeenCalledWith(channel.name);
      });
    });

    describe("on other events", function() {
      it("should emit the event", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("something", callback);

        channel.handleEvent("something", 9);

        expect(callback).toHaveBeenCalledWith(9);
      });

      it("should emit the event even if it's named like JS built-in", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("toString", callback);

        channel.handleEvent("toString", "works");

        expect(callback).toHaveBeenCalledWith("works");
      });
    });
  });

  describe("#subscribe", function() {
    beforeEach(function() {
      eventflit.connection = {
        socket_id: "9.37"
      };
      channel.authorize = jasmine.createSpy("authorize");
    });

    it("should authorize the connection first", function() {
      expect(channel.authorize.calls.length).toEqual(0);
      channel.subscribe();

      expect(channel.authorize.calls.length).toEqual(1);
      expect(channel.authorize).toHaveBeenCalledWith(
        "9.37", jasmine.any(Function)
      );
    });

    it("should send a eventflit:subscribe message on successful authorization", function() {
      expect(eventflit.send_event).not.toHaveBeenCalled();

      channel.subscribe();
      var authorizeCallback = channel.authorize.calls[0].args[1];
      authorizeCallback(false, {
        auth: "one",
        channel_data: "two"
      });

      expect(eventflit.send_event).toHaveBeenCalledWith(
        "eventflit:subscribe",
        { auth: "one", channel_data: "two", channel: "test" }
      );
    });

    it("should emit eventflit:subscription_error event on unsuccessful authorization", function() {
      var onSubscriptionError = jasmine.createSpy("onSubscriptionError");
      channel.bind("eventflit:subscription_error", onSubscriptionError);

      channel.subscribe();
      var authorizeCallback = channel.authorize.calls[0].args[1];
      authorizeCallback(true, { error: "test error" });

      expect(onSubscriptionError).toHaveBeenCalledWith(
        { error: "test error" }
      );
      expect(eventflit.send_event).not.toHaveBeenCalled();
    });

    it("should set #subscriptionPending to true if previously unsubscribed", function() {
      expect(channel.subscriptionPending).toEqual(false);

      channel.subscribe();

      expect(channel.subscriptionPending).toEqual(true);
    });

    it("should do nothing if already subscribed", function() {
      channel.subscribed = true;

      channel.subscribe();

      expect(channel.subscriptionPending).toEqual(false);
    });
  });

  describe("#unsubscribe", function() {
    it("should send a eventflit:unsubscribe message", function() {
      expect(eventflit.send_event).not.toHaveBeenCalled();
      channel.unsubscribe();

      expect(eventflit.send_event).toHaveBeenCalledWith(
        "eventflit:unsubscribe", { channel: "test" }
      );
    });

    it("should set #subscribed to false", function() {
      channel.subscribed = true;

      channel.unsubscribe();

      expect(channel.subscribed).toEqual(false);
    });
  });

  describe("#cancelSubscription", function() {
    it("should set #subscriptionCancelled to true", function() {
      expect(channel.subscriptionCancelled).toEqual(false);

      channel.cancelSubscription();

      expect(channel.subscriptionCancelled).toEqual(true);
    });
  });

  describe("#reinstateSubscription", function() {
    it("should set #subscriptionCancelled to false", function() {
      channel.cancelSubscription()
      expect(channel.subscriptionCancelled).toEqual(true);

      channel.reinstateSubscription();

      expect(channel.subscriptionCancelled).toEqual(false);
    });
  });
});

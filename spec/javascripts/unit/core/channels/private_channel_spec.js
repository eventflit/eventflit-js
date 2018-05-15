var Authorizer = require('core/auth/eventflit_authorizer').default;
var Errors = require('core/errors');
var PrivateChannel = require('core/channels/private_channel').default;
var Factory = require('core/utils/factory').default;
var Mocks = require("mocks");

describe("PrivateChannel", function() {
  var eventflit;
  var channel;
  var factorySpy;

  beforeEach(function() {
    eventflit = Mocks.getEventflit({ foo: "bar" });
    channel = new PrivateChannel("private-test", eventflit);
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
    var authorizer;

    beforeEach(function() {
      authorizer = Mocks.getAuthorizer();
      factorySpy = spyOn(Factory, "createAuthorizer").andReturn(authorizer);
    });

    it("should create and call an authorizer", function() {
      channel.authorize("1.23", function() {});
      expect(Factory.createAuthorizer.calls.length).toEqual(1);
      expect(Factory.createAuthorizer).toHaveBeenCalledWith(
        channel,
        { foo: "bar" }
      );
    });

    it("should call back with authorization data", function() {
      var callback = jasmine.createSpy("callback");
      channel.authorize("1.23", callback);

      expect(callback).not.toHaveBeenCalled();
      authorizer._callback(false, { foo: "bar" });

      expect(callback).toHaveBeenCalledWith(false, { foo: "bar" });
    });

    describe('with custom authorizer', function() {
      beforeEach(function() {
        eventflit = Mocks.getEventflit({ 
          authorizer: function(channel, options) {
            return authorizer;
          }
        });
        channel = new PrivateChannel("private-test-custom-auth", eventflit);
        factorySpy.andCallThrough();
      });

      it("should call the authorizer", function() {
        var callback = jasmine.createSpy("callback");
        channel.authorize("1.23", callback);
        authorizer._callback(false, { foo: "bar" });
        expect(callback).toHaveBeenCalledWith(false, { foo: "bar" });
      });
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
        .toHaveBeenCalledWith("client-test", { k: "v" }, "private-test");
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
    });
  });
});

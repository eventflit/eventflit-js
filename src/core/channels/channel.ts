import {default as EventsDispatcher} from '../events/dispatcher';
import * as Errors from '../errors';
import Logger from '../logger';
import Eventflit from '../eventflit';

/** Provides base public channel interface with an event emitter.
 *
 * Emits:
 * - eventflit:subscription_succeeded - after subscribing successfully
 * - other non-internal events
 *
 * @param {String} name
 * @param {Eventflit} eventflit
 */
export default class Channel extends EventsDispatcher {
  name: string;
  eventflit: Eventflit;
  subscribed: boolean;
  subscriptionPending: boolean;
  subscriptionCancelled: boolean;

  constructor(name : string, eventflit: Eventflit) {
    super(function(event, data){
      Logger.debug('No callbacks on ' + name + ' for ' + event);
    });

    this.name = name;
    this.eventflit = eventflit;
    this.subscribed = false;
    this.subscriptionPending = false;
    this.subscriptionCancelled = false;
  }

  /** Skips authorization, since public channels don't require it.
   *
   * @param {Function} callback
   */
  authorize(socketId : string, callback : Function) {
    return callback(false, {});
  }

  /** Triggers an event */
  trigger(event : string, data : any) {
    if (event.indexOf("client-") !== 0) {
      throw new Errors.BadEventName(
        "Event '" + event + "' does not start with 'client-'"
      );
    }
    return this.eventflit.send_event(event, data, this.name);
  }

  /** Signals disconnection to the channel. For internal use only. */
  disconnect() {
    this.subscribed = false;
    this.subscriptionPending = false;
  }

  /** Handles an event. For internal use only.
   *
   * @param {String} event
   * @param {*} data
   */
  handleEvent(event : string, data : any) {
    if (event.indexOf("pusher_internal:") === 0) {
      if (event === "pusher_internal:subscription_succeeded") {
        this.subscriptionPending = false;
        this.subscribed = true;
        if (this.subscriptionCancelled) {
          this.eventflit.unsubscribe(this.name);
        } else {
          this.emit("eventflit:subscription_succeeded", data);
        }
      }
    } else {
      this.emit(event, data);
    }
  }

  /** Sends a subscription request. For internal use only. */
  subscribe() {
    if (this.subscribed) { return; }
    this.subscriptionPending = true;
    this.subscriptionCancelled = false;
    this.authorize(this.eventflit.connection.socket_id, (error, data)=> {
      if (error) {
        this.handleEvent('eventflit:subscription_error', data);
      } else {
        this.eventflit.send_event('eventflit:subscribe', {
          auth: data.auth,
          channel_data: data.channel_data,
          channel: this.name
        });
      }
    });
  }

  /** Sends an unsubscription request. For internal use only. */
  unsubscribe() {
    this.subscribed = false;
    this.eventflit.send_event('eventflit:unsubscribe', {
      channel: this.name
    });
  }

  /** Cancels an in progress subscription. For internal use only. */
  cancelSubscription() {
    this.subscriptionCancelled = true;
  }

  /** Reinstates an in progress subscripiton. For internal use only. */
  reinstateSubscription() {
    this.subscriptionCancelled = false;
  }
}

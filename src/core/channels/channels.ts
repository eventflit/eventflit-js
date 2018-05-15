import Channel from "./channel";
import * as Collections from '../utils/collections';
import ChannelTable from './channel_table';
import Factory from '../utils/factory';
import Eventflit from '../eventflit';

/** Handles a channel map. */
export default class Channels {
  channels: ChannelTable;

  constructor() {
    this.channels = {};
  }

  /** Creates or retrieves an existing channel by its name.
   *
   * @param {String} name
   * @param {Eventflit} eventflit
   * @return {Channel}
   */
  add(name : string, eventflit : Eventflit) {
    if (!this.channels[name]) {
      this.channels[name] = createChannel(name, eventflit);
    }
    return this.channels[name];
  }

  /** Returns a list of all channels
   *
   * @return {Array}
   */
  all() : Channel[] {
    return Collections.values(this.channels);
  }

  /** Finds a channel by its name.
   *
   * @param {String} name
   * @return {Channel} channel or null if it doesn't exist
   */
  find(name: string) {
    return this.channels[name];
  }

  /** Removes a channel from the map.
   *
   * @param {String} name
   */
  remove(name : string) {
    var channel = this.channels[name];
    delete this.channels[name];
    return channel;
  }

  /** Proxies disconnection signal to all channels. */
  disconnect() {
    Collections.objectApply(this.channels, function(channel) {
      channel.disconnect();
    });
  }
}

function createChannel(name : string, eventflit : Eventflit) : Channel {
  if (name.indexOf('private-') === 0) {
    return Factory.createPrivateChannel(name, eventflit);
  } else if (name.indexOf('presence-') === 0) {
    return Factory.createPresenceChannel(name, eventflit);
  } else {
    return Factory.createChannel(name, eventflit);
  }
}

import AssistantToTheTransportManager from "../transports/assistant_to_the_transport_manager";
import PingDelayOptions from '../transports/ping_delay_options';
import Transport from "../transports/transport";
import TransportManager from "../transports/transport_manager";
import Handshake from "../connection/handshake";
import TransportConnection from "../transports/transport_connection";
import SocketHooks from "../http/socket_hooks";
import HTTPSocket from "../http/http_socket";
import {AuthorizerOptions, Authorizer} from '../auth/options';
import PusherAuthorizer from '../auth/pusher_authorizer';
import Timeline from "../timeline/timeline";
import {default as TimelineSender, TimelineSenderOptions} from "../timeline/timeline_sender";
import PresenceChannel from "../channels/presence_channel";
import PrivateChannel from "../channels/private_channel";
import Channel from "../channels/channel";
import ConnectionManager from "../connection/connection_manager";
import ConnectionManagerOptions from '../connection/connection_manager_options';
import Ajax from "../http/ajax";
import Channels from "../channels/channels";
import Eventflit from '../eventflit';

var Factory = {

  createChannels() : Channels {
    return new Channels();
  },

  createConnectionManager(key : string, options : ConnectionManagerOptions) : ConnectionManager {
    return new ConnectionManager(key, options);
  },

  createChannel(name: string, eventflit: Eventflit) : Channel {
    return new Channel(name, eventflit);
  },

  createPrivateChannel(name: string, eventflit: Eventflit) : PrivateChannel {
    return new PrivateChannel(name, eventflit);
  },

  createPresenceChannel(name: string, eventflit: Eventflit) : PresenceChannel {
    return new PresenceChannel(name, eventflit);
  },

  createTimelineSender(timeline : Timeline, options : TimelineSenderOptions) {
    return new TimelineSender(timeline, options);
  },

  createAuthorizer(channel : Channel, options : AuthorizerOptions) : Authorizer {
    if (options.authorizer) {
      return options.authorizer(channel, options);
    }

    return new PusherAuthorizer(channel, options);
  },

  createHandshake(transport : TransportConnection, callback : (HandshakePayload)=>void) : Handshake {
    return new Handshake(transport, callback);
  },

  createAssistantToTheTransportManager(manager : TransportManager, transport : Transport, options : PingDelayOptions) : AssistantToTheTransportManager {
    return new AssistantToTheTransportManager(manager, transport, options);
  }

}

export default Factory;

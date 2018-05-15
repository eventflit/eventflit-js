import {stringify} from './utils/collections';
import Eventflit from './eventflit';

const Logger = {
  debug(...args : any[]) {
    if (!Eventflit.log) {
      return
    }
    Eventflit.log(stringify.apply(this, arguments));
  },
  warn(...args : any[]) {
    var message = stringify.apply(this, arguments);
    if (Eventflit.log) {
      Eventflit.log(message);
    } else if (global.console) {
      if (global.console.warn) {
        global.console.warn(message);
      } else if (global.console.log) {
        global.console.log(message);
      }
    }
  }
}

export default Logger;

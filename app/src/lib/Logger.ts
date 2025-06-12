// 데모버전 Logger

// import debug from 'debug';

// const APP_NAME = 'mediasoup-demo';

// export default class Logger {
// 	constructor(prefix) {
// 		if (prefix) {
// 			this._debug = debug(`${APP_NAME}:${prefix}`);
// 			this._warn = debug(`${APP_NAME}:WARN:${prefix}`);
// 			this._error = debug(`${APP_NAME}:ERROR:${prefix}`);
// 		} else {
// 			this._debug = debug(APP_NAME);
// 			this._warn = debug(`${APP_NAME}:WARN`);
// 			this._error = debug(`${APP_NAME}:ERROR`);
// 		}

// 		/* eslint-disable no-console */
// 		this._debug.log = console.info.bind(console);
// 		this._warn.log = console.warn.bind(console);
// 		this._error.log = console.error.bind(console);
// 		/* eslint-enable no-console */
// 	}

// 	get debug() {
// 		return this._debug;
// 	}

// 	get warn() {
// 		return this._warn;
// 	}

// 	get error() {
// 		return this._error;
// 	}
// }


// src/lib/Logger.ts

export default class Logger {
  private readonly _name: string;

  constructor(name: string) {
    this._name = name;
  }

  debug(...args: any[]): void {
    console.debug(`[${this._name}]`, ...args);
  }

  warn(...args: any[]): void {
    console.warn(`[${this._name}]`, ...args);
  }

  error(...args: any[]): void {
    console.error(`[${this._name}]`, ...args);
  }
}

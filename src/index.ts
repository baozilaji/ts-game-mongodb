import { MongoClient } from 'mongodb';
import { Configuration } from 'ts-game-environment';

interface MongodbConf {
  uri: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
  waitQueueTimeoutMS?: number;
  connectTimeoutMS?: number;
}

const KEY_MONGODB = 'mongodb';
const KEY_MONGODB_DEFAULT_SERVER = 'default';

export class MongodbManager {
  private static _instance?: MongodbManager;
  private _clients: Record<string, MongoClient> = {};
  private _closed = false;

  private constructor() {}

  static async init(): Promise<void> {
    if (MongodbManager._instance) return;

    const instance = new MongodbManager();
    const mongoCfg = Configuration.getConf(KEY_MONGODB);

    if (!mongoCfg || typeof mongoCfg !== 'object') {
      MongodbManager._instance = instance;
      return;
    }

    const entries = Object.entries(mongoCfg);

    for (const [key, val] of entries) {
      const cfg = val as unknown as MongodbConf;

      if (!cfg?.uri) {
        throw new Error(`MongoDB config "${key}" missing uri`);
      }

      const client = new MongoClient(cfg.uri, {
        maxPoolSize: cfg.maxPoolSize ?? 10,
        minPoolSize: cfg.minPoolSize ?? 2,
        maxIdleTimeMS: cfg.maxIdleTimeMS ?? 30_000,
        waitQueueTimeoutMS: cfg.waitQueueTimeoutMS ?? 5_000,
        connectTimeoutMS: cfg.connectTimeoutMS ?? 5_000,
      });

      try {
        await client.connect();
      } catch (err) {
        await client.close(true);
        throw new Error(
          `Failed to connect MongoDB server "${key}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      instance._clients[key] = client;
    }

    MongodbManager._instance = instance;
  }

  static get instance() {
    if (!MongodbManager._instance) {
      throw new Error('MongodbManager not initialized, call init() first');
    }
    return MongodbManager._instance;
  }

  getMongodbClient(serverName = KEY_MONGODB_DEFAULT_SERVER): MongoClient {
    if (this._closed) {
      throw new Error('MongodbManager already closed');
    }

    if (this._clients[serverName] !== undefined) {
      return this._clients[serverName];
    }

    throw new Error(`Can't find mongo config for ${serverName}`);
  }

  async close(force = false): Promise<void> {
    if (this._closed) return;
    this._closed = true;

    const errors: Error[] = [];

    for (const [key, client] of Object.entries(this._clients)) {
      try {
        await client.close(force);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    this._clients = {};

    if (errors.length > 0) {
      console.error('MongodbManager close errors:', errors);
    }
  }
}

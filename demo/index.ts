import { MongodbManager } from '../src/index';
import { MongoClient } from 'mongodb';

await MongodbManager.init();

const client = MongodbManager.instance.getMongodbClient();
const db = client.db('mygame');

await db.collection('users').insertOne({ name: 'eric' });

await MongodbManager.instance.close();
import { createClient } from 'redis';

const client = createClient();

export function initConnection() {
  return Promise.resolve(client.connect());
}
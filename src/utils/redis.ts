import { createClient } from 'redis';

const client = createClient();

export async function initConnection() {
  await client.connect();
}

export function cacheItem(key: string, value: string) {
  return new Promise<string | null>((resolve, reject) => {
    client.set(key, value).then(resolve).catch(reject);
  });
}

export function hCacheItem(key: string, field: string, value: string) {
  return new Promise<number>((resolve, reject) => {
    client.hSet(key, field, value).then(resolve).catch(reject);
  });
}

export function getItem(key: string) {
  return new Promise<string | null>((resolve, reject) => {
    client.get(key).then(resolve).then(reject);
  });
}

export function hGetItems(key: string) {
  return new Promise<{ [x: string]: string }>((resolve, reject) => {
    client.hGetAll(key).then(resolve).catch(reject);
  });
}

export function checkIfItemExists(key: string) {
  return new Promise<boolean>((resolve, reject) => {
    client
      .exists(key)
      .then(val => resolve(val === 1))
      .catch(reject);
  });
}

export function getAllKeysMatchingPattern(pattern: string) {
  return new Promise<string[]>((resolve, reject) => {
    client
      .keys(pattern + '*')
      .then(resolve)
      .catch(reject);
  });
}

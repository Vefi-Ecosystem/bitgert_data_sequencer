import axios from 'axios';
import { rpcUrl } from '../constants';

const baseRpcClient = axios.create({ baseURL: rpcUrl });

export default function request(method: string, params: any[]) {
  return new Promise<any>((resolve, reject) => {
    baseRpcClient
      .post('/', {
        method,
        params,
        id: 0,
        jsonrpc: '2.0'
      })
      .then(({ data }) => {
        if (!!data.result) resolve(data.result);
        else reject(data.error);
      })
      .catch(reject);
  });
}

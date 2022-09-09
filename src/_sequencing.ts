import { Interface } from '@ethersproject/abi';
import { formatUnits } from '@ethersproject/units';
import { hexValue } from '@ethersproject/bytes';
import { JsonRpcProvider } from '@ethersproject/providers';
import { checkIfItemExists, cacheItem, getItem, hCacheItem, hGetItems } from './utils/redis';
import {
  redisBlocksKey,
  redisLastProcessedBlockKey,
  redisTokensKey,
  redisTokensBalanceRecordKey,
  redisTransactionsKey,
  rpcUrl
} from './constants';
import request from './utils/rpc';
import log from './log';
import erc20Abi from './assets/ERC20ABI.json';

const provider = new JsonRpcProvider(rpcUrl, 32520);

async function processBlock(blockNumber: string) {
  try {
    const block = await request('eth_getBlockByNumber', [blockNumber, true]);
    const blocksKeyExists = await checkIfItemExists(redisBlocksKey);
    log('Now processing block: %s', blockNumber);

    if (blocksKeyExists) {
      let blocks: any = await getItem(redisBlocksKey);
      blocks = JSON.parse(blocks);
      blocks = blocks.map((blk: any) => blk.number).includes(block.number) ? [...blocks] : [...blocks, block];
      await cacheItem(redisBlocksKey, JSON.stringify(blocks));

      for (const tx of block.transactions) {
        const addressCode = await request('eth_getCode', [tx.to, 'latest']);
        const isContract = addressCode !== '0x' && addressCode !== '0x0';

        const transactionsKeyExists = await checkIfItemExists(redisTransactionsKey);

        if (transactionsKeyExists) {
          let transactions: any = await getItem(redisTransactionsKey);
          transactions = JSON.parse(transactions);
          transactions = transactions.map((txn: any) => txn.hash).includes(tx.hash)
            ? [...transactions]
            : [...transactions, tx];

          await cacheItem(redisTransactionsKey, JSON.stringify(transactions));
        } else {
          await cacheItem(redisTransactionsKey, JSON.stringify([tx]));
        }

        if (isContract) {
          const abiInterface = new Interface(erc20Abi);
          const data = abiInterface.getSighash('decimals()');
          const callValue = await request('eth_call', [{ to: tx.to, data }, 'latest']);
          const isERC20 = callValue !== '0x' && callValue !== '0x0';

          if (isERC20) {
            const nameHash = abiInterface.getSighash('name()');
            const symbolHash = abiInterface.getSighash('symbol()');
            const totalSupplyHash = abiInterface.getSighash('totalSupply()');
            let name = await request('eth_call', [{ to: tx.to, data: nameHash }, 'latest']);
            [name] = abiInterface.decodeFunctionResult('name()', name);
            let symbol = await request('eth_call', [{ to: tx.to, data: symbolHash }, 'latest']);
            [symbol] = abiInterface.decodeFunctionResult('symbol()', symbol);
            let totalSupply = await request('eth_call', [{ to: tx.to, data: totalSupplyHash }, 'latest']);
            totalSupply = formatUnits(totalSupply, callValue);
            const logs = await request('eth_getLogs', [
              { fromBlock: blockNumber, toBlock: blockNumber, address: tx.to }
            ]);

            for (const l of logs) {
              const parsedLog = abiInterface.parseLog(l);

              if (parsedLog.name === 'Transfer') {
                const from = parsedLog.args[0];
                const to = parsedLog.args[1];
                const balanceOfFromHash = abiInterface.encodeFunctionData('balanceOf(address)', [from]);
                const balanceOfToHash = abiInterface.encodeFunctionData('balanceOf(address)', [to]);
                const balanceOfFrom = await request('eth_call', [{ to: tx.to, data: balanceOfFromHash }, 'latest']);
                const balanceOfTo = await request('eth_call', [{ to: tx.to, data: balanceOfToHash }, 'latest']);

                await hCacheItem(
                  redisTokensBalanceRecordKey.concat(tx.to),
                  from,
                  formatUnits(balanceOfFrom, callValue)
                );
                await hCacheItem(redisTokensBalanceRecordKey.concat(tx.to), to, formatUnits(balanceOfTo, callValue));

                const holdersC = await hGetItems(redisTokensBalanceRecordKey.concat(tx.to));
                const holdersCFilter = Object.values(holdersC)
                  .map(s => parseFloat(s))
                  .filter(val => val > 0);

                await cacheItem(
                  redisTokensKey.concat(':', tx.to),
                  JSON.stringify({
                    name,
                    totalSupply,
                    symbol,
                    holdersCount: holdersCFilter.length,
                    address: tx.to
                  })
                );

                log('Log processed for contract: %s', tx.to);
              }
            }
          }
        }
      }
    } else {
      await cacheItem(redisBlocksKey, JSON.stringify([block]));
    }

    await cacheItem(redisLastProcessedBlockKey, blockNumber);
  } catch (error: any) {
    log(error.message);
  }
}

export async function processPreviousBlocks() {
  try {
    let lastBlockNumber = await request('eth_blockNumber', []);
    lastBlockNumber = parseInt(lastBlockNumber);

    let lastProcessedBlock: any = 0;
    const lastProcessedBlockKeyExists = await checkIfItemExists(redisLastProcessedBlockKey);

    if (lastProcessedBlockKeyExists) {
      lastProcessedBlock = await getItem(redisLastProcessedBlockKey);
      lastProcessedBlock = parseInt(lastProcessedBlock);
    }

    for (let i = lastProcessedBlock; i <= lastBlockNumber; i++) await processBlock(hexValue(i));
  } catch (error: any) {
    log(error.message);
  }
}

export function watchBlockChanges() {
  provider
    .on('block', async (blockNumber: number) => {
      await processBlock(hexValue(blockNumber));
    })
    .on('error', log);
}

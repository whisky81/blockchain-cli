import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { mdns } from "@libp2p/mdns";
import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import { createLibp2p, type Libp2p } from "libp2p";

import Blockchain from "./Blockchain.js";
import { pipe } from "it-pipe";
import all from "it-all";
import { fromString, toString } from "uint8arrays";
import Block from "./Block.js";
import type { PeerId } from '@libp2p/interface';
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { updatePeerEventsLog, updateProtocolsLog } from "./utils.js";
import fs from 'node:fs/promises';

export const BLOCKCHAIN_LATEST_BLOCK_PROTOCOL = '/blockchain/latest-block/1.0.0'
export const BLOCKCHAIN_ENTIRE_CHAIN_PROTOCOL = '/blockchain/entire-chain/1.0.0';

export type ConnectEvent = {
    type: 'connect',
    id: string,
}

export type DisconnectEvent = {
    type: 'disconnect',
    id: string,
}

export type DiscoveryEvent = {
    type: 'discovery',
    id: string,
    addresses: string[]
}

export type SelfUpdateEvent = {
    type: 'self-update',
    id: string,
    addresses: string[],
    protocols: string[]
}

export type EntireChainProtocol = {
    type: 'entire-chain',
    blocks: Block[],
    from: string
}

export type LatestBlockProtocol = {
    type: 'latest-block',
    block: Block,
    from: string
}

class Node {
    node: Libp2p | null;
    blockchain: Blockchain;
    peerEventsLogFilePath = '';
    protocolsLogFilePath = '';

    constructor(blockchain: Blockchain) {
        this.node = null;
        this.blockchain = blockchain;
    }

    async start() {
        try {
            this.node = await createLibp2p({
                addresses: {
                    listen: ['/ip4/0.0.0.0/tcp/0', '/ip4/0.0.0.0/tcp/0/ws']
                },
                transports: [tcp(), webSockets()],
                streamMuxers: [yamux()],
                connectionEncrypters: [noise()],
                peerDiscovery: [mdns({ interval: 2000 })]
            });

            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const peerId = this.node.peerId.toString();

            this.peerEventsLogFilePath = join(__dirname, '..', 'logs', `${peerId}-pes.log`);
            this.protocolsLogFilePath = join(__dirname, '..', 'logs', `${peerId}-ps.log`);

            await fs.writeFile(this.peerEventsLogFilePath, '', 'utf-8');
            await fs.writeFile(this.protocolsLogFilePath, '', 'utf-8');

            await this.node.start();
            this.setUpProtocols();
            this.setUpEventListener();


        } catch (e: any) {
            throw e;
        }
    }

    async stop() {
        try {
            if (this.node == null) {
                throw new Error('Tried to stop node before it was started');
            }
            await this.node.stop();
            await fs.unlink(this.peerEventsLogFilePath);
            await fs.unlink(this.protocolsLogFilePath);
        } catch (e: any) {
            throw e;
        }
    }

    setUpProtocols() {
        if (this.node == null) {
            throw new Error("Not started");
        }
        this.node.handle(BLOCKCHAIN_ENTIRE_CHAIN_PROTOCOL, async ({ stream, connection }) => {
            try {
                const data = await pipe(stream, all) as (Uint8Array[]);
                const handledData = data.map(buf => toString(buf.subarray()));

                const longerChain = handledData.map(data => Block.fromJSON(data));

                const temp: EntireChainProtocol = {
                    type: 'entire-chain',
                    blocks: longerChain,
                    from: connection.remotePeer.toString()
                }
                await updateProtocolsLog(this.protocolsLogFilePath, Date.now(), 'entire-chain', temp);

                this.blockchain.replaceChain(longerChain);

                await this.broadcastLatestBlock();
            } catch (e: any) {
                const msg = e.message || `An error occurred in ${BLOCKCHAIN_ENTIRE_CHAIN_PROTOCOL}`;
                if (msg !== 'Invalid Chain') {
                    console.log(msg);
                }
            }
        });


        this.node.handle(BLOCKCHAIN_LATEST_BLOCK_PROTOCOL, async ({ stream, connection }) => {
            try {
                // handle raw data
                const data = await pipe(stream, all) as (Uint8Array[]);
                const handledData = data.map(buf => toString(buf.subarray())).join("");

                // handle received block
                const receivedBlock = Block.fromJSON(handledData);
                const latestBlock = this.blockchain.latestBlock;

                const temp: LatestBlockProtocol = {
                    type: 'latest-block',
                    block: receivedBlock,
                    from: connection.remotePeer.toString()
                }

                await updateProtocolsLog(this.protocolsLogFilePath, Date.now(), 'latest-block', temp);

                if (latestBlock.hash === receivedBlock.previousHash) {
                    this.blockchain.addBlock(receivedBlock);
                } else if (latestBlock.index > receivedBlock.index) {
                    this.sendEntireChain(connection.remotePeer);
                }

            } catch (e: any) {
                console.error(e.message || `An error occurred in ${BLOCKCHAIN_LATEST_BLOCK_PROTOCOL}`);
            }
        });


    }

    setUpEventListener() {
        if (this.node === null) {
            throw new Error("Not started");
        }

        this.node.addEventListener('peer:discovery', async (conn) => {
            try {
                const peer = conn.detail.id;
                const multiaddrs = conn.detail.multiaddrs;

                const data: DiscoveryEvent = {
                    type: 'discovery',
                    id: peer.toString(),
                    addresses: multiaddrs.map((ma) => ma.toString())
                };

                this.node?.peerStore.patch(peer, {
                    multiaddrs: multiaddrs
                });
                await this.sendLatestBlock(conn.detail.id);

                await updatePeerEventsLog(this.peerEventsLogFilePath, Date.now(), 'discovery', data);

            } catch (e) {
                throw e;
            }
        });

        this.node.addEventListener('peer:connect', async (conn) => {
            const peer = conn.detail;
            const data: ConnectEvent = {
                id: peer.toString(),
                type: 'connect'
            };
            await updatePeerEventsLog(this.peerEventsLogFilePath, Date.now(), 'connect', data);
        });

        this.node.addEventListener('peer:disconnect', async (conn) => {
            const peer = conn.detail;
            const data: DisconnectEvent = {
                id: peer.toString(),
                type: 'disconnect'
            };

            await updatePeerEventsLog(this.peerEventsLogFilePath, Date.now(), 'disconnect', data);
        });

        this.node.addEventListener('self:peer:update', async (event) => {
            if (!this.node || this.node.status === 'stopping' || this.node.status === 'stopped') {
                return;
            }

            const peer = event.detail.peer;

            const data: SelfUpdateEvent = {
                type: 'self-update',
                id: peer.id.toString(),
                addresses: peer.addresses.map((addr) => addr.multiaddr.toString()),
                protocols: peer.protocols
            };

            await updatePeerEventsLog(this.peerEventsLogFilePath, Date.now(), 'self-update', data);
            await this.broadcastLatestBlock();
        });

    }

    async mine(data: string) {
        try {
            if (this.node == null) {
                throw new Error('Not started');
            }
            this.blockchain.mine(data);
            await this.broadcastLatestBlock();

            return this.blockchain.latestBlock;
        } catch (e: any) {
            throw e;
        }
    }

    async broadcastLatestBlock() {
        try {
            if (this.node == null) {
                throw new Error("Error: Not started");
            }
            for (const peer of await this.node.peerStore.all()) {
                await this.sendLatestBlock(peer.id);
            }
        } catch (e: any) {
            console.error(e.message || "BROADCAST ERROR");
        }
    }

    async sendEntireChain(id: PeerId) {
        try {
            if (this.node == null) {
                throw new Error("Error: Not started");
            }

            const stream = await this.node.dialProtocol(id, BLOCKCHAIN_ENTIRE_CHAIN_PROTOCOL);
            await pipe(
                this.blockchain.get().map(block => fromString(JSON.stringify(block))),
                stream
            );
        } catch (e) {
            throw e;
        }
    }

    async sendLatestBlock(id: PeerId) {
        try {
            if (this.node == null) {
                throw new Error("Error: Not started");
            }

            const stream = await this.node.dialProtocol(id, BLOCKCHAIN_LATEST_BLOCK_PROTOCOL);
            await pipe(
                [fromString(JSON.stringify(this.blockchain.latestBlock))],
                stream
            );
        } catch (e) {
            throw e;
        }
    }

}

export default Node;
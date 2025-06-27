import chalk from "chalk";
import Node from "./Node.js";
import Block from "./Block.js";
import { eventLogEntries, protocolLogEntries } from "./utils.js";

export const blockRegex = /^.block.(index|hash).([a-z0-9]+)$/i;
export const chainRegex = /^.chain(.length|.latest-block)?$/i;
export const mineRegex = /^.mine\(([\w\s\P{Script_Extensions=Latin}]+)\)$/u;
export const logRegex = /^.log.(event|protocol).(list|discovery|connect|disconnect|self-update|latest-block|entire-chain)$/i;

export function helpPrompt() {
    const commands = [
        ['.q', 'Quit'],
        ['.profile', ''],
        ['.start', 'Start the node'],
        ['.help', 'Show documentation'],
        ['.mine(<data: string>)', `⛏ Mine a block with 'data', ${chalk.cyanBright('eg. .mine(hi there)')}`],
        ['.chain', 'See the current state of the blockchain'],
        ['.chain.length', 'Get the length of the chain'],
        ['.chain.latest-block', 'Get the latest block'],
        ['.block.index.<index: number>', `Get a block by index, ${chalk.cyanBright('eg. .block.index.0 (genesis index)')}`],
        ['.block.hash.<hash: string>', `Get a block by hash, ${chalk.cyanBright('eg. .block.hash.000f84e45967b2714a025ff83c04ec655ed68719b641aa08842c426bc113c4f6 (genesis hash)')}`],
        ['.peers', 'Get the list of connected peers.'],
        ['.log.event.<(list|discovery|connect|disconnect|self-update)>', ''],
        ['.log.protocol.<(list|latest-block|entire-chain)>', '']
    ];

    const padding = Math.max(...commands.map(([cmd]) => cmd.length)) + 4;

    console.log('\nAvailable Commands:\n');
    for (const [cmd, desc] of commands) {
        const line = ' '.repeat(4) + cmd.padEnd(padding) + desc;
        console.log(line + '\n');
    }
}

export async function peersPrompt(node: Node) {
    try {
        if (node.node == null) {
            throw new Error('Not Started');
        }

        const mypeer = node.node;
        const cpeers = await mypeer.peerStore.all();
        console.log('🟢 Connected peers: ', cpeers.length);

        for (const peer of cpeers) {
            console.log('🌐 Peer ID: ', peer.id.toString());
        }

    } catch(e: any) {
        console.log(e.message || 'Unknow Error');
    }
}

export async function startPrompt(node: Node) {
    try {
        await node.start();
        await profilePrompt(node);
    } catch (e: any) {
        console.log(chalk.red(e.message || 'Unknow Error'));
    }
}

export async function minePrompt(node: Node, prompt: string) {
    try {
        const found = prompt.match(mineRegex);
        if (!found) {
            throw new Error('Invalid Prompt');
        }

        const data = found[1];
        const latestBlock = await node.mine(data);

        console.table(prettyBlock(latestBlock));
    } catch (e: any) {
        console.log(chalk.red(e.message || 'Unknow Error'));
    }
}

export async function blockPrompt(node: Node, prompt: string) {
    try {
        const found = prompt.match(blockRegex);
        if (!found) {
            throw new Error('Invalid Prompt');
        }
        const k = found[1];
        const v = found[2];

        if (k === 'index') {
            const i = parseInt(v);
            if (Number.isNaN(i)) {
                throw new Error('Invalid index');
            }

            getBlockByIndex(node.blockchain.get(), i);
        } else {
            getBlockByHash(node.blockchain.get(), v);
        }

    } catch (e: any) {
        console.log(chalk.red(e.message || 'Unknow Error'));
    }
}

export async function chainPrompt(node: Node, prompt: string) {
    try {
        const found = prompt.match(chainRegex);
        if (!found) {
            console.log('call');
            throw new Error('Invalid Prompt');
        }

        const property = found[1];
        if (property === '.length') {
            console.log('📏 ', node.blockchain.get().length);
        } else if (property === '.latest-block') {
            console.table(prettyBlock(node.blockchain.latestBlock));
        } else {
            console.table(node.blockchain.get().map(block => prettyBlock(block)));
        }
    } catch (e: any) {
        console.log(e.message || 'Unknow Error');
    }

}

export async function logPrompt(node: Node, prompt: string) {
     try {
        const p2p = node.node;
        if (!p2p || p2p.status === 'stopped' || p2p.status === 'stopping') {
            throw new Error('Not Started');
        }

        const found = prompt.match(logRegex);
        if (!found) {
            throw new Error('Invalid Prompt');
        }
        const eOrP = found[1];
        const type = found[2];

        if (eOrP === 'event') {
            if (type === 'list') {
                console.log('discovery|connect|disconnect|self-update');
                return;
            }
            await eventLogEntries(node.peerEventsLogFilePath, type);
        } else if (eOrP === 'protocol') {
            if (type === 'list') {
                const protocols = p2p.getProtocols();
                console.log(chalk.green('Use the string on the right to view protocol logs.'));
                console.log(chalk.green("e.g. .log.protocol.latest-block"));
                console.log();

                for (const protocol of protocols) {
                    console.log(protocol, ' --> ', protocol.split('/')[2]);
                }
                return;
            }
            await protocolLogEntries(node.protocolsLogFilePath, type);
        } else {
            throw new Error('Invalid Prompt');
        }

        
    } catch (e: any) {
        console.log(chalk.red(e.message || 'Unknow Error'));
    }
}

export async function profilePrompt(node: Node) {
    try {
        const p2p = node.node;
        if (!p2p || p2p.status === 'stopped' || p2p.status === 'stopping') {
            throw new Error('Not started');
        }
        console.log('🌀 ' + p2p.peerId.toString());
        p2p.getMultiaddrs().map((ma) => {
            console.log('🌐 ' + ma.toString());
        });
    } catch(e: any) {
        console.log(chalk.red(e.message || 'Unknow Error'));
    }
}

function getBlockByIndex(blocks: Block[], index: number) {
    const block = blocks.find((b) => b.index === index);
    if (block) {
        console.table(block);
    } else {
        throw new Error("Not Found");
    }
}

function getBlockByHash(blocks: Block[], hash: string) {
    const block = blocks.find((b) => b.hash === hash);
    if (block) {
        console.table(block);
    } else {
        throw new Error("Not Found");
    }
}

function prettyBlock(block: Block) {
    return {
        Index: block.index,
        'Previous Hash': block.previousHash,
        Timestamp: (new Date(block.timestamp)).toString(),
        Data: block.data,
        Nonce: block.nonce,
        Hash: block.hash
    };
}
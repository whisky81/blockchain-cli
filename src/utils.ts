import fs from 'node:fs/promises';
import type { ConnectEvent, DisconnectEvent, DiscoveryEvent, SelfUpdateEvent, EntireChainProtocol, LatestBlockProtocol } from './Node.js';
import chalk from 'chalk';
import Block from './Block.js';

type EventType = "discovery" | "connect" | "disconnect" | "self-update";
type EventDataType = ConnectEvent | DisconnectEvent | DiscoveryEvent | SelfUpdateEvent;

export interface Event {
    timestamp: number,
    event: EventType,
    data: EventDataType
}

type ProtocolType = 'latest-block' | 'entire-chain';
type ProtocolDataType = EntireChainProtocol | LatestBlockProtocol;

export interface Protocol {
    timestamp: number,
    protocol: ProtocolType,
    data: ProtocolDataType
}

export async function updatePeerEventsLog(filePath: string, timestamp: number, event: string, data: EventDataType) {
    try {
        const logentry: Event = {
            timestamp,
            event: (event as EventType),
            data
        };

        await fs.appendFile(filePath, JSON.stringify(logentry) + '\n', 'utf-8');
    } catch (e: any) {
        console.log(e.message || 'Unknow Error');
    }
}

export async function updateProtocolsLog(filePath: string, timestamp: number, protocol: string, data: ProtocolDataType) {
    try {
        const logentry: Protocol = {
            timestamp,
            protocol: (protocol as ProtocolType),
            data
        };
        await fs.appendFile(filePath, JSON.stringify(logentry) + '\n', 'utf-8');
    } catch (e: any) {
        console.log(e.message || 'Unknow Error');
    }
}

export async function eventLogEntries(filePath: string, eventType: string) {
    switch (eventType) {
        case 'discovery':
            await discoveryEvt(filePath);
            break;
        case 'connect':
            await connectAndDisconnectEvt(filePath);
            break;
        case 'disconnect':
            await connectAndDisconnectEvt(filePath, false);
            break;
        case 'self-update':
            await selfUpdateEvt(filePath);
            break;
        default:
            throw new Error('Invalid Prompt');
    }
}

export async function protocolLogEntries(filePath: string, protocolType: string) {
    if (protocolType === 'latest-block') {
        await latestBlockProtocol(filePath);
    } else if (protocolType === 'entire-chain') {
        await entireChainProtocol(filePath);
    } else {
        throw new Error('Invalid prompt');
    }
}

async function readFile(filePath: string) {
    const data = await fs.readFile(filePath, 'utf-8');
    return data.split('\n');
}

async function readProtocolFile(filePath: string, protocolType: string) {
    const logs = await readFile(filePath);
    const validLogs: Protocol[] = [];

    for (const log of logs) {
        if (!log) {
            continue;
        }
        const formattedLog = JSON.parse(log) as Protocol;
        if (formattedLog.protocol === protocolType) {
            validLogs.push(formattedLog);
        }
    }
    return validLogs;
}

async function latestBlockProtocol(filePath: string) {
    const logs = await readProtocolFile(filePath, 'latest-block');
    for (const log of logs) {
        const time = (new Date(log.timestamp)).toDateString();
        console.log(`${chalk.red('[' + time + ']')} From ${log.data.from}`);
        const block = (log.data as LatestBlockProtocol).block;
        helper(time.length, block);
    }
}

async function entireChainProtocol(filePath: string) {
    const logs = await readProtocolFile(filePath, 'entire-chain');
    for (const log of logs) {
        const time = (new Date(log.timestamp)).toDateString();
        console.log(`${chalk.red('[' + time + ']')} From ${log.data.from}`);
        const blocks = (log.data as EntireChainProtocol).blocks;
        for (const block of blocks) {
            helper(time.length, block);
        }
    }
}

function helper(ident: number, block: Block) {
    console.log('.'.repeat(ident) + ' Index: ' + chalk.cyanBright(block.index));
    console.log('.'.repeat(ident) + ' Hash: ' + chalk.cyanBright(block.hash));
}

async function readEventFile(filePath: string, eventType: string): Promise<Event[]> {
    const events = await readFile(filePath);
    const validEvents: Event[] = [];

    for (const event of events) {
        if (!event) {
            continue;
        }
        const formattedEvent = JSON.parse(event) as Event;
        if (formattedEvent.event !== (eventType as EventType)) {
            continue;
        }
        validEvents.push(formattedEvent);

    }
    return validEvents;
}

async function discoveryEvt(filePath: string) {
    const events = await readEventFile(
        filePath,
        'discovery'
    );
    for (const event of events) {
        const time = (new Date(event.timestamp)).toDateString();

        console.log(`${chalk.red('[' + time + ']')} ${chalk.green(event.data.id)}`);
        (event.data as DiscoveryEvent).addresses.map((addr) => {
            console.log(`${'.'.repeat(time.length)} ${chalk.green(addr)}`);
        });
    }
}

async function connectAndDisconnectEvt(filePath: string, isConnectEvt = true) {
    const events = await readFile(filePath);

    for (const event of events) {
        if (!event) {
            continue;
        }

        const formattedEvent = JSON.parse(event) as Event;
        if (formattedEvent.event !== 'connect' && formattedEvent.event !== 'disconnect') {
            continue;
        }
        const time = (new Date(formattedEvent.timestamp)).toDateString();
        if (isConnectEvt && formattedEvent.event === 'connect') {
            console.log(`${chalk.red('[' + time + ']')} 🔗${chalk.green(formattedEvent.data.id)}`);
        } else {
            console.log(`${chalk.red('[' + time + ']')} 🔗💥${chalk.green(formattedEvent.data.id)}`);
        }
    }
}

async function selfUpdateEvt(filePath: string) {
    const events = await readEventFile(filePath, 'self-update');

    for (const event of events) {
        if (event.data.type !== 'self-update') continue;
        const time = (new Date(event.timestamp)).toDateString();

        console.log(`${chalk.red('[' + time + ']')} ${chalk.green(event.data.id)}`);
        event.data.addresses.map((addr) => {
            console.log(`${'.'.repeat(time.length)} ${chalk.green(addr)}`);
        });
        event.data.protocols.map((protocol) => {
            console.log(`${'.'.repeat(time.length)} ${chalk.green(protocol)}`);
        });
    }

}
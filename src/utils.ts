import fs from 'node:fs/promises';
import type { ConnectEvent, DisconnectEvent, DiscoveryEvent, SelfUpdateEvent, EntireChainProtocol, LatestChainProtocol } from './Node.js';
import chalk from 'chalk';

type EventType = "discovery" | "connect" | "disconnect" | "self-update";
type EventDataType = ConnectEvent | DisconnectEvent | DiscoveryEvent | SelfUpdateEvent;

export interface Event {
    timestamp: number,
    event: EventType,
    data: EventDataType
}

type ProtocolType = 'latest-chain' | 'entire-chain';
type ProtocolDataType = EntireChainProtocol | LatestChainProtocol;

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
    try {
        if (protocolType !== "latest-chain" && protocolType !== 'entire-chain') {
            throw new Error('Invalid prompt');
        }

    } catch (e) {
        throw e;
    }
}

async function readFile(filePath: string) {
    const data = await fs.readFile(filePath, 'utf-8');
    return data.split('\n');
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

    for(const event of events) {
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
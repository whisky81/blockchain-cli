#!/usr/bin/env node
 
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import Blockchain from './Blockchain.js';
import Node from './Node.js';
import * as handler from './handlePrompt.js';

const blockchain = new Blockchain();
const node = new Node(blockchain);

const rl = readline.createInterface({ input, output, prompt: chalk.green('bc> ') });
rl.on('close', async () => {
    try {
        console.log('🚪 Closing...');
        await node.stop();
    } catch (e: any) {
        console.log(chalk.red(e.message || 'Unknow Error'));
    }
});

console.log(chalk.bold.bgBlue.white(' Blockchain CLI '));
console.log(chalk.blue('Version: ') + chalk.green('1.0.0'));
console.log(chalk.yellowBright("› Type ") + chalk.cyan('.start') + chalk.yellowBright(" to begin."));
console.log(chalk.yellowBright("› Type ") + chalk.cyan('.help') + chalk.yellowBright(" to view available commands."));

rl.prompt();

for await (const line of rl) {
    // received line
    const rline = line.toLowerCase().trim();

    switch (true) {
        case rline === '.q':
            break;
        case rline === '.start':
            await handler.startPrompt(node);
            break;
        case rline === '.profile':
            await handler.profilePrompt(node);
            break;
        case rline === '.help':
            handler.helpPrompt();
            break;
        case rline === '.peers':
            await handler.peersPrompt(node);
            break;
        case handler.mineRegex.test(rline):
            await handler.minePrompt(node, rline);
            break;
        case handler.chainRegex.test(rline):
            await handler.chainPrompt(node, rline);
            break;
        case handler.blockRegex.test(rline):
            await handler.blockPrompt(node, rline);
            break;
        case handler.logRegex.test(rline):
            await handler.logPrompt(node, rline);
            break;
        default:
            if (rline !== '') {
                console.log(chalk.red('Unknow prompt'));
            }
    }

    if (rline === '.q') {
        break;
    }
    rl.prompt();
}
rl.close();


import crypto from 'crypto';
import Block from "./Block.js";

export enum BlockchainError {
    GenerateError =  "Can't generate next block",
    InvalidBlock = "Invalid Block",
    InvalidChain = "Invalid Chain"
}

class Blockchain {
    difficulty = 4;
    blockchain: Array<Block>;

    constructor() {
        this.blockchain = [Block.genesis];
    }

    get() {
        return this.blockchain;
    }

    get latestBlock(): Block {
        return this.blockchain[this.blockchain.length - 1];
    }

    isValidHashDifficulty(hash: string): boolean {
        let i = 0;
        for (; i < hash.length; i++) {
            if (hash[i] !== '0') {
                break;
            }
        }
        return i >= this.difficulty;
    }

    calculateHash(index: number, previousHash: string, timestamp: number, data: string, nonce: number): string {
        return crypto.createHash('sha256')
                .update(index + previousHash + timestamp + data + nonce)
                .digest('hex');
    }

    generateNextBlock(data: string): Block {
        const nextIndex = this.latestBlock.index + 1;
        const previousHash = this.latestBlock.hash;
        let timestamp: number = 0;
        let nonce: number = 0;
        let nextHash: string = '';

        for (; nonce < Number.MAX_SAFE_INTEGER; nonce++) {
            timestamp = Date.now();
            nextHash = this.calculateHash(nextIndex, previousHash, timestamp, data, nonce);
            if (this.isValidHashDifficulty(nextHash)) {
                break;
            }
        }
        if (!this.isValidHashDifficulty(nextHash)) {
            throw new Error(BlockchainError.GenerateError);
        }

        const nextBlock = new Block(nextIndex, previousHash, timestamp, data, nonce, nextHash);
        return nextBlock;
    }

    isValidNextBlock(nextBlock: Block, previousBlock: Block): boolean {
        const nextBlockHash = this.calculateHash(
                                nextBlock.index, 
                                nextBlock.previousHash, 
                                nextBlock.timestamp, 
                                nextBlock.data, 
                                nextBlock.nonce
                            );

        return (
            previousBlock.index + 1 === nextBlock.index ||
            previousBlock.hash === nextBlock.previousHash ||
            this.isValidHashDifficulty(nextBlockHash) ||
            nextBlock.hash === nextBlockHash
        );
    }

    addBlock(nextBlock: Block) {
        if (this.isValidNextBlock(nextBlock, this.latestBlock)) {
            this.blockchain.push(nextBlock);
        } else {
            throw new Error(BlockchainError.InvalidBlock);
        }
    }

    mine(data: string): void {
        try {
            const nextBlock = this.generateNextBlock(data);
            this.addBlock(nextBlock);
        } catch(e) {
            throw e;
        }
    }

    isChainLonger(chain: Block[]) {
        return chain.length > this.blockchain.length;
    }

    isValidChain(chain: Block[]) {
        if (!this.isChainLonger(chain)) {
            return false;
        }
        if (JSON.stringify(chain[0]) !== JSON.stringify(Block.genesis)) {
            return false;
        }

        const tempChain: Block[] = [chain[0]];
        
        for (let i = 1; i < chain.length; i++) {
            if (this.isValidNextBlock(chain[i], tempChain[i - 1])) {
                tempChain.push(chain[i]);
            } else {
                return false;
            }
        }

        return true;
    }

    replaceChain(chain: Block[]) {
        if (this.isValidChain(chain)) {
            this.blockchain = JSON.parse(JSON.stringify(chain));
        } else {
            throw new Error(BlockchainError.InvalidChain);
        }
    }

}

export default Blockchain;
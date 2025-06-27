class Block {
    index: number;
    previousHash: string;
    timestamp: number;
    data: string;
    nonce: number;
    hash: string;
    
    constructor(
        index: number,
        previousHash: string,
        timestamp: number,
        data: string,
        nonce: number,
        hash: string
    ) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.nonce = nonce;
        this.hash = hash;
    }

    static fromJSON(data: string): Block {
        try {
            const jsonData = JSON.parse(data) as Block;
            return new Block(
                jsonData.index,
                jsonData.previousHash,
                jsonData.timestamp,
                jsonData.data,
                jsonData.nonce,
                jsonData.hash
            );
        } catch(e) {
            throw e;
        }
    }

    static get genesis() {
        return new Block(
            0, '0', 1750742712760, 
            'Genesis Block', 10995, 
            '000f84e45967b2714a025ff83c04ec655ed68719b641aa08842c426bc113c4f6'
        );
    }
}

export default Block;
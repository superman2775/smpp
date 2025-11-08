//i didnt vibecode this, chatgpt vibecoded this - super_man2775
class ChessWidget extends GameBase {
    #board = [];
    #selectedSquare = null;
    #currentPlayer = 'white';
    #isThinking = false;
    #moveCount = 0;
    #squareSize = 37.5; // 300px canvas / 8 squares
    #pieceSymbols = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    #lastClickPos = null;
    //this is the title
    get title() {
        return "Chess";
    }
    //this is the difficulty slider
    get options() {
        return [
            GameOption.slider("difficulty", "Bot Difficulty", 10, 50, 30)
        ];
    }
    //i aint documenting the rest for now cuz i am bored
    async onGameStart() {
        this.#initBoard();
        this.#currentPlayer = 'white';
        this.#selectedSquare = null;
        this.#isThinking = false;
        this.#moveCount = 0;
        this.score = 0;
    }

    #initBoard() {
        this.#board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let i = 0; i < 8; i++) {
            this.#board[0][i] = { type: backRow[i], color: 'black' };
            this.#board[1][i] = { type: 'pawn', color: 'black' };
            this.#board[6][i] = { type: 'pawn', color: 'white' };
            this.#board[7][i] = { type: backRow[i], color: 'white' };
        }
    }

    onGameDraw(ctx, deltaTime) {
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 300, 300);

        // Draw board squares
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const x = col * this.#squareSize;
                const y = row * this.#squareSize;
                const isLight = (row + col) % 2 === 0;
                
                ctx.fillStyle = isLight ? '#f0d9b5' : '#b58863';
                ctx.fillRect(x, y, this.#squareSize, this.#squareSize);

                // Highlight selected square
                if (this.#selectedSquare && 
                    this.#selectedSquare[0] === row && 
                    this.#selectedSquare[1] === col) {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
                    ctx.fillRect(x, y, this.#squareSize, this.#squareSize);
                }

                // Draw piece
                const piece = this.#board[row][col];
                if (piece) {
                    ctx.fillStyle = piece.color === 'white' ? '#ffffff' : '#000000';
                    ctx.font = '28px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        this.#pieceSymbols[piece.color][piece.type],
                        x + this.#squareSize / 2,
                        y + this.#squareSize / 2 + 2
                    );
                }
            }
        }

        // Draw current player indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(
            this.#isThinking ? 'Bot thinking...' : 
            `${this.#currentPlayer === 'white' ? 'Your' : "Bot's"} turn`,
            5, 290
        );

        // Draw move count as score
        ctx.textAlign = 'right';
        ctx.fillText(`Moves: ${this.#moveCount}`, 295, 290);
    }

    async onMouse(e) {
        if (this.#currentPlayer !== 'white' || this.#isThinking) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const col = Math.floor(x / this.#squareSize);
        const row = Math.floor(y / this.#squareSize);

        if (row < 0 || row >= 8 || col < 0 || col >= 8) return;

        this.#handleSquareClick(row, col);
    }

    #handleSquareClick(row, col) {
        if (this.#selectedSquare) {
            const [sRow, sCol] = this.#selectedSquare;
            
            if (this.#isValidMove(sRow, sCol, row, col)) {
                this.#makeMove(sRow, sCol, row, col);
                this.#selectedSquare = null;
                this.#currentPlayer = 'black';
                this.#moveCount++;
                this.score = this.#moveCount;
                
                // Check for game over
                if (this.#isGameOver('black')) {
                    setTimeout(() => this.stopGame(), 500);
                    return;
                }
                
                // Trigger bot move
                setTimeout(() => this.#botMove(), 800);
            } else if (this.#board[row][col] && this.#board[row][col].color === 'white') {
                this.#selectedSquare = [row, col];
            } else {
                this.#selectedSquare = null;
            }
        } else if (this.#board[row][col] && this.#board[row][col].color === 'white') {
            this.#selectedSquare = [row, col];
        }
    }

    #isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.#board[fromRow][fromCol];
        if (!piece || piece.color !== this.#currentPlayer) return false;
        
        const target = this.#board[toRow][toCol];
        if (target && target.color === piece.color) return false;
        
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        
        // Pawn moves
        if (piece.type === 'pawn') {
            const dir = piece.color === 'white' ? -1 : 1;
            if (colDiff === 0 && !target) {
                if (rowDiff === dir) return true;
                if ((fromRow === 6 && piece.color === 'white' || fromRow === 1 && piece.color === 'black') &&
                    rowDiff === dir * 2 && !this.#board[fromRow + dir][fromCol]) return true;
            }
            if (Math.abs(colDiff) === 1 && rowDiff === dir && target) return true;
            return false;
        }
        
        // Rook moves
        if (piece.type === 'rook') {
            if (rowDiff === 0 || colDiff === 0) {
                return this.#isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;
        }
        
        // Knight moves
        if (piece.type === 'knight') {
            return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
                   (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
        }
        
        // Bishop moves
        if (piece.type === 'bishop') {
            if (Math.abs(rowDiff) === Math.abs(colDiff)) {
                return this.#isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;
        }
        
        // Queen moves
        if (piece.type === 'queen') {
            if (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) {
                return this.#isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;
        }
        
        // King moves
        if (piece.type === 'king') {
            return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        }
        
        return false;
    }

    #isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
        const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.#board[currentRow][currentCol]) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }

    #makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.#board[fromRow][fromCol];
        this.#board[toRow][toCol] = piece;
        this.#board[fromRow][fromCol] = null;
        
        // Pawn promotion
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            piece.type = 'queen';
        }
    }

    #getAllValidMoves(color) {
        const moves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.#board[row][col];
                if (piece && piece.color === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            const oldPlayer = this.#currentPlayer;
                            this.#currentPlayer = color;
                            if (this.#isValidMove(row, col, toRow, toCol)) {
                                moves.push({ fromRow: row, fromCol: col, toRow, toCol });
                            }
                            this.#currentPlayer = oldPlayer;
                        }
                    }
                }
            }
        }
        return moves;
    }

    #evaluateMove(fromRow, fromCol, toRow, toCol) {
        const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
        let score = 0;
        
        const target = this.#board[toRow][toCol];
        if (target) {
            score += pieceValues[target.type] * 10;
        }
        
        // Prefer center control
        const centerDist = Math.abs(3.5 - toRow) + Math.abs(3.5 - toCol);
        score += (7 - centerDist) * 0.5;
        
        return score;
    }

    #botMove() {
        if (!this.playing) return;
        
        this.#isThinking = true;
        const validMoves = this.#getAllValidMoves('black');
        
        if (validMoves.length === 0) {
            this.stopGame();
            return;
        }
        
        const difficulty = this.getOpt("difficulty") / 10;
        
        // Simple AI: evaluate moves and pick best (or random for lower difficulty)
        let bestMove = null;
        let bestScore = -Infinity;
        
        const movesToConsider = Math.min(validMoves.length, Math.floor(difficulty * 2));
        
        for (let i = 0; i < movesToConsider; i++) {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            let score = this.#evaluateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            score += (Math.random() - 0.5) * (5 - difficulty);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        if (bestMove) {
            this.#makeMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
            this.#currentPlayer = 'white';
            this.#isThinking = false;
            
            if (this.#isGameOver('white')) {
                setTimeout(() => this.stopGame(), 500);
            }
        }
    }

    #isGameOver(color) {
        const moves = this.#getAllValidMoves(color);
        return moves.length === 0;
    }

    async onKeyDown(e) {
        // ESC to deselect
        if (e.code === 'Escape') {
            this.#selectedSquare = null;
        }
    }

    async onKeyUp(e) {}
}

registerWidget(new ChessWidget());

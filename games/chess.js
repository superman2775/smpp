// "i don't vibecode, chatgpt does" - super_man2775
class ChessWidget extends GameBase {
    #board = [];
    #selectedSquare = null;
    #currentPlayer = 'white';
    #isThinking = false;
    #moveCount = 0;
    #squareSize = 37.5;
    #cornerRadius = 10;

    #pieceSymbols = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    #checked = { white: false, black: false };

    // For opening moves
    #openingBook = [
    // Italian + Queen's Gambit + French lines for variety
    { fromR: 1, fromC: 4, toR: 3, toC: 4 }, // e7-e5
    { fromR: 0, fromC: 1, toR: 2, toC: 2 }, // Nb8-c6
    { fromR: 0, fromC: 6, toR: 2, toC: 5 }, // Ng8-f6
    { fromR: 1, fromC: 3, toR: 3, toC: 3 }, // d7-d5
    { fromR: 1, fromC: 2, toR: 3, toC: 2 }, // c7-c5
    { fromR: 1, fromC: 5, toR: 2, toC: 5 }, // f7-f6
    { fromR: 0, fromC: 2, toR: 3, toC: 5 }, // Bb4
    { fromR: 1, fromC: 6, toR: 3, toC: 6 }  // g7-g5
    ];
    #bookIndex = 0;

    // Transposition table & heuristics
    #tt = new Map();
    #killerMoves = {};
    #history = {};

    defaultSettings() { return { hiScore: 0 }; }
    get title() { return "Chess"; }
    get options() {
        return [GameOption.slider("difficulty", "Bot Difficulty", 100, 1000, 500, 100)];
    }
    #getDifficulty() {
        return Math.max(1, Math.min(10, Math.round(Number(this.getOpt("difficulty")) / 100)));
    }
    #getBotDepth() {
        const diff = this.#getDifficulty();
        if (diff <= 2) return 3;
        if (diff <= 4) return 5;
        if (diff <= 6) return 8;
        if (diff <= 8) return 11;
        return 14;
    }

    async onGameStart() {
        this.#initBoard();
        this.#currentPlayer = 'white';
        this.#selectedSquare = null;
        this.#isThinking = false;
        this.#moveCount = 0;
        this.#bookIndex = 0;
        this.score = 0;
        this.#checked = { white: false, black: false };
        this.#tt.clear();
        this.#killerMoves = {};
        this.#history = {};
    }

    #initBoard() {
        this.#board = Array(8).fill(null).map(() => Array(8).fill(null));
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let i = 0; i < 8; i++) {
            this.#board[0][i] = { type: backRow[i], color: 'black', moved: false };
            this.#board[1][i] = { type: 'pawn', color: 'black', moved: false };
            this.#board[6][i] = { type: 'pawn', color: 'white', moved: false };
            this.#board[7][i] = { type: backRow[i], color: 'white', moved: false };
        }
    }
    #fillRoundRect(ctx, x, y, w, h, r, color) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }
    onGameDraw(ctx, dt) {
        ctx.fillStyle = getThemeVar("--color-base01");
        ctx.fillRect(0, 0, 300, 300);

        for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
            let x = col * this.#squareSize, y = row * this.#squareSize;
            let baseColor = ((row + col) % 2 === 0) ? getThemeVar("--color-base02") : getThemeVar("--color-base03");
            this.#fillRoundRect(ctx, x, y, this.#squareSize, this.#squareSize, this.#cornerRadius, baseColor);

            let piece = this.#board[row][col];

            if (piece && piece.type === "king" && this.#checked[piece.color]) {
                this.#fillRoundRect(ctx, x, y, this.#squareSize, this.#squareSize, this.#cornerRadius, "rgba(255,0,0,0.5)");
            } else if (this.#selectedSquare && this.#selectedSquare[0] === row && this.#selectedSquare[1] === col) {
                this.#fillRoundRect(ctx, x, y, this.#squareSize, this.#squareSize, this.#cornerRadius, "rgba(255,255,0,0.4)");
            }

            if (piece) {
                ctx.fillStyle = piece.color === "white" ? "#fff" : "#000";
                ctx.font = '28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.#pieceSymbols[piece.color][piece.type], x + this.#squareSize / 2, y + this.#squareSize / 2 + 2);
            }
        }
    }
    async onMouse(e) {
        if (this.#currentPlayer !== 'white' || this.#isThinking) return;
        const rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (this.canvas.width !== this.canvas.clientWidth) {
            x *= this.canvas.width / this.canvas.clientWidth;
            y *= this.canvas.height / this.canvas.clientHeight;
        }
        const col = Math.floor(x / this.#squareSize), row = Math.floor(y / this.#squareSize);
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return;
        this.#handleSquareClick(row, col);
    }
    #handleSquareClick(row, col) {
        if (this.#selectedSquare) {
            let [sRow, sCol] = this.#selectedSquare;
            if (this.#isValidMove(sRow, sCol, row, col, this.#board)) {
                this.#makeMove(sRow, sCol, row, col);
                this.#selectedSquare = null;
                this.#moveCount++;
                this.score = this.#moveCount;
                this.#updateCheckStatus();
                this.#currentPlayer = "black";
                setTimeout(() => this.#checkEndOrBot("black"), 400);
            } else if (this.#board[row][col] && this.#board[row][col].color === 'white') {
                this.#selectedSquare = [row, col];
            } else this.#selectedSquare = null;
        } else if (this.#board[row][col] && this.#board[row][col].color === 'white') this.#selectedSquare = [row, col];
    }

    // --- Validation & helpers accept optional board param (defaults to current board) ---
    #isValidMove(fromRow, fromCol, toRow, toCol, board = this.#board) {
        if (![fromRow, fromCol, toRow, toCol].every(x => x >= 0 && x < 8)) return false;
        const piece = board[fromRow][fromCol];
        if (!piece || piece.color !== this.#currentPlayer) return false;
        if (fromRow === toRow && fromCol === toCol) return false;
        const target = board[toRow][toCol];
        if (target && target.color === piece.color) return false;
        if (target && target.type === "king") return false;
        const rowDiff = toRow - fromRow, colDiff = toCol - fromCol;
        if (piece.type === 'pawn') {
            const dir = piece.color === "white" ? -1 : 1;
            if (colDiff === 0 && !target)
                if (rowDiff === dir || (fromRow === 6 && piece.color === "white" && rowDiff === dir * 2 && !board[fromRow+dir][fromCol]))
                    return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
            if (Math.abs(colDiff) === 1 && rowDiff === dir && target)
                return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
            return false;
        }
        const isClear = this.#isPathClear(fromRow, fromCol, toRow, toCol, board);
        if (piece.type === "rook" && (rowDiff === 0 || colDiff === 0) && isClear)
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
        if (piece.type === "knight" && ((Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2)))
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
        if (piece.type === "bishop" && Math.abs(rowDiff) === Math.abs(colDiff) && isClear)
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
        if (piece.type === "queen" &&
            ((rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) && isClear))
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
        if (piece.type === "king" && Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) {
            if (this.#isSquareAttacked(board, toRow, toCol, piece.color === "white" ? "black" : "white"))
                return false;
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color, board);
        }
        return false;
    }

    #isPathClear(fromRow, fromCol, toRow, toCol, board = this.#board) {
        if (
            fromRow < 0 || fromRow > 7 ||
            fromCol < 0 || fromCol > 7 ||
            toRow < 0 || toRow > 7 ||
            toCol < 0 || toCol > 7
        ) return false;
        const rowStep = Math.sign(toRow - fromRow);
        const colStep = Math.sign(toCol - fromCol);
        let r = fromRow + rowStep, c = fromCol + colStep;
        while (r !== toRow || c !== toCol) {
            if (
                r < 0 || r > 7 ||
                c < 0 || c > 7
            ) return false;
            if (board[r][c]) return false;
            r += rowStep; c += colStep;
        }
        return true;
    }

    #wouldLeaveKingInCheck(fromR, fromC, toR, toC, color, board = this.#board) {
        let test = this.#copyBoard(board), piece = test[fromR][fromC];
        test[toR][toC] = piece; test[fromR][fromC] = null;
        if (piece && piece.type === "pawn" && (toR === 0 || toR === 7)) piece.type = "queen";
        return this.#isKingInCheck(test, color);
    }

    #copyBoard(board) {
        return board.map(row => row.map(piece => (piece ? { ...piece } : null)));
    }

    #makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.#board[fromRow][fromCol];
        this.#board[toRow][toCol] = piece;
        this.#board[fromRow][fromCol] = null;
        if (piece.type === "pawn" && (toRow === 0 || toRow === 7)) piece.type = "queen";
    }

    #findKing(board, color) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (board[r][c] && board[r][c].color === color && board[r][c].type === "king") return [r, c];
        return null;
    }

    #isKingInCheck(board, color) {
        const kingPos = this.#findKing(board, color);
        if (!kingPos) return false;
        const [r, c] = kingPos;
        return this.#isSquareAttacked(board, r, c, color === "white" ? "black" : "white");
    }

    #isSquareAttacked(board, row, col, byColor) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === byColor)
                if (this.#canPieceAttack(board, r, c, row, col, piece)) return true;
        }
        return false;
    }

    #canPieceAttack(board, fromRow, fromCol, toRow, toCol, piece = null) {
        if (
            fromRow < 0 || fromRow > 7 ||
            fromCol < 0 || fromCol > 7 ||
            toRow < 0 || toRow > 7 ||
            toCol < 0 || toCol > 7
        ) return false;
        if (!piece) piece = board[fromRow][fromCol];
        if (!piece) return false;
        const rowDiff = toRow - fromRow, colDiff = toCol - fromCol;
        if (piece.type === "pawn") {
            const dir = piece.color === "white" ? -1 : 1;
            return Math.abs(colDiff) === 1 && rowDiff === dir;
        }
        if (piece.type === "rook") return (rowDiff === 0 || colDiff === 0) && this.#isPathClear(fromRow, fromCol, toRow, toCol, board);
        if (piece.type === "knight") return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
        if (piece.type === "bishop") return (Math.abs(rowDiff) === Math.abs(colDiff)) && this.#isPathClear(fromRow, fromCol, toRow, toCol, board);
        if (piece.type === "queen") return (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) && this.#isPathClear(fromRow, fromCol, toRow, toCol, board);
        if (piece.type === "king") return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        return false;
    }

    #updateCheckStatus() {
        this.#checked.white = this.#isKingInCheck(this.#board, "white");
        this.#checked.black = this.#isKingInCheck(this.#board, "black");
    }

    #isHanging(board, r, c) {
        let piece = board[r][c];
        if (!piece) return false;
        let attacked = false, defended = false;
        for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
            if ((rr === r && cc === c) || !board[rr][cc]) continue;
            let attacker = board[rr][cc];
            if (this.#canPieceAttack(board, rr, cc, r, c, attacker)) {
                if (attacker.color !== piece.color) attacked = true;
                else defended = true;
            }
        }
        return (attacked && !defended);
    }

    // Returns valid moves for a color on the provided board (defaults to current board)
    #getAllValidMoves(color, board = this.#board) {
        let moves = [];
        for (let r = 0; r < 8; ++r)
                        for (let c = 0; c < 8; ++c)
                            if (board[r][c] && board[r][c].color === color)
                                for (let toR = 0; toR < 8; ++toR)
                                    for (let toC = 0; toC < 8; ++toC)
                                        if (this.#isValidMove(r, c, toR, toC, board)) {
                                            // Simulate move on a copy to ensure king safety
                                            const testBoard = this.#copyBoard(board);
                                            const p = testBoard[r][c];
                                            testBoard[toR][toC] = p;
                                            testBoard[r][c] = null;
                                            if (p.type === "pawn" && (toR === 0 || toR === 7)) p.type = "queen";
                                            // Find king pos for color
                                            let kingPos = null;
                                            for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++)
                                                if (testBoard[rr][cc] && testBoard[rr][cc].type === "king" && testBoard[rr][cc].color === color)
                                                    kingPos = [rr, cc];
                                            if (kingPos && !this.#isSquareAttacked(testBoard, kingPos[0], kingPos[1], color === "white" ? "black" : "white")) {
                                                moves.push({ fromR: r, fromC: c, toR, toC });
                                            }
                                        }
        return moves;
    }

    // Compact FEN-like key for transposition table (no castling/en-passant counters)
    #boardToKey(board, turn) {
        let rows = [];
        for (let r = 0; r < 8; r++) {
            let row = '';
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p) { empty++; continue; }
                if (empty) { row += empty; empty = 0; }
                let ch = p.type[0];
                if (p.type === 'knight') ch = 'n';
                ch = (p.color === 'white') ? ch.toUpperCase() : ch.toLowerCase();
                row += ch;
            }
            if (empty) row += empty;
            rows.push(row);
        }
        return rows.join('/') + ' ' + (turn === 'white' ? 'w' : 'b');
    }

    #evaluate(board, color) {
    const pieceVals = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };
    let score = 0;
    const my = color, enemy = color === "white" ? "black" : "white";
    const pst = {
        pawn: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ],
        knight: [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-30, 5, 10, 15, 15, 10, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 10, 15, 15, 10, 0, -30],
            [-40, -20, 0, 0, 0, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50]
        ],
        bishop: [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-10, 10, 10, 10, 10, 10, 10, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20]
        ]
    };
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const mod = (p.color === my ? 1 : -1);
        let val = pieceVals[p.type] || 0;
        if (pst[p.type]) {
            const table = p.color === "white" ? pst[p.type][7 - r][c] : pst[p.type][r][c];
            val += table;
        }

        // --- Bonuses for positional play ---
        if (p.type === 'pawn') {
            // Center control
            if ((r === 3 || r === 4) && (c >= 2 && c <= 5)) val += 10;
            // Passed pawn
            let isPassed = true;
            for (let rr = 0; rr < 8; rr++) {
                if (board[rr][c] && board[rr][c].type === 'pawn' && board[rr][c].color !== p.color) {
                    isPassed = false;
                }
            }
            if (isPassed) val += 30;
        }
        if (p.type === 'knight' || p.type === 'bishop') {
            val += 5 * this.#getMobility(r, c, p.type, p.color, board);
        }

        if (pst[p.type]) {
            const table = p.color === "white" ? pst[p.type][7 - r][c] : pst[p.type][r][c];
            val += table;
        }
        if (p.type === "king") {
            const pawnShield = [-1, 0, 1].reduce((acc, dc) => {
                const rr = p.color === "white" ? r + 1 : r - 1, cc = c + dc;
                return acc + ((rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] && board[rr][cc].type === "pawn" && board[rr][cc].color === p.color) ? 1 : 0);
            }, 0);
            val += pawnShield * 50;
        }
        score += val * mod;
    }
    return score;
}

   #quiesce(board, turn, alpha, beta, depth = 0) {
    const stand_pat = this.#evaluate(board, 'black');
    if (depth > 6) return stand_pat;
    if (turn === 'black') {
        if (stand_pat >= beta) return beta;
        if (stand_pat > alpha) alpha = stand_pat;
    } else {
        if (stand_pat <= alpha) return alpha;
        if (stand_pat < beta) beta = stand_pat;
    }
    const moves = this.#getAllValidMoves(turn, board).filter(m => board[m.toR][m.toC]);
    const pieceVals = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };
    moves.sort((a, b) => {
        const va = board[a.toR][a.toC] ? pieceVals[board[a.toR][a.toC].type] : 0;
        const vb = board[b.toR][b.toC] ? pieceVals[board[b.toR][b.toC].type] : 0;
        return vb - va;
    });
    for (const move of moves) {
        const nb = this.#copyBoard(board);
        const p = nb[move.fromR][move.fromC];
        nb[move.toR][move.toC] = p;
        nb[move.fromR][move.fromC] = null;
        const score = -this.#quiesce(nb, turn === 'black' ? 'white' : 'black', -beta, -alpha, depth + 1);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}
    // Build a simple move key string for killer/history indexing
    #moveKey(move) { return `${move.fromR}${move.fromC}-${move.toR}${move.toC}`; }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    #getBotMove() {
    const difficulty = this.#getDifficulty();
    const maxDepth = this.#getBotDepth();
    let rootMoves = this.#getAllValidMoves('black', this.#board);

    // First: RANDOMIZE for unpredictability
    this.shuffle(rootMoves);

    // Then: Sort for MVV-LVA (capture high value pieces first)
    const pieceVals = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
    rootMoves.sort((a, b) => {
        let ta = this.#board[a.toR][a.toC], tb = this.#board[b.toR][b.toC];
        let va = ta ? pieceVals[ta.type] : 0;
        let vb = tb ? pieceVals[tb.type] : 0;
        return vb - va; // most valuable victim first
    });

    if (!rootMoves.length) return null;
    if (difficulty <= 2) return rootMoves[Math.floor(Math.random() * rootMoves.length)];

    // Opening book move logic
    if (this.#bookIndex < this.#openingBook.length) {
        const m = this.#openingBook[this.#bookIndex++];
        if (this.#isValidMove(m.fromR, m.fromC, m.toR, m.toC, this.#board)) return m;
    }

    let best = null;
    let bestScore = -Infinity;
    for (const move of rootMoves) {
        const nb = this.#copyBoard(this.#board);
        const p = nb[move.fromR][move.fromC];
        nb[move.toR][move.toC] = p;
        nb[move.fromR][move.fromC] = null;
        const score = -this.#minimax(nb, 'white', maxDepth - 1, -Infinity, Infinity);
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    return best;
}

    // Root wrapper so we can use iterative deepening and get the principal variation at root
    #minimaxRoot(board, turn, depth, alpha, beta) {
        const moves = this.#getAllValidMoves(turn, board);
        if (!moves.length) return { score: this.#evaluate(board, 'black'), move: null };

        // order moves by heuristics initially (captures, history)
        const pieceVals = { pawn: 100, knight: 325, bishop: 340, rook: 500, queen: 900, king: 100000 };
        moves.sort((a, b) => {
            // MVV-LVA
            const va = board[a.toR][a.toC] ? pieceVals[board[a.toR][a.toC].type] : 0;
            const vb = board[b.toR][b.toC] ? pieceVals[board[b.toR][b.toC].type] : 0;
            if (vb !== va) return vb - va;
            // history heuristic
            const ha = this.#history[this.#moveKey(a)] || 0;
            const hb = this.#history[this.#moveKey(b)] || 0;
            if (hb !== ha) return hb - ha;
            return 0;
        });

        let bestMove = null;
        let bestScore = -Infinity;
        for (const move of moves) {
            const nb = this.#copyBoard(board);
            const p = nb[move.fromR][move.fromC];
            nb[move.toR][move.toC] = p; nb[move.fromR][move.fromC] = null;
            if (p.type === "pawn" && (move.toR === 0 || move.toR === 7)) p.type = "queen";

            const score = -this.#minimax(nb, turn === 'black' ? 'white' : 'black', depth - 1, -beta, -alpha, 1);
            if (score > bestScore) {
                bestScore = score; bestMove = move;
            }
            alpha = Math.max(alpha, score);
            if (alpha >= beta) {
                // update killer/history heuristics
                const key = this.#moveKey(move);
                this.#history[key] = (this.#history[key] || 0) + depth * depth;
                const k = this.#killerMoves[depth] || [];
                // push move into killer list
                if (!k.find(m => this.#moveKey(m) === key)) {
                    k.unshift(move);
                    if (k.length > 2) k.pop();
                    this.#killerMoves[depth] = k;
                }
                break;
            }
        }
        return { score: bestScore, move: bestMove };
    }

    #minimax(board, turn, depth, alpha, beta, ply = 1) {
    const key = this.#boardToKey(board, turn);
    const ttEntry = this.#tt.get(key);
    if (ttEntry && ttEntry.depth >= depth) return ttEntry.score;
    if (depth <= 0) return this.#quiesce(board, turn, alpha, beta);

    let moves = this.#getAllValidMoves(turn, board);

    // RANDOMIZE a bit for unpredictability (optional, helps at lower depths)
    this.shuffle(moves);

    // MVV-LVA: sort to try capturing most valuable pieces first (very important for tactics)
    const pieceVals = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
    moves.sort((a, b) => {
        let ta = board[a.toR][a.toC], tb = board[b.toR][b.toC];
        let va = ta ? pieceVals[ta.type] : 0;
        let vb = tb ? pieceVals[tb.type] : 0;
        return vb - va;
    });

    if (!moves.length) return this.#evaluate(board, 'black');

    let bestScore = -Infinity;
    for (const move of moves) {
        const nb = this.#copyBoard(board);
        const p = nb[move.fromR][move.fromC];
        nb[move.toR][move.toC] = p;
        nb[move.fromR][move.fromC] = null;
        const score = -this.#minimax(nb, turn === 'black' ? 'white' : 'black', depth - 1, -beta, -alpha, ply + 1);
        if (score > bestScore) bestScore = score;
        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
    }
    this.#tt.set(key, { score: bestScore, depth });
    return bestScore;
}

    // quick check if move gives check by applying it (on copy) and testing opponent king
    #givesCheck(board, move, turn) {
        const nb = this.#copyBoard(board);
        const p = nb[move.fromR][move.fromC];
        nb[move.toR][move.toC] = p; nb[move.fromR][move.fromC] = null;
        if (p.type === "pawn" && (move.toR === 0 || move.toR === 7)) p.type = "queen";
        return this.#isKingInCheck(nb, turn === 'white' ? 'black' : 'white');
    }

    #botMove() {
        this.#isThinking = true;
        setTimeout(() => {
            const move = this.#getBotMove();
            if (move) {
                this.#makeMove(move.fromR, move.fromC, move.toR, move.toC);
                this.#updateCheckStatus();
                this.#currentPlayer = "white";
                setTimeout(() => this.#checkEndOrBot("white"), 300);
            }
            this.#isThinking = false;
        }, 100);
    }

    #checkEndOrBot(player) {
        const moves = this.#getAllValidMoves(player || this.#currentPlayer, this.#board);
        const checked = this.#checked[player || this.#currentPlayer];
        if (!moves.length) {
            setTimeout(() => this.stopGame(), 1200);
            return;
        }
        if (player === "black" || (!player && this.#currentPlayer === "black"))
            setTimeout(() => this.#botMove(), 325);
    }

    async onKeyDown(e) { if (e.code === 'Escape') this.#selectedSquare = null; }
    async onKeyUp(e) {}

    #getMobility(r, c, type, color, board) {
    let moves = 0;
    for (let toR = 0; toR < 8; ++toR) for (let toC = 0; toC < 8; ++toC)
        if (this.#isValidMove(r, c, toR, toC, board)) moves++;
    return moves;
}

}

registerWidget(new ChessWidget());
// yippie its the end now i can stop pretending to code and eat a whopper!

class ChessWidget extends GameBase {
    #board = [];
    #selectedSquare = null;
    #currentPlayer = 'white';
    #isThinking = false;
    #moveCount = 0;
    #squareSize = 37.5;
    #pieceSymbols = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    #checked = { white: false, black: false };
    #statusMessage = "";
    #castlingRights = { whiteK: true, whiteQ: true, blackK: true, blackQ: true };
    #enPassant = null;
    #halfmoveClock = 0;

    defaultSettings() {
        return { hiScore: 0 };
    }

    get title() { return "Chess"; }
    get options() {
        return [
            GameOption.slider("difficulty", "Bot Difficulty", 10, 50, 30)
        ];
    }

    // Always returns an integer in [1,10]
    #getDifficulty() {
        return Math.min(10, Math.max(1, Math.round((this.getOpt("difficulty") - 10) / 4) + 1));
    }

    // Always returns integer depth [1,5], scaling with difficulty
    #getBotDepth() {
        let diff = this.#getDifficulty();
        // Difficulty 1: 1, Difficulty 3: 2, Difficulty 5: 3, Difficulty 7: 4, Difficulty 9-10: 5
        return Math.max(1, Math.min(5, Math.round((diff - 1) * 0.5 + 1)));
    }

    #calculateScore(moves) {
        let difficulty = this.#getDifficulty();
        let norm = Math.max(moves, 2);
        let raw = 100 * (difficulty / 10) * (20 / norm);
        return Math.floor(raw);
    }

    createHiScoreString() {
        return this.settings.hiScore > 0
            ? `Score: ${this.settings.hiScore}/100`
            : "No victories yet";
    }

    async onGameStart() {
        this.#initBoard();
        this.#currentPlayer = 'white';
        this.#selectedSquare = null;
        this.#isThinking = false;
        this.#moveCount = 0;
        this.score = 0;
        this.#checked = { white: false, black: false };
        this.#statusMessage = "";
        this.#castlingRights = { whiteK: true, whiteQ: true, blackK: true, blackQ: true };
        this.#enPassant = null;
        this.#halfmoveClock = 0;
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

    onGameDraw(ctx, dt) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 300, 300);
        for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
            let x = col * this.#squareSize, y = row * this.#squareSize;
            let isLight = (row + col) % 2 === 0;
            ctx.fillStyle = isLight ? '#f0d9b5' : '#b58863';
            ctx.fillRect(x, y, this.#squareSize, this.#squareSize);
            let piece = this.#board[row][col];
            if (piece && piece.type === "king" && this.#checked[piece.color])
                ctx.fillStyle = "rgba(255,64,64,0.4)", ctx.fillRect(x, y, this.#squareSize, this.#squareSize);
            if (this.#selectedSquare && this.#selectedSquare[0] === row && this.#selectedSquare[1] === col)
                ctx.fillStyle = "rgba(255,255,0,0.4)", ctx.fillRect(x, y, this.#squareSize, this.#squareSize);
            if (piece) {
                ctx.fillStyle = piece.color == "white" ? "#fff" : "#000";
                ctx.font = '28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.#pieceSymbols[piece.color][piece.type], x + this.#squareSize / 2, y + this.#squareSize / 2 + 2);
            }
        }
        ctx.fillStyle = "#fff"; ctx.font = "12px Arial"; ctx.textAlign = "left";
        ctx.fillText(this.#isThinking ? "Bot thinking..." : this.#statusMessage || (this.#currentPlayer === "white" ? "Your turn" : "Bot's turn"), 5, 290);
        ctx.textAlign = "right"; ctx.fillText(`Moves: ${this.#moveCount}`, 295, 290);
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
            if (this.#isValidMove(sRow, sCol, row, col)) {
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

    #isValidMove(fromRow, fromCol, toRow, toCol) {
        if (![fromRow, fromCol, toRow, toCol].every(x => x >= 0 && x < 8)) return false;
        const piece = this.#board[fromRow][fromCol];
        if (!piece || piece.color !== this.#currentPlayer) return false;
        if (fromRow === toRow && fromCol === toCol) return false;
        const target = this.#board[toRow][toCol];
        if (target && target.color === piece.color) return false;
        const rowDiff = toRow - fromRow, colDiff = toCol - fromCol;
        // Pawn moves
        if (piece.type === 'pawn') {
            const dir = piece.color === "white" ? -1 : 1;
            if (colDiff === 0 && !target)
                if (rowDiff === dir || (fromRow === 6 && piece.color === "white" && rowDiff === dir * 2 && !this.#board[fromRow+dir][fromCol]))
                    return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
            if (Math.abs(colDiff) === 1 && rowDiff === dir && target)
                return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
            return false;
        }
        const isClear = this.#isPathClear(fromRow, fromCol, toRow, toCol);
        if (piece.type === "rook" && (rowDiff === 0 || colDiff === 0) && isClear)
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
        if (piece.type === "knight" && ((Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2)))
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
        if (piece.type === "bishop" && Math.abs(rowDiff) === Math.abs(colDiff) && isClear)
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
        if (piece.type === "queen" &&
            ((rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) && isClear))
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
        if (piece.type === "king" && Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) {
            if (this.#isSquareAttacked(this.#board, toRow, toCol, piece.color === "white" ? "black" : "white"))
                return false;
            return !this.#wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol, piece.color);
        }
        return false;
    }

    #isPathClear(fromRow, fromCol, toRow, toCol) {
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
            if (this.#board[r][c]) return false;
            r += rowStep; c += colStep;
        }
        return true;
    }

    #wouldLeaveKingInCheck(fromR, fromC, toR, toC, color) {
        let board = this.#copyBoard(this.#board), piece = board[fromR][fromC];
        board[toR][toC] = piece; board[fromR][fromC] = null;
        if (piece && piece.type === "pawn" && (toR === 0 || toR === 7)) piece.type = "queen";
        return this.#isKingInCheck(board, color);
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
        if (piece.type === "rook") return (rowDiff === 0 || colDiff === 0) && this.#isPathClear(fromRow, fromCol, toRow, toCol);
        if (piece.type === "knight") return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
        if (piece.type === "bishop") return (Math.abs(rowDiff) === Math.abs(colDiff)) && this.#isPathClear(fromRow, fromCol, toRow, toCol);
        if (piece.type === "queen") return (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) && this.#isPathClear(fromRow, fromCol, toRow, toCol);
        if (piece.type === "king") return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        return false;
    }

    #updateCheckStatus() {
        this.#checked.white = this.#isKingInCheck(this.#board, "white");
        this.#checked.black = this.#isKingInCheck(this.#board, "black");
    }

    #checkEndOrBot(player) {
        const moves = this.#getAllValidMoves(player || this.#currentPlayer);
        const checked = this.#checked[player || this.#currentPlayer];
        if (!moves.length) {
            if (checked) {
                this.#statusMessage = (player === "white")
                    ? "Checkmate! Bot wins!"
                    : "Checkmate! You win!";
                // Only update high score on user win
                if (player === "black") {
                    let score = this.#calculateScore(this.#moveCount);
                    if (score > (this.settings?.hiScore ?? 0)) {
                        this.setSetting('hiScore', score);
                    }
                }
            } else {
                this.#statusMessage = "Stalemate!";
            }
            setTimeout(() => this.stopGame(), 1200);
            return;
        }
        if (player === "black" || (!player && this.#currentPlayer === "black")) setTimeout(() => this.#botMove(), 325);
    }

    #getAllValidMoves(color) {
        let moves = [];
        for (let r = 0; r < 8; ++r)
            for (let c = 0; c < 8; ++c)
                if (this.#board[r][c] && this.#board[r][c].color === color)
                    for (let toR = 0; toR < 8; ++toR)
                        for (let toC = 0; toC < 8; ++toC)
                            if (this.#isValidMove(r, c, toR, toC)) moves.push({ fromR: r, fromC: c, toR, toC });
        return moves;
    }

    // Aggressive evaluation, as before
    #evaluate(board, color) {
        let score = 0, pieceVals = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 0 };
        let myColor = color, enemyColor = color === "white" ? "black" : "white";
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            let p = board[r][c]; if (!p) continue;
            let val = pieceVals[p.type], mod = (p.color === myColor ? 1 : -1);
            score += val * mod;

            // Attack incentive: reward direct attacks on enemy pieces
            if (p.color === myColor) {
                for (let toR = 0; toR < 8; ++toR) for (let toC = 0; toC < 8; ++toC) {
                    if (board[toR][toC] && board[toR][toC].color === enemyColor && this.#canPieceAttack(board, r, c, toR, toC, p)) {
                        score += 30 * mod;
                    }
                }
            }
        }
        // Bonus for check on enemy king
        let enemyKing = this.#findKing(board, enemyColor);
        if (enemyKing && this.#isSquareAttacked(board, enemyKing[0], enemyKing[1], myColor)) score += 50;

        // Mobility incentive
        let myMoves = 0, enemyMoves = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            if (board[r][c] && board[r][c].color === myColor)
                for (let toR = 0; toR < 8; toR++) for (let toC = 0; toC < 8; toC++)
                    if (this.#canPieceAttack(board, r, c, toR, toC)) myMoves++;
            if (board[r][c] && board[r][c].color === enemyColor)
                for (let toR = 0; toR < 8; toR++) for (let toC = 0; toC < 8; toC++)
                    if (this.#canPieceAttack(board, r, c, toR, toC)) enemyMoves++;
        }
        score += 3 * (myMoves - enemyMoves);

        // Mate incentives
        let whiteMoves = this.#getAllValidMoves("white");
        let blackMoves = this.#getAllValidMoves("black");
        if (!blackMoves.length && this.#isKingInCheck(board, "black")) score += 100000;
        if (!whiteMoves.length && this.#isKingInCheck(board, "white")) score -= 100000;

        return score;
    }

    #getBotMove() {
        const depth = this.#getBotDepth();
        const move = this.#minimax(this.#copyBoard(this.#board), 'black', depth, -Infinity, Infinity).move;
        return move;
    }

    #minimax(board, turn, depth, alpha, beta) {
        if (depth === 0) return { score: this.#evaluate(board, 'black') };
        let moves = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (board[r][c] && board[r][c].color === turn)
                for (let toR = 0; toR < 8; ++toR)
                    for (let toC = 0; toC < 8; ++toC)
                        if (this.#isValidMove(r, c, toR, toC)) moves.push({ fromR: r, fromC: c, toR, toC });
        if (!moves.length) return { score: this.#evaluate(board, 'black') };
        let bestMove = null, bestScore = turn === 'black' ? -Infinity : Infinity;
        for (let move of moves) {
            let nb = this.#copyBoard(board), p = nb[move.fromR][move.fromC];
            nb[move.toR][move.toC] = p; nb[move.fromR][move.fromC] = null;
            if (p.type === "pawn" && (move.toR === 0 || move.toR === 7)) p.type = "queen";
            let result = this.#minimax(nb, turn === 'black' ? 'white' : 'black', depth - 1, alpha, beta);
            if (turn === 'black') {
                if (result.score > bestScore) { bestScore = result.score; bestMove = move; }
                alpha = Math.max(alpha, bestScore);
            } else {
                if (result.score < bestScore) { bestScore = result.score; bestMove = move; }
                beta = Math.min(beta, bestScore);
            }
            if (beta <= alpha) break;
        }
        return { score: bestScore, move: bestMove };
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
    async onKeyDown(e) { if (e.code === 'Escape') this.#selectedSquare = null; }
    async onKeyUp(e) {}
}

registerWidget(new ChessWidget());

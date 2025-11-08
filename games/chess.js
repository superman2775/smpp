//"i don't vibecode, chatgpt does" - super_man2775
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
    //highscore is default zero
    defaultSettings() {
        return { hiScore: 0 };
    }
    //this thing is called chess
    get title() { return "Chess"; }
    //make it harder using the slider
    get options() {
        return [
            GameOption.slider("difficulty", "Bot Difficulty", 100, 1000, 500, 100)
        ];
    }
    //calculate difficulty
    #getDifficulty() {
        return Math.max(1, Math.min(10, Math.round(Number(this.getOpt("difficulty")) / 100)));
    }
    //different difficulties
    #getBotDepth() {
        const d = this.#getDifficulty();
        switch (d) {
            case 1: return 1;
            case 2: return 2;
            case 3: return 3;
            case 4: return 4;
            case 5: return 5;
            case 6: return 6;
            case 7: return 7;
            case 8: return 8;
            case 9: return 9;
            case 10: return 10;
            default: return 3;
        }
    }
    //initialize the game
    async onGameStart() {
        this.#initBoard();
        this.#currentPlayer = 'white';
        this.#selectedSquare = null;
        this.#isThinking = false;
        this.#moveCount = 0;
        this.score = 0;
        this.#checked = { white: false, black: false };
    }
    //put the pieces on the board
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
    //build the board
    onGameDraw(ctx, dt) {
        ctx.clearRect(0, 0, 300, 300);
        for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
            let x = col * this.#squareSize, y = row * this.#squareSize;

            //theme based colors before GTA VI (i feel so smart now but chatgpt did it)
            let baseColor = ((row + col) % 2 === 0)
                ? getThemeVar("--color-base01")
                : getThemeVar("--color-base03");

            //make the squares
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y, this.#squareSize, this.#squareSize);

            let piece = this.#board[row][col];

            //if king almost ded -> make square red (this has a name but idk how to play chess)
            if (piece && piece.type === "king" && this.#checked[piece.color]) {
                ctx.fillStyle = "rgba(255,0,0,0.5)";
                ctx.fillRect(x, y, this.#squareSize, this.#squareSize);
            }
            //click on a piece to make it this color
            else if (this.#selectedSquare && this.#selectedSquare[0] === row && this.#selectedSquare[1] === col) {
                ctx.fillStyle = "rgba(255,255,0,0.4)";
                ctx.fillRect(x, y, this.#squareSize, this.#squareSize);
            }

            //give the pieces colors yay
            if (piece) {
                if (piece.color === "white") {
                    ctx.fillStyle = "#fff";
                } else {
                    ctx.fillStyle = getThemeVar("--color-base02");
                }
                ctx.font = '28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.#pieceSymbols[piece.color][piece.type], x + this.#squareSize / 2, y + this.#squareSize / 2 + 2);
            }
        }
    }
    //handle mouse clicks
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
    //process clicks
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
    //validate moves (very complicated, dont understand it either)
    #isValidMove(fromRow, fromCol, toRow, toCol) {
        if (![fromRow, fromCol, toRow, toCol].every(x => x >= 0 && x < 8)) return false;
        const piece = this.#board[fromRow][fromCol];
        if (!piece || piece.color !== this.#currentPlayer) return false;
        if (fromRow === toRow && fromCol === toCol) return false;
        const target = this.#board[toRow][toCol];
        if (target && target.color === piece.color) return false;
        if (target && target.type === "king") return false;
        const rowDiff = toRow - fromRow, colDiff = toCol - fromCol;
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
    //check if path is clear
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
    //simulate move to see if king is in check
    #wouldLeaveKingInCheck(fromR, fromC, toR, toC, color) {
        let board = this.#copyBoard(this.#board), piece = board[fromR][fromC];
        board[toR][toC] = piece; board[fromR][fromC] = null;
        if (piece && piece.type === "pawn" && (toR === 0 || toR === 7)) piece.type = "queen";
        return this.#isKingInCheck(board, color);
    }
    //make a copy of the board
    #copyBoard(board) {
        return board.map(row => row.map(piece => (piece ? { ...piece } : null)));
    }
    //execute the move
    #makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.#board[fromRow][fromCol];
        this.#board[toRow][toCol] = piece;
        this.#board[fromRow][fromCol] = null;
        if (piece.type === "pawn" && (toRow === 0 || toRow === 7)) piece.type = "queen";
    }
    //find the king on the board
    #findKing(board, color) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (board[r][c] && board[r][c].color === color && board[r][c].type === "king") return [r, c];
        return null;
    }
    //check if king is almost ded
    #isKingInCheck(board, color) {
        const kingPos = this.#findKing(board, color);
        if (!kingPos) return false;
        const [r, c] = kingPos;
        return this.#isSquareAttacked(board, r, c, color === "white" ? "black" : "white");
    }
    //check if square is attacked
    #isSquareAttacked(board, row, col, byColor) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === byColor)
                if (this.#canPieceAttack(board, r, c, row, col, piece)) return true;
        }
        return false;
    }
    //can a piece attack a square
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
    //update king almost ded status
    #updateCheckStatus() {
        this.#checked.white = this.#isKingInCheck(this.#board, "white");
        this.#checked.black = this.#isKingInCheck(this.#board, "black");
    }
    //check for end of game or if bot needs to do stuff
    #checkEndOrBot(player) {
        const moves = this.#getAllValidMoves(player || this.#currentPlayer);
        const checked = this.#checked[player || this.#currentPlayer];
        if (!moves.length) {
            setTimeout(() => this.stopGame(), 1200);
            return;
        }
        if (player === "black" || (!player && this.#currentPlayer === "black"))
            setTimeout(() => this.#botMove(), 325);
    }
    //get all valid moves
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
    //look at the board and think
    #evaluate(board, color) {
        let score = 0;
        let pieceVals = { pawn: 100, knight: 325, bishop: 340, rook: 500, queen: 900, king: 0 };
        let myColor = color, enemyColor = color === "white" ? "black" : "white";
        let kingPosEnemy = this.#findKing(board, enemyColor);

        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            let p = board[r][c]; if (!p) continue;
            let mod = (p.color === myColor ? 1 : -1);
            score += pieceVals[p.type] * mod;
            if (p.color === myColor) {
                for (let toR = 0; toR < 8; ++toR)
                for (let toC = 0; toC < 8; ++toC) {
                    let enemy = board[toR][toC];
                    if (enemy && enemy.color === enemyColor && this.#canPieceAttack(board, r, c, toR, toC, p)) {
                        score += (pieceVals[enemy.type] * 0.8 + 40) * mod;
                        if (enemy.type === "king") score += 600 * mod;
                    }
                }
            }
        }
        if (kingPosEnemy) {
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                let rr = kingPosEnemy[0] + dr, cc = kingPosEnemy[1] + dc;
                if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] && board[rr][cc].color === myColor) {
                    score += 60;
                }
            }
        }
        let myMoves = 0, enemyMoves = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            if (board[r][c] && board[r][c].color === myColor)
                for (let toR = 0; toR < 8; toR++) for (let toC = 0; toC < 8; toC++)
                    if (this.#canPieceAttack(board, r, c, toR, toC)) myMoves++;
            if (board[r][c] && board[r][c].color === enemyColor)
                for (let toR = 0; toR < 8; toR++) for (let toC = 0; toC < 8; toC++)
                    if (this.#canPieceAttack(board, r, c, toR, toC)) enemyMoves++;
        }
        score += 2 * (myMoves - enemyMoves);
        let whiteMoves = this.#getAllValidMoves("white");
        let blackMoves = this.#getAllValidMoves("black");
        if (!blackMoves.length && this.#isKingInCheck(board, "black")) score += 1000000;
        if (!whiteMoves.length && this.#isKingInCheck(board, "white")) score -= 1000000;
        return score;
    }
    //determine bot move
    #getBotMove() {
        const depth = this.#getBotDepth();
        const difficulty = this.#getDifficulty();
        const moves = this.#getAllValidMoves('black');

        if (difficulty === 1 && moves.length > 0) {
            return moves[Math.floor(Math.random() * moves.length)] || null;
        } else if (difficulty === 2 && moves.length > 0) {
            let bestScore = -Infinity, bestMove = moves[0];
            for (const move of moves) {
                const testBoard = this.#copyBoard(this.#board);
                const p = testBoard[move.fromR][move.fromC];
                testBoard[move.toR][move.fromC] = null;
                testBoard[move.toR][move.toC] = p;
                if (p.type === "pawn" && (move.toR === 0 || move.toR === 7)) p.type = "queen";
                let score = this.#evaluate(testBoard, "black");
                if (score > bestScore) { bestScore = score; bestMove = move; }
            }
            return bestMove;
        } else {
            return this.#minimax(this.#copyBoard(this.#board), 'black', depth, -Infinity, Infinity).move;
        }
    }
    //minimax algorithm with alpha-beta pruning (very smart thing made by chatgpt)
    #minimax(board, turn, depth, alpha, beta) {
        let pieceVals = { pawn: 100, knight: 325, bishop: 340, rook: 500, queen: 900, king: 0 };
        if (depth === 0) return { score: this.#evaluate(board, 'black') };
        let moves = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (board[r][c] && board[r][c].color === turn)
                for (let toR = 0; toR < 8; ++toR)
                    for (let toC = 0; toC < 8; ++toC)
                        if (this.#isValidMove(r, c, toR, toC)) moves.push({ fromR: r, fromC: c, toR, toC });
        moves = moves.sort((a, b) => {
            const ca = board[a.toR][a.toC], cb = board[b.toR][b.toC];
            let va = ca && ca.color !== turn ? (pieceVals[ca.type] || 0) : 0;
            let vb = cb && cb.color !== turn ? (pieceVals[cb.type] || 0) : 0;
            return vb - va;
        });
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
    //bot moves shit
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
//yippie its the end now i can stop pretending to code and eat a whopper!

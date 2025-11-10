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

    // For opening moves at max difficulty (Ruy Lopez start)
    #openingBook = [
        { fromR: 1, fromC: 4, toR: 3, toC: 4 }, // e7-e5
        { fromR: 0, fromC: 1, toR: 2, toC: 2 }, // Nb8-c6
        { fromR: 0, fromC: 6, toR: 2, toC: 5 }, // Ng8-f6
        { fromR: 1, fromC: 2, toR: 3, toC: 2 }, // c7-c5
        { fromR: 1, fromC: 3, toR: 3, toC: 3 }, // d7-d5
    ];
    #bookIndex = 0;

    defaultSettings() { return { hiScore: 0 }; }
    get title() { return "Chess"; }
    get options() {
        return [GameOption.slider("difficulty", "Bot Difficulty", 100, 1000, 500, 100)];
    }
    #getDifficulty() {
        return Math.max(1, Math.min(10, Math.round(Number(this.getOpt("difficulty")) / 100)));
    }
    #getBotDepth() {
        if (this.#getDifficulty() < 7) return this.#getDifficulty() + 1;
        return 8;
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
    #getAllValidMoves(color) {
    let moves = [];
    for (let r = 0; r < 8; ++r)
        for (let c = 0; c < 8; ++c)
            if (this.#board[r][c] && this.#board[r][c].color === color)
                for (let toR = 0; toR < 8; ++toR)
                    for (let toC = 0; toC < 8; ++toC)
                        if (this.#isValidMove(r, c, toR, toC)) {
                            // Simuleer de zet:
                            const testBoard = this.#copyBoard(this.#board);
                            const p = testBoard[r][c];
                            testBoard[toR][toC] = p;
                            testBoard[r][c] = null;
                            if (p.type === "pawn" && (toR === 0 || toR === 7)) p.type = "queen";
                            // En check: is de eigen koning nu veilig?
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

    #evaluate(board, color) {
        let score = 0;
        let pieceVals = { pawn: 100, knight: 325, bishop: 340, rook: 500, queen: 900, king: 0 };
        let myColor = color, enemyColor = color === "white" ? "black" : "white";
        let kingRow = null, kingCol = null;

        // Zoek waar de koning staat
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            let p = board[r][c];
            if (p && p.type === "king" && p.color === myColor) {
                kingRow = r; kingCol = c;
            }
        }

        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            let p = board[r][c];
            if (!p) continue;
            let mod = (p.color === myColor ? 1 : -1);
            score += pieceVals[p.type] * mod;

            // Koning is veilig aan de rand in de opening/middenspel
            if (p.type === "king" && p.color === myColor) {
                if (this.#moveCount < 50 && (r < 2 || r > 5 || c < 2 || c > 5)) {
                    score += 0; // ok aan rand
                } else if (this.#moveCount < 50) {
                    score -= 300; // Te ver in centrum te vroeg
                }
                // Pionnen schild
                let shield = 0;
                for (let dc = -1; dc <= 1; dc++) {
                    let rr = (myColor === "white" ? kingRow + 1 : kingRow - 1), cc = kingCol + dc;
                    if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 &&
                        board[rr][cc] && board[rr][cc].type === "pawn" && board[rr][cc].color === myColor
                    ) {
                        shield++;
                    }
                }
                if (shield === 0) score -= 200;
            }
            // Pionstructuur: straf voor gedubbelde pionnen
            if (p.type === "pawn") {
                let filePawns = 0;
                for (let rr = 0; rr < 8; rr++) if (board[rr][c] && board[rr][c].type === "pawn" && board[rr][c].color === p.color) filePawns++;
                if (filePawns > 1) score -= 15 * filePawns * mod;
                if ((p.color === "white" && r < 4) || (p.color === "black" && r > 3)) score += 10 * mod;
            }
            // Center control
            if ((r === 3 || r === 4) && (c === 3 || c === 4))
                score += 16 * mod;
            // Piece activity
            if ((p.type === "knight" || p.type === "bishop") && p.color === myColor)
                score += (p.color === "white" ? 7 - r : r) * 2;

            // Kansen tot captures niet missen
            if (p.color === myColor) {
                for (let toR = 0; toR < 8; ++toR)
                for (let toC = 0; toC < 8; ++toC) {
                    let enemy = board[toR][toC];
                    if (enemy && enemy.color === enemyColor && this.#canPieceAttack(board, r, c, toR, toC, p)) {
                        if (!this.#isHanging(board, toR, toC)) {
                            score += (pieceVals[enemy.type] + 200) * mod;
                        } else {
                            score += (pieceVals[enemy.type] * 0.4) * mod;
                        }
                    }
                }
            }
            // Hanging pieces
            if (this.#isHanging(board, r, c)) score -= mod * pieceVals[p.type] * 0.7;
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
    #quiesce(board, turn, alpha, beta) {
        let stand_pat = this.#evaluate(board, 'black');
        if (turn === 'black') {
            if (stand_pat >= beta) return beta;
            if (stand_pat > alpha) alpha = stand_pat;
        } else {
            if (stand_pat <= alpha) return alpha;
            if (stand_pat < beta) beta = stand_pat;
        }
        let moves = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (board[r][c] && board[r][c].color === turn)
                for (let toR = 0; toR < 8; ++toR)
                    for (let toC = 0; toC < 8; ++toC)
                        if (this.#isValidMove(r, c, toR, toC) && board[toR][toC] && board[toR][toC].color !== turn)
                            moves.push({ fromR: r, fromC: c, toR, toC });
        for (let move of moves) {
            let nb = this.#copyBoard(board), p = nb[move.fromR][move.fromC];
            nb[move.toR][move.toC] = p; nb[move.fromR][move.fromC] = null;
            if (p.type === "pawn" && (move.toR === 0 || move.toR === 7)) p.type = "queen";
            let score = -this.#quiesce(nb, turn === 'black' ? 'white' : 'black', -beta, -alpha);
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }
    #getBotMove() {
        const difficulty = this.#getDifficulty();
        const depth = this.#getBotDepth();
        const moves = this.#getAllValidMoves('black');
        if (difficulty === 1 && moves.length > 0) {
            return moves[Math.floor(Math.random() * moves.length)] || null;
        }
        if (difficulty === 2 && moves.length > 0) {
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
        }
        // Opening book: max diff and in first paar zetten
        if (difficulty >= 8 && this.#bookIndex < this.#openingBook.length) {
            const chosen = this.#openingBook[this.#bookIndex];
            this.#bookIndex++;
            return chosen;
        }
        return this.#minimax(this.#copyBoard(this.#board), 'black', depth, -Infinity, Infinity).move;
    }
    #minimax(board, turn, depth, alpha, beta) {
        let pieceVals = { pawn: 100, knight: 325, bishop: 340, rook: 500, queen: 900, king: 0 };
        if (depth === 0) return { score: this.#quiesce(board, turn, alpha, beta) };
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
        const moves = this.#getAllValidMoves(player || this.#currentPlayer);
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
}

registerWidget(new ChessWidget());
// yippie its the end now i can stop pretending to code and eat a whopper!

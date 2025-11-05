// games/chess.js

class ChessWidget extends GameBase {
  constructor() {
    super();
    this.pieceSymbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    this.difficultyLabels = ['', 'Easy', 'Medium', 'Hard', 'Expert', 'Master'];
    this.newGame();
  }

  get title() { return "Chess++"; }
  get icon() { return "♔"; }
  get description() { return "Play chess vs the bot!"; }
  get options() {
    return [
      GameOption.slider("difficulty", "AI Difficulty:", 1, 5, 3),
    ];
  }

  newGame() {
    this.board = this.initializeBoard();
    this.selectedSquare = null;
    this.currentPlayer = "white";
    this.gameStatus = "playing";
    this.moveHistory = [];
    this.isThinking = false;
    this.isInCheck = { white: false, black: false };
    this.difficulty = this.getOpt("difficulty") || 3;
    this.animText = "";
    this.animCount = 0;
  }

  onGameStart() {
    this.newGame();
  }

  // Board setup (8x8)
  initializeBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let i = 0; i < 8; i++) {
      b[1][i] = { type: 'pawn', color: 'black' };
      b[6][i] = { type: 'pawn', color: 'white' };
    }
    const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let i = 0; i < 8; i++) {
      b[0][i] = { type: backRow[i], color: 'black' };
      b[7][i] = { type: backRow[i], color: 'white' };
    }
    return b;
  }

  // Find King position for check
  findKing(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "king" && p.color === color) return [r, c];
    }
    return null;
  }

  // Helper for square under attack
  isSquareUnderAttack(board, row, col, attackerColor) {
    for (let fr = 0; fr < 8; fr++) for (let fc = 0; fc < 8; fc++) {
      const p = board[fr][fc];
      if (p && p.color === attackerColor)
        if (this.canPieceAttack(board, fr, fc, row, col)) return true;
    }
    return false;
  }

  canPieceAttack(board, fr, fc, tr, tc) {
    const p = board[fr][fc]; if (!p) return false;
    const rd = tr - fr; const cd = tc - fc;
    if (p.type === 'pawn') {
      const dir = p.color === 'white' ? -1 : 1;
      return Math.abs(cd) === 1 && rd === dir;
    }
    if (p.type === 'rook')   return (rd === 0 || cd === 0) && this.isPathClear(board, fr, fc, tr, tc);
    if (p.type === 'knight') return (Math.abs(rd) === 2 && Math.abs(cd) === 1) || (Math.abs(rd) === 1 && Math.abs(cd) === 2);
    if (p.type === 'bishop') return Math.abs(rd) === Math.abs(cd) && this.isPathClear(board, fr, fc, tr, tc);
    if (p.type === 'queen')  return ((rd === 0 || cd === 0) || Math.abs(rd) === Math.abs(cd)) && this.isPathClear(board, fr, fc, tr, tc);
    if (p.type === 'king')   return Math.abs(rd) <= 1 && Math.abs(cd) <= 1;
    return false;
  }

  isPathClear(board, fr, fc, tr, tc) {
    const rs = tr > fr ? 1 : tr < fr ? -1 : 0;
    const cs = tc > fc ? 1 : tc < fc ? -1 : 0;
    let r = fr + rs, c = fc + cs;
    while (r !== tr || c !== tc) {
      if (board[r][c]) return false;
      r += rs; c += cs;
    }
    return true;
  }

  isKingInCheck(board, color) {
    const k = this.findKing(board, color); if (!k) return false;
    const opp = color === 'white' ? "black" : "white";
    return this.isSquareUnderAttack(board, k[0], k[1], opp);
  }

  wouldMoveLeaveKingInCheck(board, fr, fc, tr, tc, color) {
    const test = board.map(row => [...row]);
    test[tr][tc] = test[fr][fc];
    test[fr][fc] = null;
    return this.isKingInCheck(test, color);
  }

  movePiece(fr, fc, tr, tc, board) {
    const nb = board.map(row => [...row]);
    let piece = nb[fr][fc];
    if (piece.type === 'pawn' && (tr === 0 || tr === 7)) piece = { ...piece, type: 'queen' }; // Promote
    nb[tr][tc] = piece;
    nb[fr][fc] = null;
    const from = String.fromCharCode(97 + fc) + (8 - fr);
    const to = String.fromCharCode(97 + tc) + (8 - tr);
    return { newBoard: nb, from, to, piece };
  }

  getAllValidMoves(board, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color)
        for (let tr = 0; tr < 8; tr++)
          for (let tc = 0; tc < 8; tc++)
            if (this.isValidMoveForBoard(board, r, c, tr, tc, color))
              moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
    }
    return moves;
  }

  isValidMoveForBoard(board, fr, fc, tr, tc, player) {
    const p = board[fr][fc]; if (!p || p.color !== player) return false;
    const t = board[tr][tc];
    if (t && t.color === p.color) return false;
    const rd = tr - fr, cd = tc - fc;
    let valid = false;
    if (p.type === 'pawn') {
      const d = p.color === 'white' ? -1 : 1;
      if (cd === 0 && !t) {
        if (rd === d) valid = true;
        if (((fr === 6 && p.color === 'white') || (fr === 1 && p.color === 'black')) && rd === d * 2 && !board[fr + d][fc]) valid = true;
      }
      if (Math.abs(cd) === 1 && rd === d && t) valid = true;
    }
    if (p.type === 'rook')   valid = (rd === 0 || cd === 0) && this.isPathClear(board, fr, fc, tr, tc);
    if (p.type === 'knight') valid = (Math.abs(rd) === 2 && Math.abs(cd) === 1) || (Math.abs(rd) === 1 && Math.abs(cd) === 2);
    if (p.type === 'bishop') valid = Math.abs(rd) === Math.abs(cd) && this.isPathClear(board, fr, fc, tr, tc);
    if (p.type === 'queen')  valid = ((rd === 0 || cd === 0) || Math.abs(rd) === Math.abs(cd)) && this.isPathClear(board, fr, fc, tr, tc);
    if (p.type === 'king')   valid = Math.abs(rd) <= 1 && Math.abs(cd) <= 1;
    if (!valid) return false;
    return !this.wouldMoveLeaveKingInCheck(board, fr, fc, tr, tc, player);
  }

  // Show moves when user clicks
  isValidMove(fr, fc, tr, tc) {
    return this.isValidMoveForBoard(this.board, fr, fc, tr, tc, this.currentPlayer);
  }

  evaluatePosition(board) {
    const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
    let score = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c]; if (p) {
        const v = pieceValues[p.type];
        let bonus = 0;
        if (this.difficulty >= 3) {
          if (p.type === 'pawn')
            bonus = p.color === "black" ? r * 0.1 : (7 - r) * 0.1;
          else if (p.type === 'knight' || p.type === 'bishop')
            bonus = (7 - (Math.abs(3.5 - r) + Math.abs(3.5 - c))) * 0.05;
        }
        const total = v + bonus;
        score += p.color === "black" ? total : -total;
      }
    }
    return score;
  }

  makeBotMove() {
    if (this.isThinking || this.gameStatus !== 'playing') return;
    this.isThinking = true;
    setTimeout(() => {
      const validMoves = this.getAllValidMoves(this.board, "black");
      if (validMoves.length === 0) {
        const inCheck = this.isKingInCheck(this.board, "black");
        this.gameStatus = inCheck ? "checkmate-white" : "stalemate";
        this.isThinking = false;
        return;
      }
      let bestMove = null;
      if (this.difficulty === 1) bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      else {
        let bestScore = -Infinity;
        const movesToConsider = this.difficulty === 2 ? Math.min(10, validMoves.length) : validMoves.length;
        for (let i = 0; i < movesToConsider; i++) {
          const move = this.difficulty === 2 ? validMoves[Math.floor(Math.random() * validMoves.length)] : validMoves[i];
          const testBoard = this.board.map(row => [...row]);
          const piece = testBoard[move.fromRow][move.fromCol];
          const captured = testBoard[move.toRow][move.toCol];
          testBoard[move.toRow][move.toCol] = piece;
          testBoard[move.fromRow][move.fromCol] = null;
          let score = this.evaluatePosition(testBoard);
          if (captured) score += ({ pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 }[captured.type]) * (this.difficulty >= 4 ? 1.5 : 0.5);
          if (piece.type === 'pawn' && move.toRow === 7) score += 8;
          if (this.difficulty >= 4 && this.isKingInCheck(testBoard, "white")) score += 2;
          score += (Math.random() - 0.5) * (this.difficulty === 1 ? 3 : this.difficulty === 2 ? 1 : this.difficulty === 3 ? 0.3 : 0.1);
          if (score > bestScore) { bestScore = score; bestMove = move; }
        }
      }
      // do move
      if (bestMove) {
        const result = this.movePiece(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol, this.board);
        this.board = result.newBoard;
        this.moveHistory.push("black " + result.piece.type + ": " + result.from + "-" + result.to);
        this.isInCheck.white = this.isKingInCheck(this.board, "white");
        this.isInCheck.black = this.isKingInCheck(this.board, "black");
        const whiteHasMoves = this.getAllValidMoves(this.board, "white").length > 0;
        if (this.isInCheck.white && !whiteHasMoves) this.gameStatus = "checkmate-black";
        else if (!this.isInCheck.white && !whiteHasMoves) this.gameStatus = "stalemate";
        else this.currentPlayer = "white";
      }
      this.isThinking = false;
      this.animText = "Bot move!";
      this.animCount = 40;
    }, 400 + this.difficulty * 200);
  }

  // User click/touch support
  onMouseDown(x, y) {
    if (this.gameStatus !== "playing" || this.isThinking || this.currentPlayer !== "white") return;
    const sz = Math.min(this.width, this.height) * 0.9;
    const margin = (this.width - sz) / 2;
    const cell = sz / 8;
    // Get square
    const col = Math.floor((x - margin) / cell);
    const row = Math.floor((y - margin) / cell);
    if (row < 0 || row > 7 || col < 0 || col > 7) return;
    const piece = this.board[row][col];
    if (this.selectedSquare) {
      const [sr, sc] = this.selectedSquare;
      if (this.isValidMove(sr, sc, row, col)) {
        const result = this.movePiece(sr, sc, row, col, this.board);
        this.board = result.newBoard;
        this.moveHistory.push("white " + result.piece.type + ": " + result.from + "-" + result.to);
        this.selectedSquare = null;
        this.isInCheck.white = this.isKingInCheck(this.board, "white");
        this.isInCheck.black = this.isKingInCheck(this.board, "black");
        const blackHasMoves = this.getAllValidMoves(this.board, "black").length > 0;
        if (this.isInCheck.black && !blackHasMoves) this.gameStatus = "checkmate-white";
        else if (!this.isInCheck.black && !blackHasMoves) this.gameStatus = "stalemate";
        else this.currentPlayer = "black";
        // Bot moves after a short delay
        setTimeout(() => this.makeBotMove(), 300);
        this.animText = "You moved!";
        this.animCount = 40;
      } else if (piece && piece.color === "white") this.selectedSquare = [row, col];
      else this.selectedSquare = null;
    } else if (piece && piece.color === "white") this.selectedSquare = [row, col];
  }

  // Game rendering
  onGameDraw(ctx, dt) {
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    const sz = Math.min(this.width, this.height) * 0.9;
    const margin = (this.width - sz) / 2;
    const cell = sz / 8;

    // Draw board squares
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      ctx.fillStyle = isLight ? "#ffe4b5" : "#aa8451";
      ctx.fillRect(margin + c * cell, margin + r * cell, cell, cell);

      if (this.selectedSquare && this.selectedSquare[0] === r && this.selectedSquare[1] === c) {
        ctx.strokeStyle = "#3399ff";
        ctx.lineWidth = 4;
        ctx.strokeRect(margin + c * cell, margin + r * cell, cell, cell);
      }
      const piece = this.board[r][c];
      if (piece) {
        // If king in check, highlight
        if (piece.type === 'king' && this.isInCheck[piece.color]) {
          ctx.strokeStyle = "#ff3333";
          ctx.lineWidth = 4;
          ctx.strokeRect(margin + c * cell + 2, margin + r * cell + 2, cell - 4, cell - 4);
        }
        ctx.font = cell * 0.7 + "px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = piece.color === 'white' ? "#ffffff" : "#333333";
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 4;
        ctx.fillText(this.pieceSymbols[piece.color][piece.type], margin + c * cell + cell / 2, margin + r * cell + cell / 2);
        ctx.shadowBlur = 0;
      }
    }

    // Game status dialog
    ctx.font = "bold " + Math.max(cell * 0.5, 28) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let status = "";
    if (this.isThinking) status = "Bot thinking...";
    else if (this.gameStatus === "checkmate-white") status = "Checkmate! White wins!";
    else if (this.gameStatus === "checkmate-black") status = "Checkmate! Black wins!";
    else if (this.gameStatus === "stalemate") status = "Stalemate! Draw!";
    else if (this.isInCheck[this.currentPlayer]) status = this.currentPlayer === "white" ? "Your king is in check!" : "Bot king is in check!";
    else status = this.currentPlayer === "white" ? "Your turn" : "Bot's turn";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#19468e";
    ctx.fillText(status, this.width / 2, margin - 42);

    // Difficulty slider label
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#1373b6";
    ctx.fillText("Difficulty: " + this.difficultyLabels[this.difficulty], this.width / 2, margin - 18);

    // Animation text
    if (this.animCount > 0 && this.animText) {
      ctx.font = "bold 30px sans-serif";
      ctx.globalAlpha = Math.max(0, this.animCount / 40);
      ctx.fillStyle = "#ffcc00";
      ctx.fillText(this.animText, this.width / 2, margin + sz + 16);
      this.animCount--;
    }
    ctx.globalAlpha = 1;

    // Move history panel (simple right side)
    const mhx = margin + sz + 18, mhy = margin;
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Move History:", mhx, mhy);
    for (let i = 0; i < Math.min(16, this.moveHistory.length); i++) {
      ctx.font = "16px monospace";
      ctx.fillStyle = "#222";
      ctx.fillText((i + 1) + ". " + this.moveHistory[i], mhx, mhy + 24 + i * 18);
    }
    ctx.restore();
  }

  // Restart
  onGameReset() {
    this.newGame();
  }
}

registerWidget(new ChessWidget());

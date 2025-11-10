class DinoWidget extends GameBase {
    constructor() {
        super();
        // initialize your dino game state and variables here
    }

    get title() {
        return "Dino++";
    }

    get options() {
        // Optional: add speed or difficulty slider just like the breakout/snake games
        return [
            GameOption.slider("speed", "Speed:", 10, 200, 100)
        ];
    }

    async onGameStart() {
        // Initialize positions, dino, obstacles, score, etc.
        // Respect options, e.g.: this.getOpt("speed")
        this.score = 0;
        // ... rest of your init logic ...
    }

    onGameDraw(ctx, dt) {
        // Main game loop render logic: clear canvas, move dino, obstacles, draw everything
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // ... port/update t-rex-runner logic here ...
    }

    async onKeyDown(e) {
        // Handle spacebar jump, down key for duck, etc.
        if (e.code === "Space") {
            // Jump logic
        }
        if (e.code === "ArrowDown") {
            // Duck logic
        }
    }

    async onKeyUp(e) {
        // Handle keyup for stop ducking or any other actions
    }
}

// Register the widget so it appears in the games menu
registerWidget(new DinoWidget());

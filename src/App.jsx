import { useState, useEffect, useCallback } from 'react'
import './App.css'

const BOARD_SIZE = 9;
const INITIAL_WALLS = 8; // 8 walls per player as requested

function App() {
  // Game state
  const [gameMode, setGameMode] = useState('menu'); // 'menu', 'pvp', 'ai-easy', 'ai-medium', 'ai-hard'
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [players, setPlayers] = useState({
    1: { row: 8, col: 4, walls: INITIAL_WALLS }, // Red player starts at bottom
    2: { row: 0, col: 4, walls: INITIAL_WALLS }  // Blue player starts at top
  });
  const [walls, setWalls] = useState([]);
  const [mode, setMode] = useState('move'); // 'move' or 'wall'
  const [gameHistory, setGameHistory] = useState([]);
  const [winner, setWinner] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);

  // Audio context for sound effects
  const [audioContext, setAudioContext] = useState(null);

  useEffect(() => {
    // Initialize audio context
    if (!audioContext && window.AudioContext) {
      setAudioContext(new AudioContext());
    }
  }, [audioContext]);

  // Sound generation functions
  const playSound = useCallback((frequency, duration, type = 'sine') => {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }, [audioContext]);

  const playMoveSound = useCallback(() => playSound(440, 0.1), [playSound]);
  const playWallSound = useCallback(() => playSound(220, 0.2), [playSound]);
  const playWinSound = useCallback(() => {
    playSound(523, 0.3);
    setTimeout(() => playSound(659, 0.3), 150);
    setTimeout(() => playSound(784, 0.5), 300);
  }, [playSound]);
  const playUndoSound = useCallback(() => playSound(330, 0.15), [playSound]);

  // Initialize game
  const initializeGame = (mode) => {
    setGameMode(mode);
    setCurrentPlayer(1);
    setPlayers({
      1: { row: 8, col: 4, walls: INITIAL_WALLS },
      2: { row: 0, col: 4, walls: INITIAL_WALLS }
    });
    setWalls([]);
    setMode('move');
    setGameHistory([]);
    setWinner(null);
  };

  // Check if move is valid
  const isValidMove = (player, newRow, newCol) => {
    const currentPos = players[player];
    const rowDiff = Math.abs(newRow - currentPos.row);
    const colDiff = Math.abs(newCol - currentPos.col);
    
    // Must move exactly one square in one direction
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // Check for walls blocking the move
      const isBlocked = walls.some(wall => {
        if (wall.type === 'horizontal') {
          // Horizontal wall blocks vertical movement
          if (rowDiff === 1) {
            const wallRow = Math.min(currentPos.row, newRow);
            const wallCol = Math.min(currentPos.col, newCol);
            return wall.row === wallRow && wall.col === wallCol;
          }
        } else if (wall.type === 'vertical') {
          // Vertical wall blocks horizontal movement
          if (colDiff === 1) {
            const wallRow = Math.min(currentPos.row, newRow);
            const wallCol = Math.min(currentPos.col, newCol);
            return wall.row === wallRow && wall.col === wallCol;
          }
        }
        return false;
      });
      
      if (isBlocked) return false;
      
      // Check if destination is occupied by other player
      const otherPlayer = player === 1 ? 2 : 1;
      const otherPos = players[otherPlayer];
      
      if (newRow === otherPos.row && newCol === otherPos.col) {
        return false; // Can't move to occupied square
      }
      
      return true;
    }
    
    // Check for jumping over other player
    if ((rowDiff === 2 && colDiff === 0) || (rowDiff === 0 && colDiff === 2)) {
      const otherPlayer = player === 1 ? 2 : 1;
      const otherPos = players[otherPlayer];
      const middleRow = (currentPos.row + newRow) / 2;
      const middleCol = (currentPos.col + newCol) / 2;
      
      // Other player must be in the middle
      if (otherPos.row === middleRow && otherPos.col === middleCol) {
        // Check if there are walls blocking the jump
        const firstMoveBlocked = walls.some(wall => {
          if (wall.type === 'horizontal' && rowDiff === 2) {
            return wall.row === Math.min(currentPos.row, middleRow) && wall.col === currentPos.col;
          } else if (wall.type === 'vertical' && colDiff === 2) {
            return wall.row === currentPos.row && wall.col === Math.min(currentPos.col, middleCol);
          }
          return false;
        });
        
        const secondMoveBlocked = walls.some(wall => {
          if (wall.type === 'horizontal' && rowDiff === 2) {
            return wall.row === Math.min(middleRow, newRow) && wall.col === middleCol;
          } else if (wall.type === 'vertical' && colDiff === 2) {
            return wall.row === middleRow && wall.col === Math.min(middleCol, newCol);
          }
          return false;
        });
        
        return !firstMoveBlocked && !secondMoveBlocked;
      }
    }
    
    return false;
  };

  // Check if wall placement is valid
  const isValidWallPlacement = (row, col, type) => {
    // Check if wall already exists at this position
    const wallExists = walls.some(wall => 
      wall.row === row && wall.col === col && wall.type === type
    );
    
    if (wallExists) return false;
    
    // Check bounds
    if (type === 'horizontal') {
      if (row < 0 || row >= BOARD_SIZE - 1 || col < 0 || col >= BOARD_SIZE - 1) return false;
    } else {
      if (row < 0 || row >= BOARD_SIZE - 1 || col < 0 || col >= BOARD_SIZE - 1) return false;
    }
    
    // TODO: Add pathfinding check to ensure both players can still reach their goals
    return true;
  };

  // Move player
  const movePlayer = (row, col) => {
    if (mode !== 'move' || winner) return;
    
    if (isValidMove(currentPlayer, row, col)) {
      const newState = {
        players: {
          ...players,
          [currentPlayer]: { ...players[currentPlayer], row, col }
        },
        walls: [...walls],
        currentPlayer,
        mode
      };
      
      setGameHistory([...gameHistory, { players, walls, currentPlayer, mode }]);
      setPlayers(newState.players);
      playMoveSound();
      
      // Check for win condition
      if ((currentPlayer === 1 && row === 0) || (currentPlayer === 2 && row === 8)) {
        setWinner(currentPlayer);
        playWinSound();
        return;
      }
      
      // Switch to next player
      if (gameMode === 'pvp') {
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      } else if (gameMode.startsWith('ai-') && currentPlayer === 1) {
        setCurrentPlayer(2);
        // AI will move after a short delay
        setTimeout(() => makeAIMove(), 500);
      }
    }
  };

  // Place wall
  const placeWall = (row, col, type) => {
    if (mode !== 'wall' || winner || players[currentPlayer].walls <= 0) return;
    
    if (isValidWallPlacement(row, col, type)) {
      const newWalls = [...walls, { row, col, type }];
      const newPlayers = {
        ...players,
        [currentPlayer]: { ...players[currentPlayer], walls: players[currentPlayer].walls - 1 }
      };
      
      setGameHistory([...gameHistory, { players, walls, currentPlayer, mode }]);
      setWalls(newWalls);
      setPlayers(newPlayers);
      playWallSound();
      
      // Switch to next player
      if (gameMode === 'pvp') {
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      } else if (gameMode.startsWith('ai-') && currentPlayer === 1) {
        setCurrentPlayer(2);
        // AI will move after a short delay
        setTimeout(() => makeAIMove(), 500);
      }
    }
  };

  // AI Move Logic
  const makeAIMove = () => {
    if (currentPlayer !== 2 || winner) return;
    
    const aiLevel = gameMode.split('-')[1]; // 'easy', 'medium', 'hard'
    let move = null;
    
    if (aiLevel === 'easy') {
      // Random moves
      move = getRandomMove();
    } else if (aiLevel === 'medium') {
      // Try to move towards goal with some randomness
      move = Math.random() < 0.7 ? getBestMove() : getRandomMove();
    } else if (aiLevel === 'hard') {
      // Smart strategy
      move = getBestMove();
    }
    
    if (move) {
      if (move.type === 'move') {
        movePlayer(move.row, move.col);
      } else if (move.type === 'wall') {
        placeWall(move.row, move.col, move.wallType);
      }
    }
  };

  const getRandomMove = () => {
    const aiPos = players[2];
    const possibleMoves = [];
    
    // Try all adjacent moves
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (Math.abs(dr) + Math.abs(dc) === 1) { // Only orthogonal moves
          const newRow = aiPos.row + dr;
          const newCol = aiPos.col + dc;
          if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
            if (isValidMove(2, newRow, newCol)) {
              possibleMoves.push({ type: 'move', row: newRow, col: newCol });
            }
          }
        }
      }
    }
    
    // Try wall placements if AI has walls
    if (players[2].walls > 0) {
      for (let r = 0; r < BOARD_SIZE - 1; r++) {
        for (let c = 0; c < BOARD_SIZE - 1; c++) {
          if (isValidWallPlacement(r, c, 'horizontal')) {
            possibleMoves.push({ type: 'wall', row: r, col: c, wallType: 'horizontal' });
          }
          if (isValidWallPlacement(r, c, 'vertical')) {
            possibleMoves.push({ type: 'wall', row: r, col: c, wallType: 'vertical' });
          }
        }
      }
    }
    
    return possibleMoves.length > 0 ? possibleMoves[Math.floor(Math.random() * possibleMoves.length)] : null;
  };

  const getBestMove = () => {
    const aiPos = players[2];
    const playerPos = players[1];
    
    // Priority 1: Move towards goal (bottom)
    const movesToGoal = [];
    if (aiPos.row < BOARD_SIZE - 1 && isValidMove(2, aiPos.row + 1, aiPos.col)) {
      movesToGoal.push({ type: 'move', row: aiPos.row + 1, col: aiPos.col, priority: 10 });
    }
    
    // Priority 2: Block player if they're close to winning
    if (playerPos.row <= 2 && players[2].walls > 0) {
      // Try to place walls to block player
      const blockingWalls = [];
      for (let c = Math.max(0, playerPos.col - 1); c <= Math.min(BOARD_SIZE - 2, playerPos.col + 1); c++) {
        if (isValidWallPlacement(playerPos.row, c, 'horizontal')) {
          blockingWalls.push({ type: 'wall', row: playerPos.row, col: c, wallType: 'horizontal', priority: 8 });
        }
      }
      if (blockingWalls.length > 0) {
        return blockingWalls[0];
      }
    }
    
    // Priority 3: Other valid moves
    const otherMoves = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (Math.abs(dr) + Math.abs(dc) === 1) {
          const newRow = aiPos.row + dr;
          const newCol = aiPos.col + dc;
          if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
            if (isValidMove(2, newRow, newCol)) {
              otherMoves.push({ type: 'move', row: newRow, col: newCol, priority: 5 });
            }
          }
        }
      }
    }
    
    // Return best move
    const allMoves = [...movesToGoal, ...otherMoves];
    if (allMoves.length > 0) {
      allMoves.sort((a, b) => b.priority - a.priority);
      return allMoves[0];
    }
    
    return getRandomMove();
  };

  // Undo last move
  const undoMove = () => {
    if (gameHistory.length === 0) return;
    
    const lastState = gameHistory[gameHistory.length - 1];
    setPlayers(lastState.players);
    setWalls(lastState.walls);
    setCurrentPlayer(lastState.currentPlayer);
    setMode(lastState.mode);
    setGameHistory(gameHistory.slice(0, -1));
    setWinner(null);
    playUndoSound();
  };

  // Render board cell
  const renderCell = (row, col) => {
    const isPlayer1 = players[1].row === row && players[1].col === col;
    const isPlayer2 = players[2].row === row && players[2].col === col;
    
    let cellClass = 'board-cell';
    if (isPlayer1) cellClass += ' player1';
    if (isPlayer2) cellClass += ' player2';
    
    const handleClick = () => {
      if (mode === 'move') {
        movePlayer(row, col);
      }
    };
    
    return (
      <div key={`${row}-${col}`} className={cellClass} onClick={handleClick}>
        {isPlayer1 && '♜'}
        {isPlayer2 && '♞'}
      </div>
    );
  };

  // Render wall slots
  const renderWallSlots = () => {
    const slots = [];
    
    // Horizontal wall slots
    for (let row = 0; row < BOARD_SIZE - 1; row++) {
      for (let col = 0; col < BOARD_SIZE - 1; col++) {
        const isPlaced = walls.some(w => w.row === row && w.col === col && w.type === 'horizontal');
        const slotClass = `wall-slot horizontal ${isPlaced ? 'placed' : ''}`;
        
        slots.push(
          <div
            key={`h-${row}-${col}`}
            className={slotClass}
            style={{
              gridRow: row * 2 + 2,
              gridColumn: `${col * 2 + 1} / span 3`
            }}
            onClick={() => mode === 'wall' && !isPlaced && placeWall(row, col, 'horizontal')}
          />
        );
      }
    }
    
    // Vertical wall slots
    for (let row = 0; row < BOARD_SIZE - 1; row++) {
      for (let col = 0; col < BOARD_SIZE - 1; col++) {
        const isPlaced = walls.some(w => w.row === row && w.col === col && w.type === 'vertical');
        const slotClass = `wall-slot vertical ${isPlaced ? 'placed' : ''}`;
        
        slots.push(
          <div
            key={`v-${row}-${col}`}
            className={slotClass}
            style={{
              gridRow: `${row * 2 + 1} / span 3`,
              gridColumn: col * 2 + 2
            }}
            onClick={() => mode === 'wall' && !isPlaced && placeWall(row, col, 'vertical')}
          />
        );
      }
    }
    
    return slots;
  };

  if (gameMode === 'menu') {
    return (
      <div className="game-container">
        {showWelcome && (
          <div className="modal-overlay">
            <div className="modal-content welcome-modal">
              <h2 className="text-2xl font-bold mb-4">مرحباً بك في لعبة Wall Chess!</h2>
              <div className="rules-list">
                <h3 className="text-lg font-semibold mb-2">قواعد اللعبة:</h3>
                <p>🎯 <strong>الهدف:</strong> كن أول لاعب يصل بقطعته إلى الجانب الآخر من اللوحة</p>
                <p>🚶 <strong>الحركة:</strong> يمكن تحريك القطعة مربع واحد في أي اتجاه (أعلى، أسفل، يمين، يسار)</p>
                <p>🦘 <strong>القفز:</strong> إذا كان هناك لاعب آخر في المربع المجاور، يمكن القفز فوقه</p>
                <p>🧱 <strong>الجدران:</strong> يمكن وضع جدار لمنع حركة الخصم (كل جدار يغطي مربعين)</p>
                <p>⚠️ <strong>القيود:</strong> لا يمكن وضع جدار يمنع اللاعب من الوصول إلى هدفه نهائياً</p>
                <p>🔢 <strong>عدد الجدران:</strong> كل لاعب يمتلك 8 جدران</p>
                
                <h3 className="text-lg font-semibold mb-2 mt-4">كيفية اللعب:</h3>
                <p>🔴 اللاعب الأحمر (♜) يبدأ من الأسفل ويحاول الوصول للأعلى</p>
                <p>🔵 اللاعب الأزرق (♞) يبدأ من الأعلى ويحاول الوصول للأسفل</p>
                <p>🔄 استخدم زر "تبديل الوضع" للتنقل بين وضع التحريك ووضع الجدران</p>
                <p>↩️ يمكن استخدام زر "تراجع" للعودة خطوة واحدة</p>
              </div>
              <button 
                className="btn btn-primary mt-4"
                onClick={() => setShowWelcome(false)}
              >
                ابدأ اللعب
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-4xl font-bold mb-8">Wall Chess</h1>
          <div className="space-y-4">
            <button 
              className="btn btn-primary w-64"
              onClick={() => initializeGame('pvp')}
            >
              لاعب ضد لاعب
            </button>
            <div className="ai-buttons">
              <button 
                className="btn btn-secondary"
                onClick={() => initializeGame('ai-easy')}
              >
                ضد الكمبيوتر - سهل 🤖
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => initializeGame('ai-medium')}
              >
                ضد الكمبيوتر - متوسط 🎯
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => initializeGame('ai-hard')}
              >
                ضد الكمبيوتر - صعب 🧠
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {winner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">
              {winner === 1 ? 'اللاعب الأحمر فاز!' : 'اللاعب الأزرق فاز!'}
            </h2>
            <div className="space-y-2">
              <button 
                className="btn btn-primary"
                onClick={() => initializeGame(gameMode)}
              >
                لعب مرة أخرى
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setGameMode('menu')}
              >
                العودة للقائمة الرئيسية
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center">
        <div className="game-info">
          <h1 className="text-3xl font-bold mb-4">Wall Chess</h1>
          <p className="text-lg">
            {gameMode === 'pvp' ? 'لاعب ضد لاعب' : 
             gameMode === 'ai-easy' ? 'ضد الكمبيوتر - سهل' :
             gameMode === 'ai-medium' ? 'ضد الكمبيوتر - متوسط' :
             'ضد الكمبيوتر - صعب'}
          </p>
        </div>
        
        <div className="mobile-layout sm:desktop-layout">
          <div className="flex gap-8 mb-6">
            <div className={`player-info ${currentPlayer === 1 ? 'active' : ''}`}>
              <span className="text-2xl">♜</span>
              <div>
                <div className="font-bold">اللاعب الأحمر</div>
                <div className="text-sm">جدران: {players[1].walls}</div>
              </div>
            </div>
            
            <div className={`player-info ${currentPlayer === 2 ? 'active' : ''}`}>
              <span className="text-2xl">♞</span>
              <div>
                <div className="font-bold">اللاعب الأزرق</div>
                <div className="text-sm">جدران: {players[2].walls}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="game-board">
          {Array.from({ length: BOARD_SIZE }, (_, row) =>
            Array.from({ length: BOARD_SIZE }, (_, col) => renderCell(row, col))
          )}
          {renderWallSlots()}
        </div>
        
        <div className="game-controls">
          <button 
            className={`btn ${mode === 'move' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode(mode === 'move' ? 'wall' : 'move')}
          >
            {mode === 'move' ? 'تبديل إلى وضع الجدار' : 'تبديل إلى وضع التحريك'}
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={undoMove}
            disabled={gameHistory.length === 0}
          >
            تراجع
          </button>
          
          <button 
            className="btn btn-danger"
            onClick={() => setGameMode('menu')}
          >
            العودة للقائمة
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;


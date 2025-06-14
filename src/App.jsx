import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button.jsx';
import './App.css';

// Game constants
const BOARD_SIZE = 9;
const WALLS_PER_PLAYER = 8;

// Initialize empty board
const createBoard = () => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
};

// Initialize walls
const createWalls = () => ({
  horizontal: Array(BOARD_SIZE - 1).fill(null).map(() => Array(BOARD_SIZE).fill(false)),
  vertical: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE - 1).fill(false))
});

// Sound effects using Web Audio API
const createAudioContext = () => {
  if (typeof window !== 'undefined' && window.AudioContext) {
    return new (window.AudioContext || window.webkitAudioContext)();
  }
  return null;
};

const playSound = (audioContext, frequency, duration, type = 'sine') => {
  if (!audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = type;
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

// AI Logic
const findPath = (start, goal, walls) => {
  // Simple BFS pathfinding
  const queue = [[start.row, start.col, 0]];
  const visited = new Set();
  
  while (queue.length > 0) {
    const [row, col, distance] = queue.shift();
    const key = `${row},${col}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    // Check if reached goal
    if ((goal === 'top' && row === 0) || (goal === 'bottom' && row === BOARD_SIZE - 1)) {
      return distance;
    }
    
    // Check all 4 directions
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
        // Check for walls
        let blocked = false;
        if (dr === 1 && walls.horizontal[row] && walls.horizontal[row][col]) blocked = true;
        if (dr === -1 && walls.horizontal[newRow] && walls.horizontal[newRow][col]) blocked = true;
        if (dc === 1 && walls.vertical[row] && walls.vertical[row][col]) blocked = true;
        if (dc === -1 && walls.vertical[row] && walls.vertical[row][newCol]) blocked = true;
        
        if (!blocked) {
          queue.push([newRow, newCol, distance + 1]);
        }
      }
    }
  }
  
  return Infinity; // No path found
};

const getAIMove = (players, walls, difficulty) => {
  const aiPlayer = 2;
  const humanPlayer = 1;
  const aiPos = players[aiPlayer];
  const humanPos = players[humanPlayer];
  
  // Get all possible moves
  const possibleMoves = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dr, dc] of directions) {
    const newRow = aiPos.row + dr;
    const newCol = aiPos.col + dc;
    
    if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
      // Check for walls
      let blocked = false;
      if (dr === 1 && walls.horizontal[aiPos.row] && walls.horizontal[aiPos.row][aiPos.col]) blocked = true;
      if (dr === -1 && walls.horizontal[newRow] && walls.horizontal[newRow][aiPos.col]) blocked = true;
      if (dc === 1 && walls.vertical[aiPos.row] && walls.vertical[aiPos.row][aiPos.col]) blocked = true;
      if (dc === -1 && walls.vertical[aiPos.row] && walls.vertical[aiPos.row][newCol]) blocked = true;
      
      // Check if position is occupied by human player
      if (newRow === humanPos.row && newCol === humanPos.col) blocked = true;
      
      if (!blocked) {
        possibleMoves.push({ row: newRow, col: newCol });
      }
    }
  }
  
  if (possibleMoves.length === 0) return null;
  
  // AI strategy based on difficulty
  switch (difficulty) {
    case 'easy':
      // Random move
      return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      
    case 'medium':
      // Move towards goal with some randomness
      const goalRow = BOARD_SIZE - 1;
      let bestMove = possibleMoves[0];
      let bestDistance = Math.abs(bestMove.row - goalRow);
      
      for (const move of possibleMoves) {
        const distance = Math.abs(move.row - goalRow);
        if (distance < bestDistance || (distance === bestDistance && Math.random() < 0.3)) {
          bestMove = move;
          bestDistance = distance;
        }
      }
      return bestMove;
      
    case 'hard':
      // Advanced strategy: minimize own path while maximizing opponent's path
      let bestMoveAdvanced = possibleMoves[0];
      let bestScore = -Infinity;
      
      for (const move of possibleMoves) {
        const tempPlayers = {
          ...players,
          [aiPlayer]: { ...players[aiPlayer], row: move.row, col: move.col }
        };
        
        const aiDistance = findPath(move, 'bottom', walls);
        const humanDistance = findPath(humanPos, 'top', walls);
        
        // Score: prioritize shorter path for AI and longer path for human
        const score = humanDistance - aiDistance;
        
        if (score > bestScore) {
          bestScore = score;
          bestMoveAdvanced = move;
        }
      }
      
      return bestMoveAdvanced;
      
    default:
      return possibleMoves[0];
  }
};

// Welcome modal component
const WelcomeModal = ({ onClose, onStartGame, onStartAI }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>مرحباً بك في Wall Chess!</h2>
        <div className="rules-section">
          <h3>قواعد اللعبة:</h3>
          <ul>
            <li>🎯 <strong>الهدف:</strong> كن أول من يصل إلى الجانب الآخر من اللوحة</li>
            <li>🔴 <strong>اللاعب الأحمر:</strong> يبدأ من الأسفل ويحاول الوصول للأعلى</li>
            <li>🔵 <strong>اللاعب الأزرق:</strong> يبدأ من الأعلى ويحاول الوصول للأسفل</li>
            <li>👣 <strong>الحركة:</strong> مربع واحد في أي اتجاه (أعلى، أسفل، يمين، يسار)</li>
            <li>🦘 <strong>القفز:</strong> إذا كان اللاعب الآخر مجاوراً، يمكنك القفز فوقه</li>
            <li>🧱 <strong>الجدران:</strong> لديك 8 جدران لمنع حركة الخصم</li>
            <li>🚫 <strong>قيد مهم:</strong> لا يمكن وضع جدار يمنع اللاعب من الوصول نهائياً</li>
          </ul>
          
          <h3>كيفية وضع الجدران:</h3>
          <ul>
            <li>🔄 استخدم زر "تبديل الوضع" للانتقال بين وضع التحريك ووضع الجدران</li>
            <li>📏 كل جدار يغطي مربعين متجاورين</li>
            <li>🎯 انقر على الخط بين المربعات لوضع الجدار</li>
            <li>↩️ يمكنك استخدام زر "تراجع" للعودة خطوة واحدة</li>
          </ul>
        </div>
        
        <div className="modal-buttons">
          <Button onClick={onStartGame} className="start-button">
            لاعب ضد لاعب 👥
          </Button>
          <div className="ai-buttons">
            <h3>اللعب ضد الكمبيوتر:</h3>
            <Button onClick={() => onStartAI('easy')} className="ai-button easy">
              سهل 🤖
            </Button>
            <Button onClick={() => onStartAI('medium')} className="ai-button medium">
              متوسط 🎯
            </Button>
            <Button onClick={() => onStartAI('hard')} className="ai-button hard">
              صعب 🧠
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [board, setBoard] = useState(createBoard());
  const [walls, setWalls] = useState(createWalls());
  const [players, setPlayers] = useState({
    1: { row: 8, col: 4, wallsLeft: WALLS_PER_PLAYER },
    2: { row: 0, col: 4, wallsLeft: WALLS_PER_PLAYER }
  });
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [gameMode, setGameMode] = useState('move');
  const [winner, setWinner] = useState(null);
  const [history, setHistory] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [audioContext, setAudioContext] = useState(null);
  const [isAIGame, setIsAIGame] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState('medium');

  // Initialize audio context
  useEffect(() => {
    const initAudio = () => {
      const ctx = createAudioContext();
      setAudioContext(ctx);
    };
    
    const handleFirstInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  // AI move logic
  useEffect(() => {
    if (isAIGame && currentPlayer === 2 && !winner) {
      const timer = setTimeout(() => {
        const aiMove = getAIMove(players, walls, aiDifficulty);
        if (aiMove) {
          movePlayer(aiMove.row, aiMove.col);
        }
      }, 1000); // 1 second delay for AI move
      
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, isAIGame, players, walls, aiDifficulty, winner]);

  // Check for winner
  useEffect(() => {
    if (players[1].row === 0) {
      setWinner(1);
      if (audioContext) {
        playSound(audioContext, 523, 0.2);
        setTimeout(() => playSound(audioContext, 659, 0.2), 200);
        setTimeout(() => playSound(audioContext, 784, 0.4), 400);
      }
    } else if (players[2].row === 8) {
      setWinner(2);
      if (audioContext) {
        playSound(audioContext, 523, 0.2);
        setTimeout(() => playSound(audioContext, 659, 0.2), 200);
        setTimeout(() => playSound(audioContext, 784, 0.4), 400);
      }
    }
  }, [players, audioContext]);

  const saveState = useCallback(() => {
    setHistory(prev => [...prev, { 
      board: JSON.parse(JSON.stringify(board)), 
      walls: JSON.parse(JSON.stringify(walls)), 
      players: JSON.parse(JSON.stringify(players)), 
      currentPlayer, 
      gameMode 
    }]);
  }, [board, walls, players, currentPlayer, gameMode]);

  const undoMove = useCallback(() => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setBoard(lastState.board);
      setWalls(lastState.walls);
      setPlayers(lastState.players);
      setCurrentPlayer(lastState.currentPlayer);
      setGameMode(lastState.gameMode);
      setHistory(prev => prev.slice(0, prev.length - 1));
      
      if (audioContext) {
        playSound(audioContext, 300, 0.1);
      }
    }
  }, [history, audioContext]);

  const isValidMove = (player, newRow, newCol) => {
    if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
      return false;
    }

    const currentRow = players[player].row;
    const currentCol = players[player].col;

    const otherPlayer = player === 1 ? 2 : 1;
    const otherPlayerRow = players[otherPlayer].row;
    const otherPlayerCol = players[otherPlayer].col;

    const rowDiff = Math.abs(newRow - currentRow);
    const colDiff = Math.abs(newCol - currentCol);

    // Normal move (one step)
    if (rowDiff + colDiff === 1) {
      // Check for walls blocking the path
      // Moving down (increasing row)
      if (newRow > currentRow && walls.horizontal[currentRow] && walls.horizontal[currentRow][currentCol]) return false;
      // Moving up (decreasing row)  
      if (newRow < currentRow && walls.horizontal[newRow] && walls.horizontal[newRow][currentCol]) return false;
      // Moving right (increasing col)
      if (newCol > currentCol && walls.vertical[currentRow] && walls.vertical[currentRow][currentCol]) return false;
      // Moving left (decreasing col)
      if (newCol < currentCol && walls.vertical[currentRow] && walls.vertical[currentRow][newCol]) return false;

      // Check if target position is occupied by another player
      if (newRow === otherPlayerRow && newCol === otherPlayerCol) {
        return false;
      }

      return true;
    }

    // Jump move (two steps) - only if other player is directly adjacent
    if (rowDiff === 2 && colDiff === 0) { // Vertical jump
      const middleRow = currentRow + (newRow > currentRow ? 1 : -1);
      
      // Check if other player is in the middle position
      if (middleRow === otherPlayerRow && currentCol === otherPlayerCol) {
        // Check for walls blocking the first step
        if (newRow > currentRow && walls.horizontal[currentRow] && walls.horizontal[currentRow][currentCol]) return false;
        if (newRow < currentRow && walls.horizontal[middleRow] && walls.horizontal[middleRow][currentCol]) return false;
        
        // Check for walls blocking the second step (jump)
        if (newRow > currentRow && walls.horizontal[middleRow] && walls.horizontal[middleRow][currentCol]) return false;
        if (newRow < currentRow && walls.horizontal[newRow] && walls.horizontal[newRow][currentCol]) return false;
        
        return true;
      }
    }
    
    if (colDiff === 2 && rowDiff === 0) { // Horizontal jump
      const middleCol = currentCol + (newCol > currentCol ? 1 : -1);
      
      // Check if other player is in the middle position
      if (currentRow === otherPlayerRow && middleCol === otherPlayerCol) {
        // Check for walls blocking the first step
        if (newCol > currentCol && walls.vertical[currentRow] && walls.vertical[currentRow][currentCol]) return false;
        if (newCol < currentCol && walls.vertical[currentRow] && walls.vertical[currentRow][middleCol]) return false;
        
        // Check for walls blocking the second step (jump)
        if (newCol > currentCol && walls.vertical[currentRow] && walls.vertical[currentRow][middleCol]) return false;
        if (newCol < currentCol && walls.vertical[currentRow] && walls.vertical[currentRow][newCol]) return false;
        
        return true;
      }
    }

    return false;
  };

  const movePlayer = (row, col) => {
    if (winner) return;

    if (gameMode === 'move' && isValidMove(currentPlayer, row, col)) {
      saveState();
      setPlayers(prev => ({
        ...prev,
        [currentPlayer]: { ...prev[currentPlayer], row, col }
      }));
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      
      if (audioContext) {
        playSound(audioContext, 440, 0.1);
      }
    }
  };

  const placeWall = (type, row, col) => {
    if (winner) return;
    if (gameMode !== 'wall' || players[currentPlayer].wallsLeft <= 0) return;

    const newWalls = JSON.parse(JSON.stringify(walls));
    let wallPlaced = false;
    
    if (type === 'horizontal' && row < BOARD_SIZE - 1 && col < BOARD_SIZE - 1) {
      // Check if both positions are free
      if (!newWalls.horizontal[row][col] && !newWalls.horizontal[row][col + 1]) {
        saveState();
        newWalls.horizontal[row][col] = true;
        newWalls.horizontal[row][col + 1] = true;
        wallPlaced = true;
      }
    } else if (type === 'vertical' && row < BOARD_SIZE - 1 && col < BOARD_SIZE - 1) {
      // Check if both positions are free
      if (!newWalls.vertical[row][col] && !newWalls.vertical[row + 1][col]) {
        saveState();
        newWalls.vertical[row][col] = true;
        newWalls.vertical[row + 1][col] = true;
        wallPlaced = true;
      }
    }

    if (wallPlaced) {
      setWalls(newWalls);
      setPlayers(prev => ({
        ...prev,
        [currentPlayer]: { 
          ...prev[currentPlayer], 
          wallsLeft: prev[currentPlayer].wallsLeft - 1 
        }
      }));
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      setGameMode('move');
      
      if (audioContext) {
        playSound(audioContext, 220, 0.2, 'square');
      }
    }
  };

  const resetGame = () => {
    setBoard(createBoard());
    setWalls(createWalls());
    setPlayers({
      1: { row: 8, col: 4, wallsLeft: WALLS_PER_PLAYER },
      2: { row: 0, col: 4, wallsLeft: WALLS_PER_PLAYER }
    });
    setCurrentPlayer(1);
    setGameMode('move');
    setWinner(null);
    setHistory([]);
    
    if (audioContext) {
      playSound(audioContext, 330, 0.15);
    }
  };

  const startAIGame = (difficulty) => {
    setIsAIGame(true);
    setAiDifficulty(difficulty);
    setShowWelcome(false);
    resetGame();
  };

  const startHumanGame = () => {
    setIsAIGame(false);
    setShowWelcome(false);
    resetGame();
  };

  const renderCell = (row, col) => {
    const isPlayer1 = players[1].row === row && players[1].col === col;
    const isPlayer2 = players[2].row === row && players[2].col === col;
    
    return (
      <div
        key={`${row}-${col}`}
        className={`cell ${isPlayer1 ? 'player1' : ''} ${isPlayer2 ? 'player2' : ''}`}
        onClick={() => movePlayer(row, col)}
      >
        {isPlayer1 && <div className="pawn pawn-1">♜</div>}
        {isPlayer2 && <div className="pawn pawn-2">♞</div>}
        
        {/* Horizontal wall slots - only show if not at the bottom edge */}
        {row < BOARD_SIZE - 1 && col < BOARD_SIZE - 1 && (
          <div
            className={`wall-slot horizontal ${walls.horizontal[row][col] ? 'wall-placed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              placeWall('horizontal', row, col);
            }}
          />
        )}
        
        {/* Vertical wall slots - only show if not at the right edge */}
        {col < BOARD_SIZE - 1 && row < BOARD_SIZE - 1 && (
          <div
            className={`wall-slot vertical ${walls.vertical[row][col] ? 'wall-placed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              placeWall('vertical', row, col);
            }}
          />
        )}
      </div>
    );
  };

  if (showWelcome) {
    return <WelcomeModal 
      onClose={() => setShowWelcome(false)} 
      onStartGame={startHumanGame}
      onStartAI={startAIGame}
    />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Wall Chess</h1>
        {winner ? (
          <div className="winner">
            🎉 {isAIGame && winner === 2 ? 'الكمبيوتر فاز!' : `اللاعب ${winner} فاز!`} 🎉
          </div>
        ) : (
          <div className="game-info">
            <div>اللاعب الحالي: {isAIGame && currentPlayer === 2 ? 'الكمبيوتر' : currentPlayer}</div>
            <div>الوضع: {gameMode === 'move' ? 'تحريك القطعة' : 'وضع جدار'}</div>
            {isAIGame && <div>مستوى الصعوبة: {aiDifficulty === 'easy' ? 'سهل' : aiDifficulty === 'medium' ? 'متوسط' : 'صعب'}</div>}
          </div>
        )}
      </header>

      <div className="game-container">
        <div className="player-info">
          <div className={`player-card ${currentPlayer === 1 ? 'active' : ''}`}>
            <div>♜ اللاعب 1</div>
            <div>الجدران المتبقية: {players[1].wallsLeft}</div>
          </div>
          <div className={`player-card ${currentPlayer === 2 ? 'active' : ''}`}>
            <div>♞ {isAIGame ? 'الكمبيوتر' : 'اللاعب 2'}</div>
            <div>الجدران المتبقية: {players[2].wallsLeft}</div>
          </div>
        </div>

        <div className="board">
          {board.map((row, rowIndex) =>
            row.map((_, colIndex) => renderCell(rowIndex, colIndex))
          )}
        </div>

        <div className="controls">
          <Button
            onClick={() => setGameMode(gameMode === 'move' ? 'wall' : 'move')}
            disabled={winner || players[currentPlayer].wallsLeft <= 0 || (isAIGame && currentPlayer === 2)}
            className="mode-button"
          >
            {gameMode === 'move' ? 'تبديل إلى وضع الجدار' : 'تبديل إلى وضع التحريك'}
          </Button>
          <Button onClick={undoMove} disabled={history.length === 0} className="undo-button">
            تراجع
          </Button>
          <Button onClick={resetGame} className="reset-button">
            لعبة جديدة
          </Button>
          <Button onClick={() => setShowWelcome(true)} className="menu-button">
            القائمة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;


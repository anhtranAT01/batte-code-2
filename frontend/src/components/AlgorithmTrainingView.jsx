import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icons';

// Presets for algorithm training
const ALGORITHMS = [
  {
    id: 'astar',
    name: 'A* Pathfinding (Flag Rusher)',
    badge: 'Đường đi ngắn nhất',
    difficulty: 'Nâng cao',
    complexity: 'O(b^d)',
    summary: 'Tìm đường tối ưu lao về cờ địch bằng hàm Heuristic f(n) = g(n) + h(n), né tránh chướng ngại vật và khắc tinh.',
    pseudocode: [
      'def a_star_search(start, goal, grid):',
      '    open_set = PriorityQueue()',
      '    open_set.put(start, priority=0)',
      '    came_from = {}',
      '    cost_so_far[start] = 0',
      '    while not open_set.empty():',
      '        current = open_set.get()',
      '        if current == goal: return reconstruct_path(came_from, current)',
      '        for neighbor in get_neighbors(current, grid):',
      '            new_cost = cost_so_far[current] + cost(current, neighbor)',
      '            if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:',
      '                cost_so_far[neighbor] = new_cost',
      '                priority = new_cost + manhattan_distance(neighbor, goal)',
      '                open_set.put(neighbor, priority)',
      '                came_from[neighbor] = current',
    ],
    steps: [
      {
        stepIndex: 0,
        activeLine: 2,
        title: 'Khởi tạo A* Search',
        desc: 'Đưa vị trí xuất phát P1 [Búa] tại ô (0,0) vào Open Set với f(0) = 0.',
        stats: { openNodes: 1, closedNodes: 0, currentPos: '(0,0)', targetPos: '(6,6)', fn: 12, gn: 0, hn: 12 },
        gridState: {
          highlight: [[0, 0]],
          path: [[0, 0]],
          visited: [[0, 0]],
          obstacles: [[2, 1], [2, 2], [3, 2], [4, 4]],
          target: [6, 6],
        },
      },
      {
        stepIndex: 1,
        activeLine: 6,
        title: 'Mở rộng các ô lân cận',
        desc: 'Xét các nước đi hợp lệ: (1,0) và (0,1). Tính khoảng cách Manhattan h(n) tới Cờ (6,6).',
        stats: { openNodes: 2, closedNodes: 1, currentPos: '(1,0)', targetPos: '(6,6)', fn: 11, gn: 1, hn: 10 },
        gridState: {
          highlight: [[1, 0]],
          path: [[0, 0], [1, 0]],
          visited: [[0, 0], [1, 0], [0, 1]],
          obstacles: [[2, 1], [2, 2], [3, 2], [4, 4]],
          target: [6, 6],
        },
      },
      {
        stepIndex: 2,
        activeLine: 12,
        title: 'Gặp vật cản (Obstacle)',
        desc: 'Ô (2,1) và (2,2) bị chặn bởi Tường đá. Thuật toán loại bỏ và chọn nhánh mở (1,1) -> (1,2).',
        stats: { openNodes: 4, closedNodes: 3, currentPos: '(1,2)', targetPos: '(6,6)', fn: 11, gn: 2, hn: 9 },
        gridState: {
          highlight: [[1, 2]],
          path: [[0, 0], [1, 0], [1, 1], [1, 2]],
          visited: [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]],
          obstacles: [[2, 1], [2, 2], [3, 2], [4, 4]],
          target: [6, 6],
        },
      },
      {
        stepIndex: 3,
        activeLine: 9,
        title: 'Bẻ hướng đường đi an toàn',
        desc: 'Vượt qua bức tường phòng thủ đối phương, di chuyển xuống (2,3) -> (3,3).',
        stats: { openNodes: 5, closedNodes: 6, currentPos: '(3,3)', targetPos: '(6,6)', fn: 10, gn: 4, hn: 6 },
        gridState: {
          highlight: [[3, 3]],
          path: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 3], [3, 3]],
          visited: [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2], [2, 3], [3, 3]],
          obstacles: [[2, 1], [2, 2], [3, 2], [4, 4]],
          target: [6, 6],
        },
      },
      {
        stepIndex: 4,
        activeLine: 13,
        title: 'Tăng tốc tiếp cận cứ điểm',
        desc: 'Tiếp tục chọn ô có f(n) nhỏ nhất: (4,3) -> (5,4) -> (5,5) tiếp cận cờ đối phương.',
        stats: { openNodes: 3, closedNodes: 9, currentPos: '(5,5)', targetPos: '(6,6)', fn: 8, gn: 6, hn: 2 },
        gridState: {
          highlight: [[5, 5]],
          path: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 4], [5, 5]],
          visited: [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 4], [5, 5]],
          obstacles: [[2, 1], [2, 2], [3, 2], [4, 4]],
          target: [6, 6],
        },
      },
      {
        stepIndex: 5,
        activeLine: 7,
        title: 'CƯỚP CỜ THÀNH CÔNG (Goal Reached)',
        desc: 'Quân ta chạm đích (6,6). Thuật toán hoàn tất tái dựng đường đi ngắn nhất!',
        stats: { openNodes: 0, closedNodes: 12, currentPos: '(6,6)', targetPos: '(6,6)', fn: 7, gn: 7, hn: 0 },
        gridState: {
          highlight: [[6, 6]],
          path: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 4], [5, 5], [6, 6]],
          visited: [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 4], [5, 5], [6, 6]],
          obstacles: [[2, 1], [2, 2], [3, 2], [4, 4]],
          target: [6, 6],
        },
      },
    ],
  },
  {
    id: 'minimax',
    name: 'Minimax & Alpha-Beta Pruning',
    badge: 'Chiến thuật đối kháng',
    difficulty: 'Thi đấu',
    complexity: 'O(b^(d/2))',
    summary: 'Mô phỏng cây trò chơi độ sâu d, tỉa bỏ các nhánh phụ không thể tốt hơn giới hạn [alpha, beta] đã biết.',
    pseudocode: [
      'def alpha_beta(state, depth, alpha, beta, is_maximizing):',
      '    if depth == 0 or state.is_terminal(): return evaluate(state)',
      '    if is_maximizing:',
      '        max_eval = -INFINITY',
      '        for move in state.get_legal_moves():',
      '            eval = alpha_beta(state.make_move(move), depth - 1, alpha, beta, False)',
      '            max_eval = max(max_eval, eval)',
      '            alpha = max(alpha, eval)',
      '            if beta <= alpha: break  # Tỉa nhánh Beta Cutoff',
      '        return max_eval',
      '    else:',
      '        min_eval = +INFINITY',
      '        for move in state.get_legal_moves():',
      '            eval = alpha_beta(state.make_move(move), depth - 1, alpha, beta, True)',
      '            min_eval = min(min_eval, eval)',
      '            beta = min(beta, eval)',
      '            if beta <= alpha: break  # Tỉa nhánh Alpha Cutoff',
      '        return min_eval',
    ],
    steps: [
      {
        stepIndex: 0,
        activeLine: 1,
        title: 'Khởi tạo Root Node (Lượt của Ta)',
        desc: 'Bắt đầu tại nút gốc (Max Node) với [alpha = -inf, beta = +inf]. Đánh giá các nước đi tiềm năng.',
        stats: { depth: 3, alpha: '-inf', beta: '+inf', evaluatedNodes: 1, cutoffs: 0 },
        gridState: {
          highlight: [[2, 2]],
          path: [[2, 2]],
          visited: [[2, 2]],
          obstacles: [[2, 3]],
          target: [5, 5],
        },
      },
      {
        stepIndex: 1,
        activeLine: 6,
        title: 'Mô phỏng Nước Đi 1: Lao Cờ Trực Diện',
        desc: 'Nhánh 1: Di chuyển quân Kéo lên trên. Đối thủ có thể dùng Búa đập lại. Điểm đánh giá: +12.',
        stats: { depth: 2, alpha: '+12', beta: '+inf', evaluatedNodes: 4, cutoffs: 0 },
        gridState: {
          highlight: [[3, 2]],
          path: [[2, 2], [3, 2]],
          visited: [[2, 2], [3, 2]],
          obstacles: [[2, 3]],
          target: [5, 5],
        },
      },
      {
        stepIndex: 2,
        activeLine: 8,
        title: 'Phát hiện Nhánh Tệ -> TỈA NHÁNH (Cutoff)',
        desc: 'Ở nhánh 2, đối thủ có nước phản công chắc chắn hạ cờ (eval <= +8 < alpha=+12). Tỉa bỏ toàn bộ cây con!',
        stats: { depth: 2, alpha: '+12', beta: '+8', evaluatedNodes: 6, cutoffs: 1 },
        gridState: {
          highlight: [[2, 1]],
          path: [[2, 2], [2, 1]],
          visited: [[2, 2], [3, 2], [2, 1]],
          obstacles: [[2, 3]],
          target: [5, 5],
        },
      },
      {
        stepIndex: 3,
        activeLine: 10,
        title: 'Chọn Nước Đi Tối Ưu Nhất',
        desc: 'Minimax chọn nước đi nhánh 1 với giá trị cực đại +12, đảm bảo an toàn kể cả khi đối thủ chơi tối ưu.',
        stats: { depth: 3, alpha: '+12', beta: '+12', evaluatedNodes: 9, cutoffs: 2 },
        gridState: {
          highlight: [[3, 2]],
          path: [[2, 2], [3, 2]],
          visited: [[2, 2], [3, 2], [2, 1]],
          obstacles: [[2, 3]],
          target: [5, 5],
        },
      },
    ],
  },
  {
    id: 'heuristic',
    name: 'Heuristic Evaluation Matrix',
    badge: 'Đánh giá thế cờ',
    difficulty: 'Cơ bản',
    complexity: 'O(1)',
    summary: 'Hàm đánh giá tính điểm tức thì dựa trên: số quân cờ, tương khắc Kéo-Búa-Bao, khoảng cách cờ và buff potion.',
    pseudocode: [
      'def evaluate_state(state):',
      '    score = 0',
      '    # 1. Trọng số chênh lệch quân số',
      '    score += (my_piece_count - enemy_piece_count) * 100',
      '    # 2. Lợi thế tương khắc trực tiếp',
      '    score += calculate_counter_advantage(my_pieces, enemy_pieces) * 40',
      '    # 3. Khoảng cách gần cờ đối phương',
      '    score += (18 - min_distance_to_enemy_flag) * 25',
      '    # 4. Kiểm soát bình Tăng tốc & Đồng hóa',
      '    score += controlled_potions_count * 15',
      '    return score',
    ],
    steps: [
      {
        stepIndex: 0,
        activeLine: 3,
        title: 'Bước 1: So sánh Lực Lượng Quân Số',
        desc: 'Ta có 3 quân (1 Búa, 1 Kéo, 1 Bao). Địch còn 2 quân (1 Kéo, 1 Bao). Lợi thế: +100 điểm.',
        stats: { pieceAdvantage: '+1 quân', counterScore: '+40', flagBonus: '+75', totalScore: '+215' },
        gridState: {
          highlight: [[1, 1], [1, 2], [2, 1]],
          path: [[1, 1]],
          visited: [[1, 1]],
          obstacles: [],
          target: [4, 4],
        },
      },
      {
        stepIndex: 1,
        activeLine: 5,
        title: 'Bước 2: Phân Tích Ma Trận Khắc Chế',
        desc: 'Quân Búa của ta đang kề cận quân Kéo của địch (Búa ăn Kéo). Lợi thế ăn quân ngay lập tức: +40 điểm.',
        stats: { pieceAdvantage: '+1 quân', counterScore: '+80', flagBonus: '+75', totalScore: '+255' },
        gridState: {
          highlight: [[1, 2], [1, 3]],
          path: [[1, 2], [1, 3]],
          visited: [[1, 2], [1, 3]],
          obstacles: [],
          target: [4, 4],
        },
      },
      {
        stepIndex: 2,
        activeLine: 7,
        title: 'Bước 3: Khoảng Cách Cướp Cờ',
        desc: 'Quân Bao chỉ cách cờ 2 bước đi (Khoảng cách Manhattan = 2). Ưu thế chiến thắng áp đảo: +75 điểm.',
        stats: { pieceAdvantage: '+1 quân', counterScore: '+80', flagBonus: '+150', totalScore: '+330' },
        gridState: {
          highlight: [[3, 4], [4, 4]],
          path: [[3, 4], [4, 4]],
          visited: [[3, 4], [4, 4]],
          obstacles: [],
          target: [4, 4],
        },
      },
    ],
  },
];

export default function AlgorithmTrainingView({ onGoToBots }) {
  const [selectedAlgo, setSelectedAlgo] = useState(ALGORITHMS[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800);
  const timerRef = useRef(null);

  const steps = selectedAlgo.steps;
  const currentStepData = steps[currentStep] || steps[0];

  // Handle auto playback
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, speedMs, steps.length]);

  const handleSelectAlgo = (algo) => {
    setIsPlaying(false);
    setSelectedAlgo(algo);
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  return (
    <div className="view-shell animate-fadeIn max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span>Phòng Thí Nghiệm Thuật Toán AI</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Mô phỏng trực quan từng bước các thuật toán cốt lõi: A* Pathfinding, Minimax Alpha-Beta và Heuristic Matrix.
          </p>
        </div>

        {onGoToBots && (
          <button
            type="button"
            onClick={onGoToBots}
            className="primary-action text-xs"
          >
            <Icon name="code" size={15} />
            <span>Nạp code vào Bot của tôi</span>
          </button>
        )}
      </div>

      {/* Algorithm Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ALGORITHMS.map((algo) => {
          const isSelected = algo.id === selectedAlgo.id;
          return (
            <div
              key={algo.id}
              onClick={() => handleSelectAlgo(algo)}
              className={`cyber-card p-5 cursor-pointer relative overflow-hidden transition-all ${
                isSelected
                  ? 'border-blue-500 shadow-glow-blue bg-blue-950/20'
                  : 'hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {algo.badge}
                </span>
                <span className="text-xs font-mono text-purple-400 font-bold">
                  {algo.complexity}
                </span>
              </div>
              <h3 className="font-extrabold text-base text-white tracking-tight mb-1">
                {algo.name}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {algo.summary}
              </p>

              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Visualizer Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Step Information & Grid Canvas (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="cyber-card p-5 sm:p-6 space-y-5">
            {/* Step Header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-extrabold">
                  Bước {currentStep + 1} / {steps.length}
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {currentStepData.title}
                </h3>
              </div>

              {/* Step indicator pills */}
              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStep(idx);
                    }}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentStep
                        ? 'w-6 bg-cyan-400 shadow-glow-cyan'
                        : idx < currentStep
                        ? 'w-2 bg-blue-500'
                        : 'w-2 bg-white/20'
                    }`}
                    title={`Chuyển tới bước ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Step Explanation */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-navy-950/60 p-3.5 rounded-xl border border-white/5">
              {currentStepData.desc}
            </p>

            {/* Mini Tactical Grid Simulation (7x7) */}
            <div className="bg-navy-950 p-4 rounded-xl border border-white/10 flex flex-col items-center">
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Đường đi A*</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Vật cản</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Cứ điểm / Cờ</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 w-full max-w-[340px] aspect-square">
                {Array.from({ length: 49 }).map((_, index) => {
                  const r = Math.floor(index / 7);
                  const c = index % 7;
                  const isObstacle = currentStepData.gridState.obstacles.some(([or, oc]) => or === r && oc === c);
                  const isTarget = currentStepData.gridState.target[0] === r && currentStepData.gridState.target[1] === c;
                  const isPath = currentStepData.gridState.path.some(([pr, pc]) => pr === r && pc === c);
                  const isHighlight = currentStepData.gridState.highlight.some(([hr, hc]) => hr === r && hc === c);

                  let cellClass = 'bg-navy-900/80 border-white/5';
                  if (isObstacle) cellClass = 'bg-red-950/70 border-red-500/50 text-red-400 font-bold';
                  else if (isTarget) cellClass = 'bg-amber-950/80 border-amber-400 text-amber-300 font-black animate-pulse';
                  else if (isHighlight) cellClass = 'bg-cyan-500 text-black font-black shadow-glow-cyan z-10 scale-105';
                  else if (isPath) cellClass = 'bg-blue-600/40 border-blue-400/60 text-blue-200';

                  return (
                    <div
                      key={index}
                      className={`rounded-md border flex items-center justify-center text-[10px] font-mono transition-all duration-200 ${cellClass}`}
                    >
                      {isTarget ? '🚩' : isObstacle ? '🧱' : isHighlight ? '🤖' : isPath ? '•' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {Object.entries(currentStepData.stats).map(([k, v]) => (
                <div key={k} className="p-2.5 rounded-lg bg-navy-950/80 border border-white/5 text-center">
                  <span className="block text-[10px] font-mono uppercase text-slate-400 font-bold truncate">
                    {k}
                  </span>
                  <strong className="text-sm font-extrabold text-cyan-400 font-mono">
                    {v}
                  </strong>
                </div>
              ))}
            </div>

            {/* Playback Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="icon-button text-xs"
                  title="Bắt đầu lại từ bước 1"
                >
                  <Icon name="rotateCcw" size={16} />
                </button>
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="icon-button text-xs disabled:opacity-40"
                  title="Bước trước"
                >
                  <Icon name="stepBack" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="primary-action px-4 text-xs"
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
                  <span>{isPlaying ? 'Tạm Dừng' : 'Tự Động Chạy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentStep === steps.length - 1}
                  className="icon-button text-xs disabled:opacity-40"
                  title="Bước kế tiếp"
                >
                  <Icon name="stepForward" size={16} />
                </button>
              </div>

              {/* Speed Slider */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Tốc độ:</span>
                <select
                  value={speedMs}
                  onChange={(e) => setSpeedMs(Number(e.target.value))}
                  className="px-2.5 py-1 text-xs rounded-lg bg-navy-900 border border-white/10 text-white"
                >
                  <option value={1400}>0.5x (Chậm)</option>
                  <option value={800}>1.0x (Chuẩn)</option>
                  <option value={400}>2.0x (Nhanh)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Pseudocode & Trace Inspection (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="cyber-card p-5 space-y-3 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Icon name="code" size={16} className="text-purple-400" />
                <h4 className="font-bold text-sm text-white">Mã Giả Thuật Toán (Pseudocode)</h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold">Python Syntax</span>
            </div>

            <div className="flex-1 bg-navy-950 p-3.5 rounded-xl border border-white/10 font-mono text-xs overflow-x-auto space-y-1">
              {selectedAlgo.pseudocode.map((line, idx) => {
                const isActive = idx === currentStepData.activeLine;
                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-3 ${
                      isActive
                        ? 'bg-blue-600/30 text-cyan-300 font-bold border-l-2 border-cyan-400 shadow-inner-glow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-[10px] text-slate-600 w-5 select-none text-right font-mono">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 space-y-1">
              <strong className="block font-bold">Mẹo tối ưu hoá khi nộp Bot:</strong>
              <p className="text-[11px] text-purple-200/80 leading-relaxed">
                Kết hợp hàm Heuristic đánh giá tương khắc với A* để bot vừa ưu tiên cướp cờ vừa không bị quân cờ đối phương phục kích trên đường đi!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

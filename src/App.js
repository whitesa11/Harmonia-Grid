import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, RefreshCw, Play, Pause, Save, Upload } from 'lucide-react';

const CalmComposer = () => {
  // ウィンドウサイズの状態管理
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // グリッドの設定 - 固定サイズにする
  const [gridSize, setGridSize] = useState({ rows: 13, cols: 16 });
  const [grid, setGrid] = useState([]);
  const [selectedInstrument, setSelectedInstrument] = useState('synth');
  const [volume, setVolume] = useState(0.5);
  
  // 再生関連の状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentColumn, setCurrentColumn] = useState(-1);
  const playbackRef = useRef(null);
  
  // マウスの状態を追跡
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isAddMode, setIsAddMode] = useState(true); // マウスダウン時の最初のセルの状態で追加か削除かを決定
  const [lastCell, setLastCell] = useState({ row: -1, col: -1 });
  
  // AudioContextの初期化状態
  const [audioContextInitialized, setAudioContextInitialized] = useState(false);
  
  // 音楽再生用の参照
  const audioContextRef = useRef(null);
  
  // スケールの設定（ペンタトニックスケール - リラクゼーション向き）
  const pentatonicScale = [
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50, // C6
    1174.66, // D6
    1318.51, // E6
    1567.98, // G6
    1760.00, // A6
    2093.00, // C7
    2349.32, // D7
    2637.02  // E7
  ].reverse(); // 上から下へ表示するために反転
  
  // 色のパレット（リラックス効果のある色合い）
  const colors = {
    background: 'bg-gradient-to-r from-blue-50 to-purple-50',
    gridBackground: 'bg-white',
    hoveredCell: 'bg-indigo-200',
    playbackIndicator: 'bg-blue-200 opacity-30',
    controls: 'bg-white',
    button: 'bg-indigo-500 hover:bg-indigo-600 text-white',
    buttonSecondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    playButton: 'bg-green-500 hover:bg-green-600 text-white',
    pauseButton: 'bg-amber-500 hover:bg-amber-600 text-white'
  };
  
  // 楽器の音色設定と色
  const instruments = [
    { id: 'synth', name: 'シンセ', type: 'sine', color: 'bg-indigo-400', dotColor: 'bg-white' },
    { id: 'bell', name: 'ベル', type: 'triangle', color: 'bg-teal-400', dotColor: 'bg-white' },
    { id: 'soft', name: 'ソフト', type: 'sine', color: 'bg-purple-400', dotColor: 'bg-white' },
    { id: 'warm', name: '温かみ', type: 'sine', color: 'bg-amber-400', dotColor: 'bg-white' }
  ];
  
  // 背景パターン
  const backgroundPatterns = [
    { id: 'waves', name: '波', className: 'from-blue-50 to-purple-50' },
    { id: 'sunset', name: '夕暮れ', className: 'from-orange-50 to-pink-50' },
    { id: 'forest', name: '森', className: 'from-green-50 to-teal-50' },
    { id: 'night', name: '夜', className: 'from-indigo-50 to-purple-100' }
  ];
  
  const [currentPattern, setCurrentPattern] = useState(backgroundPatterns[0]);
  
  // AudioContextの初期化関数
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().then(() => {
        console.log('AudioContext resumed successfully');
        setAudioContextInitialized(true);
      }).catch(err => {
        console.error('Failed to resume AudioContext:', err);
      });
    } else {
      console.log('AudioContext is already running');
      setAudioContextInitialized(true);
    }
  }, []);
  
  // 音を鳴らす関数 - useCallbackでメモ化して依存関係の問題を解決
  const playNote = useCallback((row, time) => {
    if (!audioContextRef.current || !audioContextInitialized) return;
    
    try {
      // timeが指定されていない場合、現在時刻を使用
      const currentTime = time || audioContextRef.current.currentTime;
      
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      // 楽器タイプに基づいた設定
      switch (selectedInstrument) {
        case 'bell':
          oscillator.type = 'triangle';
          // ベル風の音にするためのエンベロープ設定
          gainNode.gain.setValueAtTime(volume, currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 1.5);
          break;
        case 'soft':
          oscillator.type = 'sine';
          // ソフトな音にするためのエンベロープ設定
          gainNode.gain.setValueAtTime(0, currentTime);
          gainNode.gain.linearRampToValueAtTime(volume * 0.7, currentTime + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 2.0);
          break;
        case 'warm':
          oscillator.type = 'sine';
          // 温かみのある音にするためのエンベロープ設定
          gainNode.gain.setValueAtTime(0, currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(volume * 0.6, currentTime + 0.2);
          gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.8);
          
          // 温かみを出すために倍音を追加
          const harmonicOsc = audioContextRef.current.createOscillator();
          const harmonicGain = audioContextRef.current.createGain();
          harmonicOsc.frequency.setValueAtTime(pentatonicScale[row] * 2, currentTime);
          harmonicGain.gain.setValueAtTime(volume * 0.2, currentTime);
          harmonicGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.5);
          harmonicOsc.connect(harmonicGain);
          harmonicGain.connect(audioContextRef.current.destination);
          harmonicOsc.start(currentTime);
          harmonicOsc.stop(currentTime + 1.8);
          break;
        default: // synth
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(volume, currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.0);
      }
      
      oscillator.frequency.setValueAtTime(pentatonicScale[row], currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + 2.0); // 2秒後に音を止める
    } catch (error) {
      console.error('音声再生エラー:', error);
    }
  }, [selectedInstrument, volume, pentatonicScale, audioContextInitialized]);

// ウィンドウサイズを監視するuseEffect
useEffect(() => {
  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };
  
  // 初期値を設定
  handleResize();
  
  // イベントリスナーを追加
  window.addEventListener('resize', handleResize);
  
  // クリーンアップ
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);

  
  useEffect(() => {
    // 画面サイズに基づいてグリッドの列数を調整する関数
    const adjustGridSize = () => {
      const width = window.innerWidth;
      
      let cols;
      // 画面サイズに応じて列数を決定
      if (width < 375) {
        cols = 8; // 小さいスマートフォン
      } else if (width < 640) {
        cols = 10; // 通常のスマートフォン
      } else if (width < 768) {
        cols = 12; // 大きめのスマートフォン
      } else {
        cols = 16; // タブレット以上
      }
      
      // 列数が変わった場合のみ更新
      if (cols !== gridSize.cols) {
        // 既存のグリッドデータを保持しながら、新しいグリッドサイズに調整する
        const newGrid = Array(gridSize.rows).fill()
          .map((_, rowIndex) => {
            if (!grid[rowIndex]) return Array(cols).fill(false);
            // 既存のデータを新しいサイズにコピー（範囲内のみ）
            return Array(cols).fill(false).map((_, colIndex) => {
              return colIndex < grid[rowIndex].length ? grid[rowIndex][colIndex] : false;
            });
          });
        
        setGrid(newGrid);
        setGridSize(prev => ({ ...prev, cols }));
        
        // 再生中の場合、現在のカラムを調整
        if (isPlaying && currentColumn >= cols) {
          setCurrentColumn(0);
        }
      }
    };
    
    // 初期調整
    adjustGridSize();
    
    // リサイズイベントリスナーの追加
    window.addEventListener('resize', adjustGridSize);
    
    // クリーンアップ
    return () => {
      window.removeEventListener('resize', adjustGridSize);
    };
  }, [gridSize.cols, gridSize.rows, grid, isPlaying, currentColumn]);
  

  // グリッドの初期化
  useEffect(() => {
    // 新しいグリッドが設定されていない場合のみ初期グリッドを作成
    if (grid.length === 0) {
      const newGrid = Array(gridSize.rows).fill()
        .map(() => Array(gridSize.cols).fill(false));
      setGrid(newGrid);
    }
    
    // AudioContextは初期化しない - ユーザーアクションを待つ
    return () => {
      // クリーンアップ
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [grid.length, gridSize.cols, gridSize.rows]); // マウント時のみ実行

   // 横スクロール防止のためのeffect
   useEffect(() => {
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
    };
  }, []);
  
  // グローバルなマウスイベントの設定
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
      setLastCell({ row: -1, col: -1 });
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mouseleave', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, []);
  
  // 再生機能の管理
  useEffect(() => {
    if (isPlaying) {
      // 再生開始前にAudioContextが初期化されていることを確認
      if (!audioContextInitialized) {
        initializeAudioContext();
      }
      
      // 再生開始
      let column = currentColumn < 0 ? 0 : currentColumn;
      
      const playColumn = () => {
        // 現在の列のアクティブなセルを鳴らす
        for (let row = 0; row < gridSize.rows; row++) {
          if (grid[row][column]) {
            playNote(row);
          }
        }
        
        // 次の列に進む
        column = (column + 1) % gridSize.cols;
        setCurrentColumn(column);
      };
      
      // 再生速度に応じた間隔でタイマーをセット
      const speed = 300 / playbackSpeed; // ベース速度を300ミリ秒に設定
      playbackRef.current = setInterval(playColumn, speed);
      
      return () => {
        clearInterval(playbackRef.current);
      };
    } else {
      // 再生終了時の処理
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
      return undefined;
    }
  }, [isPlaying, grid, playbackSpeed, gridSize, currentColumn, playNote, audioContextInitialized, initializeAudioContext]);
  
  // マウスダウンの処理
  const handleMouseDown = (row, col) => {
    // AudioContextの初期化 - ユーザーインタラクション時に実行
    if (!audioContextInitialized) {
      initializeAudioContext();
    }
    
    setIsMouseDown(true);
    setLastCell({ row, col });
    
    // 現在のセルの状態に基づいて、追加モードか削除モードかを設定
    const cellValue = grid[row][col];
    setIsAddMode(!cellValue);
    
    // セルの状態を更新
    const newGrid = [...grid];
    newGrid[row][col] = !cellValue;
    setGrid(newGrid);
    
    // 追加モードのときのみ音を鳴らす
    if (!cellValue && audioContextInitialized) {
      playNote(row);
    }
  };
  
  // マウスオーバーの処理（ドラッグ時）
const handleMouseOver = useCallback((row, col) => {
  if (!isMouseDown || (lastCell.row === row && lastCell.col === col)) {
    return;
  }
  
  setLastCell({ row, col });
  
  const newGrid = [...grid];
  // 追加モードか削除モードかに基づいてセルを更新
  newGrid[row][col] = isAddMode;
  setGrid(newGrid);
  
  // 追加モードのときのみ音を鳴らす
  if (isAddMode && audioContextInitialized) {
    playNote(row);
  }
}, [isMouseDown, lastCell.row, lastCell.col, isAddMode, grid, audioContextInitialized, playNote]);
  
  // グリッドをクリア
  const clearGrid = () => {
    const newGrid = Array(gridSize.rows).fill()
      .map(() => Array(gridSize.cols).fill(false));
    setGrid(newGrid);
    setIsPlaying(false);
    setCurrentColumn(-1);
  };

  // ランダムなパターンを生成（リラクゼーション向きのパターン）
  const generateRandomPattern = () => {
    const newGrid = Array(gridSize.rows).fill()
      .map(() => Array(gridSize.cols).fill(false));
    
    // 適度な密度でランダムに配置（約15%のセルをアクティブに）
    for (let col = 0; col < gridSize.cols; col++) {
      // 各列に1〜3個の音符を配置
      const notesInColumn = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < notesInColumn; i++) {
        // リラクゼーション向きにするため、低音と高音を避けて中音域を多めに
        let row;
        if (Math.random() < 0.7) {
          // 70%の確率で中音域（4-9）
          row = Math.floor(Math.random() * 6) + 4;
        } else {
          // 30%の確率で全域
          row = Math.floor(Math.random() * gridSize.rows);
        }
        newGrid[row][col] = true;
      }
    }
    
    setGrid(newGrid);
  };
  
  // 再生/停止の切り替え
  const togglePlayback = () => {
    // 再生時にAudioContextを初期化
    if (!audioContextInitialized) {
      initializeAudioContext();
    }
    setIsPlaying(!isPlaying);
  };
  
  // 背景パターンの変更
  const changeBackgroundPattern = (pattern) => {
    setCurrentPattern(pattern);
  };
  
 // コンポジションの保存機能を更新
const saveComposition = () => {
  try {
    // コンポジションデータの作成
    const compositionData = {
      grid,
      gridSize: {
        rows: gridSize.rows,
        cols: gridSize.cols
      },
      instrument: selectedInstrument,
      background: currentPattern.id,
      version: '1.2' // バージョン更新
    };
    
    // JSON形式で保存
    const jsonData = JSON.stringify(compositionData);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // ダウンロードリンクの作成と実行
    const a = document.createElement('a');
    a.href = url;
    a.download = `calm-composition-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('コンポジションを保存しました！');
  } catch (e) {
    console.error('保存エラー:', e);
    alert('保存に失敗しました。');
  }
};

// コンポジションのロード機能を更新
const loadComposition = (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const compositionData = JSON.parse(e.target.result);
        
        // データの検証
        if (!compositionData.grid || !compositionData.instrument) {
          throw new Error('無効なコンポジションデータです');
        }
        
        // グリッドサイズの読み込み（データに含まれている場合）
        if (compositionData.gridSize) {
          setGridSize(compositionData.gridSize);
        } else {
          // 旧バージョンとの互換性のため
          setGridSize({
            rows: compositionData.grid.length,
            cols: compositionData.grid[0].length
          });
        }
        
        // データのロード
        setGrid(compositionData.grid);
        setSelectedInstrument(compositionData.instrument);
        
        // 背景設定がある場合はそれも読み込み
        if (compositionData.background) {
          const bgPattern = backgroundPatterns.find(p => p.id === compositionData.background);
          if (bgPattern) {
            setCurrentPattern(bgPattern);
          }
        }
        
        alert('コンポジションをロードしました！');
      } catch (parseError) {
        console.error('解析エラー:', parseError);
        alert('無効なコンポジションファイルです。');
      }
    };
    reader.readAsText(file);
  } catch (e) {
    console.error('ロードエラー:', e);
    alert('読み込みに失敗しました。');
  }
  
  // input要素の値をリセット（同じファイルを連続で選択できるように）
  event.target.value = null;
};
  
  // タッチイベントの処理を改善
  const handleTouchStart = (e, row, col) => {
    // AudioContextの初期化 - ユーザーインタラクション時に実行
    if (!audioContextInitialized) {
      initializeAudioContext();
    }
    
    setIsMouseDown(true);
    setLastCell({ row, col });
    
    // 現在のセルの状態を取得
    const cellValue = grid[row][col];
    setIsAddMode(!cellValue);
    
    // セルの状態を更新
    const newGrid = [...grid];
    newGrid[row][col] = !cellValue;
    setGrid(newGrid);
    
    // 追加モードのときのみ音を鳴らす
    if (!cellValue && audioContextInitialized) {
      playNote(row);
    }
  };
  
  // タッチムーブの処理を改善（パッシブイベントリスナーの問題を解決）
  const handleTouchMove = useCallback((e) => {
    if (!isMouseDown) return;
    
    // タッチイベントから座標を取得
    const touch = e.touches[0];
    const gridElement = document.querySelector('.grid-container');
    if (!gridElement) return;
    
    const rect = gridElement.getBoundingClientRect();
    
    // タッチ位置からグリッド上の位置を計算
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // グリッドのセルサイズ（推定）
    const cellWidth = rect.width / gridSize.cols;
    const cellHeight = rect.height / gridSize.rows;
    
    // タッチしたセルの計算
    const col = Math.floor(touchX / cellWidth);
    const row = Math.floor(touchY / cellHeight);
    
    // グリッド範囲内かチェック
    if (row >= 0 && row < gridSize.rows && col >= 0 && col < gridSize.cols) {
      handleMouseOver(row, col);
    }
  }, [isMouseDown, gridSize.cols, gridSize.rows, handleMouseOver]);
  
  // ファイル選択用の隠しinput
  const fileInputRef = useRef(null);
  
  // ファイル選択ダイアログを開く
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // グリッドコンテナにタッチイベントを追加
  useEffect(() => {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;
    
    const touchMoveHandler = (e) => {
      handleTouchMove(e);
    };
    
    gridContainer.addEventListener('touchmove', touchMoveHandler, { passive: true });
    
    return () => {
      gridContainer.removeEventListener('touchmove', touchMoveHandler);
    };
  }, [handleTouchMove]);

    // セルのスタイル関数を更新して、レスポンシブ対応にする
    const getCellStyle = useCallback(() => {
      // 画面サイズに応じてセルサイズを調整
      let cellSize;
      if (windowWidth < 375) {
        cellSize = '25px'; // 小さいスマートフォン
      } else if (windowWidth < 640) {
        cellSize = '28px'; // 通常のスマートフォン
      } else {
        cellSize = '30px'; // タブレット以上
    }
    
    return {
      width: cellSize,
      height: cellSize,
      minWidth: cellSize,
    };
  }, [windowWidth]); // windowWidthが変わったときだけ再計算
  
  return (
    <div 
      className={`min-h-screen ${colors.background} flex flex-col items-center py-8 px-4 bg-gradient-to-r ${currentPattern.className}`}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Harmonia Grid</h1>
      <p className="text-gray-600 mb-6">リラックスするための音楽パターンを描きましょう</p>
      
      {/* メインの音楽グリッド */}
      <div 
        className={`${colors.gridBackground} rounded-lg shadow-lg p-1 mb-6 mx-auto`}
        style={{ 
          width: 'fit-content', 
          overflow: 'hidden',
          maxWidth: '100%'
        }}
      >
        <div className="grid-container">
          {grid.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex">
              {row.map((cell, colIndex) => {
                const instrumentInfo = instruments.find(i => i.id === selectedInstrument);
                return (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`
                      border border-gray-100 cursor-pointer transition-all duration-200
                      ${cell ? instrumentInfo.color : 'bg-gray-50'}
                      ${colIndex === currentColumn ? colors.playbackIndicator : ''}
                      ${rowIndex % 2 === 0 ? 'opacity-90' : 'opacity-100'}
                    `}
                    style={getCellStyle()}
                    onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                    onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                    onTouchStart={(e) => handleTouchStart(e, rowIndex, colIndex)}
                  >
                    {cell && 
                      <div 
                        className={`rounded-full ${instrumentInfo.dotColor} opacity-70 m-auto`}
                        style={{ width: '10px', height: '10px' }}
                      ></div>
                    }
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* 再生コントロール */}
      <div className={`${colors.controls} rounded-lg shadow-md p-3 sm:p-4 w-full max-w-md mx-auto mb-4`}>
        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4">
          {/* 再生/停止ボタン */}
          <button 
            className={`${isPlaying ? colors.pauseButton : colors.playButton} px-3 py-1.5 sm:px-4 sm:py-2 rounded-md flex items-center gap-1 sm:gap-2 text-sm sm:text-base`}
            onClick={togglePlayback}
          >
            {isPlaying ? <><Pause size={16} /> 停止</> : <><Play size={16} /> 再生</>}
          </button>
          
          {/* 再生速度 */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-1">速さ</div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                className={`${colors.buttonSecondary} px-2 py-1 rounded-md text-xs`}
                onClick={() => setPlaybackSpeed(Math.max(0.5, playbackSpeed - 0.25))}
              >
                -
              </button>
              <span className="text-xs sm:text-sm w-12 sm:w-16 text-center">{playbackSpeed.toFixed(2)}x</span>
              <button 
                className={`${colors.buttonSecondary} px-2 py-1 rounded-md text-xs`}
                onClick={() => setPlaybackSpeed(Math.min(2.0, playbackSpeed + 0.25))}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* コントロールパネル */}
      <div className={`${colors.controls} rounded-lg shadow-md p-3 sm:p-4 w-full max-w-md mx-auto`}>
        <div className="flex flex-wrap justify-between items-center gap-2 sm:gap-4">
          {/* 音量コントロール */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Volume2 size={16} className="text-gray-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 sm:w-24"
            />
            <span className="text-xs sm:text-sm">音量</span>
          </div>
          
          {/* ボタン群 */}
          <div className="flex gap-1 sm:gap-2">
            {/* パターン生成ボタン */}
            <button 
              className={`${colors.buttonSecondary} px-2 py-1 sm:px-3 sm:py-2 rounded-md flex items-center gap-1 text-xs sm:text-sm`}
              onClick={generateRandomPattern}
            >
              <RefreshCw size={14} />
              <span className="hidden xs:inline">ランダム</span>
            </button>
            
            {/* クリアボタン */}
            <button 
              className={`${colors.buttonSecondary} px-2 py-1 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm`}
              onClick={clearGrid}
            >
              クリア
            </button>
          </div>
        </div>
        
        {/* 楽器選択 */}
        <div className="mt-3 sm:mt-4">
          <div className="text-xs text-gray-500 mb-1">楽器</div>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {instruments.map(instrument => (
              <button
                key={instrument.id}
                className={`px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded-md ${selectedInstrument === instrument.id ? colors.button : colors.buttonSecondary}`}
                onClick={() => setSelectedInstrument(instrument.id)}
              >
                {instrument.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* 背景パターン選択 */}
        <div className="mt-3 sm:mt-4">
          <div className="text-xs text-gray-500 mb-1">背景パターン</div>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {backgroundPatterns.map(pattern => (
              <button
                key={pattern.id}
                className={`px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded-md ${currentPattern.id === pattern.id ? colors.button : colors.buttonSecondary}`}
                onClick={() => changeBackgroundPattern(pattern)}
              >
                {pattern.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* 保存とロード */}
        <div className="mt-3 sm:mt-4">
          <div className="text-xs text-gray-500 mb-1">コンポジション</div>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              className={`${colors.buttonSecondary} px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded-md flex items-center gap-1`}
              onClick={saveComposition}
            >
              <Save size={14} />
              保存
            </button>
            <button
              className={`${colors.buttonSecondary} px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded-md flex items-center gap-1`}
              onClick={openFileDialog}
            >
              <Upload size={14} />
              読み込み
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={loadComposition}
            />
          </div>
        </div>
      </div>
      
      {/* 使い方ガイド */}
      <div className="mt-6 sm:mt-8 text-gray-600 text-xs sm:text-sm max-w-md mx-auto text-center px-2">
        <p>マス目をクリック＆ドラッグで音符を配置できます。音符を置くと同時に音が鳴ります。</p>
        <p className="mt-1 sm:mt-2">リラックスするためのペンタトニックスケールを使用しているので、どの組み合わせも心地よく響きます。</p>
        <p className="mt-1 sm:mt-2">再生ボタンを押すと、左から右へと順番に音が鳴ります。保存ボタンでお気に入りの曲を保存することもできます。</p>
      </div>
    </div>
  );
};

export default CalmComposer;
// =========================================================================
// MULTIPLAYER FIRST-PERSON SHOOTER CORE ENGINE - BACKEND (server.js)
// =========================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// 1. 初始化伺服器與路由配置 (Server Setup)
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // 允許所有來源連接以利雲端部署 (如 Render)
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// 靜態檔案路由：將前端目錄 (public) 暴露給瀏覽器
app.use(express.static(path.join(__dirname, 'index.html')));

// =====================================================================
// 2. 伺服器全局狀態管理機 (SERVER GLOBAL STATE)
// =====================================================================
// 儲存所有在線玩家的即時動態數據
const globalPlayersState = {};

// 模擬玩家名字庫，用於隨機生成擊殺通知
const TACTICAL_NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Ghost", "Viper", "Specter"];

// =====================================================================
// 3. SOCKET.IO 即時網路事件通訊中樞 (NETWORKING RECEPTOR)
// =====================================================================
io.on('connection', (socket) => {
    const playerId = socket.id;
    
    // 隨機分配一個戰術代號與預設座標
    const playerRandomName = TACTICAL_NAMES[Math.floor(Math.random() * TACTICAL_NAMES.length)] + `_${Math.floor(100 + Math.random() * 900)}`;
    
    console.log(`[CONNECTED] Agent ${playerRandomName} entered the grid. ID: ${playerId}`);

    // A. 初始化玩家狀態
    globalPlayersState[playerId] = {
        id: playerId,
        name: playerRandomName,
        x: (Math.random() - 0.5) * 20, // 隨機分散出生點避免重疊
        y: 1.6,                       // 基準高度對應 eyeHeight
        z: (Math.random() - 0.5) * 20,
        yaw: 0,
        health: 100
    };

    // B. 向剛連線的客戶端發送其專屬身分識別
    socket.emit('init', { id: playerId, name: playerRandomName });

    // C. 異步接收客戶端物理運動矩陣更新 (High-frequency position update)
    socket.on('playerUpdate', (data) => {
        if (globalPlayersState[playerId]) {
            globalPlayersState[playerId].x = data.x;
            globalPlayersState[playerId].y = data.y;
            globalPlayersState[playerId].z = data.z;
            globalPlayersState[playerId].yaw = data.yaw;
        }
    });

    // D. 接收開火事件 (可擴充用於伺服器端音效廣播或防作弊驗證)
    socket.on('playerFire', () => {
        // 可以在此向周圍玩家發送開火音效事件廣播
    });

    // E. 核心射擊命中判定解碼 (Hit Registration Processing)
    socket.on('playerShot', (targetId) => {
        const attacker = globalPlayersState[playerId];
        const target = globalPlayersState[targetId];

        if (attacker && target) {
            console.log(`[HIT] ${attacker.name} hit ${target.name}`);
            
            // 扣除敵方生命值 (可依據前端武器庫設計進行不同的傷害加權)
            target.health -= 25; 

            // 判定擊殺
            if (target.health <= 0) {
                console.log(`[KILL] ${attacker.name} eliminated ${target.name}`);
                
                // 向全服廣播擊殺動態通知欄 (Killfeed)
                io.emit('killEvent', {
                    attacker: attacker.name,
                    target: target.name
                });

                // 重置被擊殺玩家狀態 (Respawn 物理復位)
                target.health = 100;
                target.x = (Math.random() - 0.5) * 30;
                target.z = (Math.random() - 0.5) * 30;
                target.y = 1.6;
            }
        }
    });

    // F. 斷線清理機制 (Connection Cleanup)
    socket.on('disconnect', () => {
        if (globalPlayersState[playerId]) {
            console.log(`[DISCONNECTED] Agent ${globalPlayersState[playerId].name} left the battlefield.`);
            delete globalPlayersState[playerId];
        }
    });
});

// =====================================================================
// 4. 定時高頻率世界狀態廣播循環 (TICK RATE HEARTBEAT - 60Hz)
// =====================================================================
// 以每秒 60 次的頻率將全服玩家的最新空間數據打包，發送給所有客戶端進行 Lerp 渲染
const TICK_RATE = 60;
setInterval(() => {
    io.emit('gameState', globalPlayersState);
}, 1000 / TICK_RATE);

// =====================================================================
// 5. 啟動後端引擎監聽端口
// =====================================================================
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` FPS MULTIPLAYER CORE SERVER ONLINE ON PORT: ${PORT}`);
    console.log(` Tick Heartbeat running stable at ${TICK_RATE}Hz.`);
    console.log(`==================================================`);
});

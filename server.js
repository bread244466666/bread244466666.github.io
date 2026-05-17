const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// =========================================================================
// 【重要修正】啟用靜態檔案路由，解決 "Cannot GET /" 錯誤
// =========================================================================
// 讓 Express 自動伺服同目錄下的前端檔案 (index.html, app.js 等)
app.use(express.static(__dirname));

// 強制將根路徑 (/) 指向 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 全局遊戲狀態與地圖配置
// =========================================================================
const rooms = {}; 
const MAP_BOUNDS = 58; 

// 預設地圖障礙物 (AABB 碰撞盒)
const DEFAULT_OBSTACLES = [
    { x: 0, y: 2, z: -15, w: 12, h: 4, d: 4, color: 0x00ffcc },
    { x: -18, y: 3, z: 10, w: 6, h: 6, d: 6, color: 0xff00ff },
    { x: 18, y: 3, z: 10, w: 6, h: 6, d: 6, color: 0xffff00 },
    { x: -12, y: 1.5, z: -25, w: 4, h: 3, d: 16, color: 0x0088ff },
    { x: 12, y: 1.5, z: -25, w: 4, h: 3, d: 16, color: 0xff3300 },
    { x: 0, y: 5, z: 22, w: 20, h: 2, d: 6, color: 0xffaa00 }
];

// =========================================================================
// Socket.io 連線與房間邏輯
// =========================================================================
io.on('connection', (socket) => {
    let currentRoomId = null;

    // 1. 創建房間
    socket.on('createRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        createRoomInstance(roomId);
        socket.emit('roomCreated', roomId);
    });

    // 2. 加入房間
    socket.on('joinRoom', (data) => {
        const { roomId, name } = data;
        const cleanedRoomId = roomId.trim().toUpperCase();

        if (!rooms[cleanedRoomId]) {
            createRoomInstance(cleanedRoomId);
        }

        const room = rooms[cleanedRoomId];
        currentRoomId = cleanedRoomId;

        // 分配隊伍 (平衡人數)
        let alphaCount = 0; let omegaCount = 0;
        for (let pId in room.players) {
            if (room.players[pId].team === "ALPHA") alphaCount++;
            else if (room.players[pId].team === "OMEGA") omegaCount++;
        }
        const assignedTeam = (alphaCount <= omegaCount) ? "ALPHA" : "OMEGA";

        // 初始化玩家後端數據
        room.players[socket.id] = {
            id: socket.id,
            name: name || "Unknown Agent",
            team: assignedTeam,
            weapon: "RIFLE",
            x: (assignedTeam === "ALPHA" ? -20 : 20) + (Math.random() - 0.5) * 5,
            y: 1.6,
            z: 30 + (Math.random() - 0.5) * 5,
            ry: 0,
            hp: 100,
            isDeployed: false,
            lastHurtTime: 0, // 用於脫戰自動回血計時
            killStreak: 0
        };

        socket.join(cleanedRoomId);
        
        // 發送初始化資料給剛加入的玩家
        socket.emit('init', {
            id: socket.id,
            roomId: cleanedRoomId,
            team: assignedTeam,
            playerList: room.players,
            obstacles: room.obstacles,
            scores: room.scores,
            timeLeft: room.timeLeft
        });
    });

    // 3. 選擇武器並部署上場
    socket.on('selectWeaponAndDeploy', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const p = room.players[socket.id];
        if (!p) return;

        p.weapon = data.weapon || "RIFLE";
        p.hp = 100;
        p.killStreak = 0;
        p.lastHurtTime = 0;
        
        // 根據隊伍分配出生點
        p.x = (p.team === "ALPHA" ? -25 : 25) + (Math.random() - 0.5) * 4;
        p.y = 1.6;
        p.z = (Math.random() - 0.5) * 10;
        p.ry = p.team === "ALPHA" ? -Math.PI / 2 : Math.PI / 2;
        p.isDeployed = true;

        // 全房間廣播重生
        io.to(currentRoomId).emit('playerRespawn', { id: socket.id, info: p });
    });

    // 4. 玩家移動同步 (包含邊界限制)
    socket.on('playerUpdate', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const p = room.players[socket.id];
        if (!p || !p.isDeployed) return;

        // 伺服器端邊界阻擋
        p.x = Math.max(-MAP_BOUNDS, Math.min(MAP_BOUNDS, data.x));
        p.y = data.y;
        p.z = Math.max(-MAP_BOUNDS, Math.min(MAP_BOUNDS, data.z));
        p.ry = data.ry;

        // 廣播給房間內其他玩家，並回傳 Ack 序號
        socket.to(currentRoomId).emit('playerMoved', { id: socket.id, info: p });
        socket.emit('serverAck', { seq: data.seq, x: p.x, z: p.z });
    });

    // 5. 開槍視覺同步
    socket.on('playerFire', () => {
        if (!currentRoomId) return;
        socket.to(currentRoomId).emit('remoteFire', socket.id);
    });

    // 6. 命中判定與傷害計算
    socket.on('playerShot', (targetId) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const attacker = room.players[socket.id];
        const target = room.players[targetId];

        if (!attacker || !target || !target.isDeployed || target.hp <= 0 || attacker.team === target.team) return;

        // 計算槍枝傷害數值
        let damage = 20; 
        if (attacker.weapon === "SHOTGUN") damage = 12; // 單發彈丸傷害
        else if (attacker.weapon === "SNIPER") damage = 100; // 狙擊槍一槍致命

        target.hp = Math.max(0, target.hp - damage);
        target.lastHurtTime = Date.now(); // 核心：刷新受傷時間，重新計算 10 秒脫戰

        // 同步扣血狀態
        io.to(currentRoomId).emit('playerHurt', {
            id: targetId,
            targetName: target.name,
            hp: target.hp,
            attackerX: attacker.x,
            attackerZ: attacker.z
        });

        // 擊殺邏輯觸發
        if (target.hp <= 0) {
            target.isDeployed = false;
            attacker.killStreak++;

            // 增加隊伍分數
            if (attacker.team === "ALPHA") room.scores.ALPHA += 1;
            else room.scores.OMEGA += 1;
            io.to(currentRoomId).emit('scoreUpdate', room.scores);

            // 廣播擊殺通知
            io.to(currentRoomId).emit('killFeed', { attackerName: attacker.name, targetName: target.name });
            io.to(currentRoomId).emit('playerDead', { id: targetId });

            // 連殺獎勵機制 (削弱版大招)
            if (attacker.killStreak === 2) {
                // 2連殺：獲得移動速度加成
                socket.emit('streakBuff', { speedMultiplier: 1.15 });
            } else if (attacker.killStreak === 3) {
                // 3連殺：為全隊開啟 5 秒透視雷達
                io.to(currentRoomId).emit('radarScan', { team: attacker.team });
                setTimeout(() => {
                    io.to(currentRoomId).emit('radarScanEnd');
                }, 5000);
                attacker.killStreak = 0; // 重設連殺數
            }

            // 機率在中央生成黃金狙擊槍空投
            if (Math.random() < 0.4 && !room.weaponDropped) {
                room.weaponDropped = true;
                room.dropX = (Math.random() - 0.5) * 15;
                room.dropZ = (Math.random() - 0.5) * 15;
                io.to(currentRoomId).emit('spawnWeaponDrop', { x: room.dropX, z: room.dropZ });
            }
        }
    });

    // 7. 空投武器拾取
    socket.on('pickupWeapon', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.weaponDropped) {
            room.weaponDropped = false;
            io.to(currentRoomId).emit('weaponPickedUp');
        }
    });

    // 8. 斷線處理
    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            delete rooms[currentRoomId].players[socket.id];
            io.to(currentRoomId).emit('playerLeft', socket.id);
            
            // 如果房間沒人了，自動回收記憶體
            if (Object.keys(rooms[currentRoomId].players).length === 0) {
                clearInterval(rooms[currentRoomId].timerInterval);
                delete rooms[currentRoomId];
            }
        }
    });
});

// =========================================================================
// 房間核心計時器與自動回血循環
// =========================================================================
function createRoomInstance(roomId) {
    rooms[roomId] = {
        players: {},
        obstacles: [...DEFAULT_OBSTACLES],
        scores: { ALPHA: 0, OMEGA: 0 },
        timeLeft: 180, // 每局 3 分鐘
        weaponDropped: false,
        dropX: 0, dropZ: 0,
        timerInterval: null
    };
    startRoomTimer(roomId);
}

function startRoomTimer(roomId) {
    const room = rooms[roomId];
    room.timerInterval = setInterval(() => {
        if (!rooms[roomId]) return;

        // 1. 遊戲倒數計時
        room.timeLeft--;
        io.to(roomId).emit('timeUpdate', room.timeLeft);

        if (room.timeLeft <= 0) {
            clearInterval(room.timerInterval);
            let winner = "DRAW";
            if (room.scores.ALPHA > room.scores.OMEGA) winner = "ALPHA";
            else if (room.scores.OMEGA > room.scores.ALPHA) winner = "OMEGA";

            io.to(roomId).emit('matchOver', { winner: winner, scores: room.scores });

            // 8 秒後自動重設戰局
            setTimeout(() => {
                if (rooms[roomId]) {
                    rooms[roomId].scores = { ALPHA: 0, OMEGA: 0 };
                    rooms[roomId].timeLeft = 180;
                    rooms[roomId].weaponDropped = false;
                    for (let pId in rooms[roomId].players) {
                        rooms[roomId].players[pId].isDeployed = false;
                        rooms[roomId].players[pId].hp = 100;
                    }
                    io.to(roomId).emit('matchReset');
                    startRoomTimer(roomId);
                }
            }, 8000);
            return;
        }

        // =========================================================================
        // 【核心機制：脫離戰鬥 10 秒後自動回血 (新平衡：每秒 5 點)】
        // =========================================================================
        const now = Date.now();
        for (let pId in room.players) {
            const p = room.players[pId];
            if (p.isDeployed && p.hp > 0 && p.hp < 100) {
                // 檢查條件：距離上次受傷是否超過 10000 毫秒 (10秒)
                if (!p.lastHurtTime || (now - p.lastHurtTime > 10000)) {
                    p.hp = Math.min(100, p.hp + 5); // 每秒回復 5 點
                    
                    // 同步生命值給該房間的所有人
                    io.to(roomId).emit('playerHurt', { 
                        id: pId, 
                        targetName: p.name, 
                        hp: p.hp, 
                        attackerX: p.x, 
                        attackerZ: p.z 
                    });
                }
            }
        }
    }, 1000); // 每 1 秒檢查並執行一次
}

// =========================================================================
// 啟動伺服器
// =========================================================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`遊戲伺服器運行中，埠號：${PORT}`);
});

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
// 啟用靜態檔案路由，解決 "Cannot GET /" 錯誤
// =========================================================================
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 全局遊戲狀態與地圖配置
// =========================================================================
const rooms = {}; 
const MAP_BOUNDS = 58; 

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

        let alphaCount = 0; let omegaCount = 0;
        for (let pId in room.players) {
            if (room.players[pId].team === "ALPHA") alphaCount++;
            else if (room.players[pId].team === "OMEGA") omegaCount++;
        }
        const assignedTeam = (alphaCount <= omegaCount) ? "ALPHA" : "OMEGA";

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
            lastHurtTime: 0, 
            killStreak: 0
        };

        socket.join(cleanedRoomId);
        
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

    // 3. 選擇武器並部署
    socket.on('selectWeaponAndDeploy', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const p = room.players[socket.id];
        if (!p) return;

        p.weapon = data.weapon || "RIFLE";
        p.hp = 100;
        p.killStreak = 0;
        p.lastHurtTime = 0;
        
        p.x = (p.team === "ALPHA" ? -25 : 25) + (Math.random() - 0.5) * 4;
        p.y = 1.6;
        p.z = (Math.random() - 0.5) * 10;
        p.ry = p.team === "ALPHA" ? -Math.PI / 2 : Math.PI / 2;
        p.isDeployed = true;

        io.to(currentRoomId).emit('playerRespawn', { id: socket.id, info: p });
    });

    // 4. 位置同步
    socket.on('playerUpdate', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const p = room.players[socket.id];
        if (!p || !p.isDeployed) return;

        p.x = Math.max(-MAP_BOUNDS, Math.min(MAP_BOUNDS, data.x));
        p.y = data.y;
        p.z = Math.max(-MAP_BOUNDS, Math.min(MAP_BOUNDS, data.z));
        p.ry = data.ry;

        socket.to(currentRoomId).emit('playerMoved', { id: socket.id, info: p });
        socket.emit('serverAck', { seq: data.seq, x: p.x, z: p.z });
    });

    // 5. 【老功能補回】開槍視覺全域同步
    socket.on('playerFire', () => {
        if (!currentRoomId) return;
        // 向房間內其他玩家發送開槍通知，供遠端模型渲染槍口火焰
        socket.to(currentRoomId).emit('remoteFire', socket.id);
    });

    // 6. 命中與傷害判定
    socket.on('playerShot', (targetId) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const attacker = room.players[socket.id];
        const target = room.players[targetId];

        if (!attacker || !target || !target.isDeployed || target.hp <= 0 || attacker.team === target.team) return;

        let damage = 20; 
        if (attacker.weapon === "SHOTGUN") damage = 12; 
        else if (attacker.weapon === "SNIPER") damage = 100; 

        target.hp = Math.max(0, target.hp - damage);
        target.lastHurtTime = Date.now(); 

        io.to(currentRoomId).emit('playerHurt', {
            id: targetId,
            targetName: target.name,
            hp: target.hp,
            attackerX: attacker.x,
            attackerZ: attacker.z
        });

        if (target.hp <= 0) {
            target.isDeployed = false;
            attacker.killStreak++;

            if (attacker.team === "ALPHA") room.scores.ALPHA += 1;
            else room.scores.OMEGA += 1;
            io.to(currentRoomId).emit('scoreUpdate', room.scores);

            io.to(currentRoomId).emit('killFeed', { attackerName: attacker.name, targetName: target.name });
            io.to(currentRoomId).emit('playerDead', { id: targetId });

            // 連連殺Buff
            if (attacker.killStreak === 2) {
                socket.emit('streakBuff', { speedMultiplier: 1.15 });
            } else if (attacker.killStreak === 3) {
                io.to(currentRoomId).emit('radarScan', { team: attacker.team });
                setTimeout(() => {
                    io.to(currentRoomId).emit('radarScanEnd');
                }, 5000);
                attacker.killStreak = 0; 
            }

            // 黃金狙擊槍空投生成
            if (Math.random() < 0.4 && !room.weaponDropped) {
                room.weaponDropped = true;
                room.dropX = (Math.random() - 0.5) * 15;
                room.dropZ = (Math.random() - 0.5) * 15;
                io.to(currentRoomId).emit('spawnWeaponDrop', { x: room.dropX, z: room.dropZ });
            }
        }
    });

    // 7. 拾取武器
    socket.on('pickupWeapon', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.weaponDropped) {
            room.weaponDropped = false;
            io.to(currentRoomId).emit('weaponPickedUp');
        }
    });

    // 8. 斷線
    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            delete rooms[currentRoomId].players[socket.id];
            io.to(currentRoomId).emit('playerLeft', socket.id);
            
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
        timeLeft: 180, 
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

        room.timeLeft--;
        io.to(roomId).emit('timeUpdate', room.timeLeft);

        if (room.timeLeft <= 0) {
            clearInterval(room.timerInterval);
            let winner = "DRAW";
            if (room.scores.ALPHA > room.scores.OMEGA) winner = "ALPHA";
            else if (room.scores.OMEGA > room.scores.ALPHA) winner = "OMEGA";

            io.to(roomId).emit('matchOver', { winner: winner, scores: room.scores });

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

        // 10 秒脫戰自動回血（每秒 5 點）
        const now = Date.now();
        for (let pId in room.players) {
            const p = room.players[pId];
            if (p.isDeployed && p.hp > 0 && p.hp < 100) {
                if (!p.lastHurtTime || (now - p.lastHurtTime > 10000)) {
                    p.hp = Math.min(100, p.hp + 5); 
                    
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
    }, 1000); 
}

// =========================================================================
// 啟動伺服器
// =========================================================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`遊戲伺服器運行中，埠號：${PORT}`);
});

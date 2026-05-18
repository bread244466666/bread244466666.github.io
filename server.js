const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

const rooms = {};
const MATCH_DURATION = 180; // 每一局 180 秒 (3 分鐘)

const MAPS = {
    "Neon_Arena": [
        { x: 0, y: 1.5, z: 0, w: 3, h: 3, d: 3, color: 0x00ffcc },    
        { x: -8, y: 2, z: -8, w: 2, h: 4, d: 4, color: 0xff00ff }, 
        { x: 8, y: 1, z: -6, w: 4, h: 2, d: 2, color: 0xffff00 },   
        { x: -6, y: 2.5, z: 6, w: 2, h: 5, d: 2, color: 0x00ffff },   
        { x: 7, y: 2, z: 7, w: 3, h: 4, d: 3, color: 0xff3300 }
    ]
};

function getSpawnY(x, z, obstacles) {
    let groundY = 0; 
    for (let obs of obstacles) {
        const halfW = obs.w / 2; const halfD = obs.d / 2;
        if (x >= obs.x - halfW - 0.4 && x <= obs.x + halfW + 0.4 && z >= obs.z - halfD - 0.4 && z <= obs.z + halfD + 0.4) {
            const obsTopY = obs.y + (obs.h / 2);
            if (obsTopY > groundY) groundY = obsTopY; 
        }
    }
    return groundY + 1.6;
}

// 啟動計時器計時與結算邏輯
function startRoomTimer(roomId) {
    if (!rooms[roomId]) return;
    
    rooms[roomId].timerInterval = setInterval(() => {
        const room = rooms[roomId];
        if (!room) { clearInterval(this); return; }

        room.timeLeft--;
        io.to(roomId).emit('timeUpdate', room.timeLeft);

        if (room.timeLeft <= 0) {
            clearInterval(room.timerInterval);
            
            // 判定勝負
            let winner = "DRAW";
            if (room.scores.ALPHA > room.scores.OMEGA) winner = "ALPHA";
            else if (room.scores.OMEGA > room.scores.ALPHA) winner = "OMEGA";

            io.to(roomId).emit('matchOver', {
                winner: winner,
                scores: room.scores
            });

            // 5 秒後自動重置戰局
            setTimeout(() => {
                if (rooms[roomId]) {
                    rooms[roomId].timeLeft = MATCH_DURATION;
                    rooms[roomId].scores = { ALPHA: 0, OMEGA: 0 };
                    
                    // 將所有人解除部署，重新彈出選槍畫面
                    for (let pId in rooms[roomId].players) {
                        rooms[roomId].players[pId].isDeployed = false;
                        rooms[roomId].players[pId].hp = 100;
                    }
                    io.to(roomId).emit('matchReset', rooms[roomId].players);
                    startRoomTimer(roomId);
                }
            }, 5000);
        }
    }, 1000);
}

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('createRoom', () => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        rooms[roomId] = {
            id: roomId,
            mapName: "Neon_Arena",
            obstacles: MAPS["Neon_Arena"],
            players: {},
            scores: { ALPHA: 0, OMEGA: 0 },
            timeLeft: MATCH_DURATION
        };
        socket.emit('roomCreated', roomId);
        startRoomTimer(roomId);
    });

    socket.on('joinRoom', (data) => {
        const { roomId, name } = data;
        if (!rooms[roomId]) {
            socket.emit('joinError', '戰局房間不存在！');
            return;
        }

        currentRoomId = roomId;
        socket.join(roomId);
        const room = rooms[roomId];

        // 隨機動態分組演算法（人數動態平衡）
        let alphaCount = 0; let omegaCount = 0;
        for (let pId in room.players) {
            if (room.players[pId].team === "ALPHA") alphaCount++;
            if (room.players[pId].team === "OMEGA") omegaCount++;
        }
        const assignedTeam = (alphaCount <= omegaCount) ? "ALPHA" : "OMEGA";

        const customName = name || `Agent_${socket.id.substring(0, 4)}`;
        room.players[socket.id] = {
            id: socket.id,
            name: customName,
            team: assignedTeam,
            x: 0, y: 1.6, z: 0, ry: 0, hp: 100,
            weapon: "RIFLE",
            isDeployed: false
        };

        // 初始化前端資料
        socket.emit('init', { 
            id: socket.id, 
            playerList: room.players, 
            obstacles: room.obstacles,
            roomId: roomId,
            team: assignedTeam,
            scores: room.scores,
            timeLeft: room.timeLeft
        });
    });

    socket.on('selectWeaponAndDeploy', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const p = room.players[socket.id];
        if (!p) return;

        // 依據不同隊伍設定左右兩端不同的安全重生基地位置
        const spawnX = p.team === "ALPHA" ? -10 + (Math.random() * 3) : 10 - (Math.random() * 3);
        const spawnZ = (Math.random() - 0.5) * 12;
        const spawnY = getSpawnY(spawnX, spawnZ, room.obstacles);

        p.x = spawnX; p.y = spawnY; p.z = spawnZ;
        p.hp = 100; p.weapon = data.weapon; p.isDeployed = true;

        io.to(currentRoomId).emit('playerRespawn', { id: socket.id, info: p });
    });

    socket.on('playerUpdate', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const p = rooms[currentRoomId].players[socket.id];
        if (p && p.isDeployed) {
            p.x = data.x; p.y = data.y; p.z = data.z; p.ry = data.ry;
            socket.to(currentRoomId).emit('playerMoved', { 
                id: socket.id, info: { x: p.x, y: p.y, z: p.z, ry: p.ry }
            });
            socket.emit('serverAck', { x: p.x, y: p.y, z: p.z, seq: data.seq });
        }
    });

    // 🎯 正確的後端轉發開槍邏輯
    socket.on('playerFire', (data) => {
        if (currentRoomId) {
            // 1. 原本的小地圖雷達發射
            io.to(currentRoomId).emit('playerFiredRadar', { id: socket.id, x: data.x, z: data.z });
            
            // 2. 如果前端有傳 3D 彈道軌跡，原封不動廣播發送給同房間的所有人（包含開槍者自己）
            if (data.bulletPath) {
                io.to(currentRoomId).emit('bulletRender', { id: socket.id, path: data.bulletPath });
            }
        }
    });

    socket.on('playerShot', (targetId) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const attacker = room.players[socket.id];
        const target = room.players[targetId];

        // 核心安全鎖：禁止隊友傷害（Friendly Fire Block）且目標必須處於部署狀態
        if (attacker && target && target.hp > 0 && target.isDeployed) {
            if (attacker.team === target.team) return; 

            let damage = attacker.weapon === "SHOTGUN" ? 25 : (attacker.weapon === "SNIPER" ? 100 : 15);
            target.hp -= damage;

            if (target.hp <= 0) {
                target.hp = 0; target.isDeployed = false;
                
                // 增加擊殺隊伍的積分
                room.scores[attacker.team]++;
                
                io.to(currentRoomId).emit('scoreUpdate', room.scores);
                io.to(currentRoomId).emit('playerDead', { id: targetId });
            } else {
                io.to(currentRoomId).emit('playerHurt', { 
                    id: targetId, targetName: target.name, hp: target.hp, attackerX: attacker.x, attackerZ: attacker.z
                });
            }
        }
    });

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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 團隊戰局伺服器正運作於 http://localhost:${PORT}`));

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname + '/../public')); // 根據你的專案結構調整靜態網頁目錄

const rooms = {};
const MATCH_DURATION = 180; // 3 分鐘局

// 隨機生成霓虹障礙物
function generateObstacles() {
    const list = [];
    const colors = [0x00ffcc, 0xff00ff, 0xffff00, 0x0088ff, 0xff3300];
    for (let i = 0; i < 8; i++) {
        list.push({
            x: (Math.random() - 0.5) * 35,
            y: 1.5,
            z: (Math.random() - 0.5) * 35,
            w: Math.random() * 4 + 2,
            h: 3,
            d: Math.random() * 4 + 2,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    return list;
}

function startRoomTimer(roomId) {
    if (!rooms[roomId]) return;
    
    rooms[roomId].timerInterval = setInterval(() => {
        const room = rooms[roomId];
        if (!room) { 
            clearInterval(rooms[roomId]?.timerInterval); 
            return; 
        }

        room.timeLeft--;
        io.to(roomId).emit('timeUpdate', room.timeLeft);
        
        // =========================================================================
        // 【核心機制：脫離戰鬥 4 秒後自動回血】
        // =========================================================================
        const now = Date.now();
        for (let pId in room.players) {
            const p = room.players[pId];
            if (p.isDeployed && p.hp > 0 && p.hp < 100) {
                if (!p.lastHurtTime || (now - p.lastHurtTime > 10000)) {
                    p.hp = Math.min(100, p.hp + 5); // 每秒恢復 20 點
                    io.to(roomId).emit('playerHurt', { 
                        id: pId, targetName: p.name, hp: p.hp, attackerX: p.x, attackerZ: p.z 
                    });
                }
            }
        }
        
        // 戰局時間終止結算
        if (room.timeLeft <= 0) {
            clearInterval(room.timerInterval);
            let winner = "DRAW";
            if (room.scores.ALPHA > room.scores.OMEGA) winner = "ALPHA";
            else if (room.scores.OMEGA > room.scores.ALPHA) winner = "OMEGA";

            io.to(roomId).emit('matchOver', { winner: winner, scores: room.scores });

            setTimeout(() => {
                if (rooms[roomId]) {
                    rooms[roomId].timeLeft = MATCH_DURATION;
                    rooms[roomId].scores = { ALPHA: 0, OMEGA: 0 };
                    for (let pId in rooms[roomId].players) {
                        rooms[roomId].players[pId].isDeployed = false;
                        rooms[roomId].players[pId].hp = 100;
                        rooms[roomId].players[pId].killStreak = 0;
                        rooms[roomId].players[pId].lastHurtTime = 0;
                    }
                    io.to(roomId).emit('matchReset', rooms[roomId].players);
                    startRoomTimer(roomId);
                }
            }, 5000);
        }
    }, 1000);
}

// =========================================================================
// 【核心機制：每 60 秒在地圖中央隨機空投強力武器】
// =========================================================================
function startWeaponDropCycle(roomId) {
    if (!rooms[roomId]) return;
    rooms[roomId].weaponDropInterval = setInterval(() => {
        if (!rooms[roomId]) return;
        const dropX = (Math.random() - 0.5) * 20;
        const dropZ = (Math.random() - 0.5) * 20;
        rooms[roomId].currentDrop = { x: dropX, z: dropZ, type: "SNIPER" };
        io.to(roomId).emit('spawnWeaponDrop', rooms[roomId].currentDrop);
    }, 60000);
}

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('createRoom', () => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        rooms[roomId] = {
            players: {},
            scores: { ALPHA: 0, OMEGA: 0 },
            timeLeft: MATCH_DURATION,
            obstacles: generateObstacles(),
            currentDrop: null
        };
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (data) => {
        const roomId = data.roomId;
        if (!rooms[roomId]) return;
        
        currentRoomId = roomId;
        socket.join(roomId);

        // 動態平衡分隊
        let alphaCount = 0, omegaCount = 0;
        for (let id in rooms[roomId].players) {
            if (rooms[roomId].players[id].team === "ALPHA") alphaCount++;
            else omegaCount++;
        }
        const assignedTeam = (alphaCount <= omegaCount) ? "ALPHA" : "OMEGA";

        rooms[roomId].players[socket.id] = {
            id: socket.id,
            name: data.name || "未知小兵",
            team: assignedTeam,
            weapon: "RIFLE",
            isDeployed: false,
            hp: 100,
            killStreak: 0,
            lastHurtTime: 0,
            x: 0, y: 1.6, z: 0, ry: 0
        };

        socket.emit('init', {
            id: socket.id,
            roomId: roomId,
            team: assignedTeam,
            scores: rooms[roomId].scores,
            timeLeft: rooms[roomId].timeLeft,
            playerList: rooms[roomId].players,
            obstacles: rooms[roomId].obstacles
        });

        if (!rooms[roomId].timerInterval) {
            startRoomTimer(roomId);
            startWeaponDropCycle(roomId);
        }
        
        // 如果地圖上目前有未被撿取的空投，補發給剛進房的人
        if (rooms[roomId].currentDrop) {
            socket.emit('spawnWeaponDrop', rooms[roomId].currentDrop);
        }
    });

    socket.on('selectWeaponAndDeploy', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const p = rooms[currentRoomId].players[socket.id];
        if (!p) return;

        p.weapon = data.weapon;
        p.isDeployed = true;
        p.hp = 100;
        p.killStreak = 0;

        // 依據陣營分配出生點
        p.x = p.team === "ALPHA" ? -15 + Math.random() * 5 : 15 - Math.random() * 5;
        p.z = (Math.random() - 0.5) * 10;
        p.y = 1.6;

        io.to(currentRoomId).emit('playerRespawn', { id: socket.id, info: p });
    });

    socket.on('playerUpdate', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const p = rooms[currentRoomId].players[socket.id];
        if (!p || !p.isDeployed) return;

        p.x = data.x; p.y = data.y; p.z = data.z; p.ry = data.ry;
        socket.to(currentRoomId).emit('playerMoved', { id: socket.id, info: p });
        socket.emit('serverAck', { seq: data.seq, x: p.x, z: p.z });
    });

    socket.on('playerFire', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        socket.to(currentRoomId).emit('remoteFire', { id: socket.id });
    });

    socket.on('playerShot', (targetId) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        const attacker = room.players[socket.id];
        const target = room.players[targetId];

        if (!attacker || !target || !target.isDeployed || attacker.team === target.team) return;

        // 計算傷害判定 (可根據武器配置調整，這裡以步槍為基準)
        let dmg = 20;
        if (attacker.weapon === "SHOTGUN") dmg = 8; 
        if (attacker.weapon === "SNIPER") dmg = 75;

        target.hp -= dmg;
        target.lastHurtTime = Date.now();

        if (target.hp <= 0) {
            target.hp = 0;
            target.isDeployed = false;
            attacker.killStreak++;
            room.scores[attacker.team]++;

            io.to(currentRoomId).emit('scoreUpdate', room.scores);
            io.to(currentRoomId).emit('playerDead', { id: targetId });
            
            // 廣播擊殺訊息公告
            io.to(currentRoomId).emit('killFeed', {
                attackerName: attacker.name,
                targetName: target.name,
                attackerId: socket.id,
                targetId: targetId
            });

            // =========================================================================
            // 【核心機制：削弱版連殺大招機制】
            // =========================================================================
            if (attacker.killStreak === 3) {
                // 微幅提升 10% 移速
                socket.emit('streakBuff', { speedMultiplier: 1.10 });
                // 全隊雷達掃描對手，僅維持 2.5 秒 (Weaker)
                io.to(currentRoomId).emit('radarScan', { team: attacker.team });
                setTimeout(() => {
                    io.to(currentRoomId).emit('radarScanEnd', { team: attacker.team });
                }, 2500);
            }

            // 擊殺吸血獎勵（立刻補血回饋）
            attacker.hp = Math.min(100, attacker.hp + 35);
            io.to(currentRoomId).emit('playerHurt', {
                id: socket.id, targetName: attacker.name, hp: attacker.hp, attackerX: attacker.x, attackerZ: attacker.z
            });

            target.killStreak = 0;
        } else {
            io.to(currentRoomId).emit('playerHurt', {
                id: targetId, targetName: target.name, hp: target.hp, attackerX: attacker.x, attackerZ: attacker.z
            });
        }
    });

    socket.on('pickupWeapon', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.currentDrop) {
            room.currentDrop = null;
            io.to(currentRoomId).emit('weaponPickedUp');
        }
    });

    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            delete rooms[currentRoomId].players[socket.id];
            io.to(currentRoomId).emit('playerLeft', socket.id);
            
            // 房間沒人時銷毀計時器
            if (Object.keys(rooms[currentRoomId].players).length === 0) {
                clearInterval(rooms[currentRoomId].timerInterval);
                clearInterval(rooms[currentRoomId].weaponDropInterval);
                delete rooms[currentRoomId];
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`遊戲伺服器運行中，埠號：${PORT}`));

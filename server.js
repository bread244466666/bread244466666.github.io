// =========================================================================
// MULTIPLAYER FIRST-PERSON SHOOTER CORE ENGINE - SERVER (server.js)
// DIRECTORY STYLE: FLAT LAYER (SAME FOLDER WITH INDEX.HTML & APP.JS)
// FULL IMPLEMENTATION WITH TACTICAL HEALING SYSTEM - NO OMISSION
// =========================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    connectTimeout: 45000,
    pingTimeout: 30000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6,
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// EXPRESS 靜態資源配置
app.use(express.static(__dirname));

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('<h1>Critical Error: index.html missing!</h1>');
    }
});

// 全局世界狀態機（新增醫療包容器與黃金平台狀態）
const WORLD_STATE = {
    rooms: {
        MAIN_ARENA: {
            roomId: "MAIN_ARENA",
            active: true,
            players: {},
            teamCounts: { ALPHA: 0, OMEGA: 0 },
            obstacles: [
                { id: "obs_center", x: 0, y: 3, z: -30, w: 20, h: 6, d: 4 },
                { id: "obs_left", x: -25, y: 2, z: 10, w: 8, h: 4, d: 8 },
                { id: "obs_right", x: 25, y: 2, z: 15, w: 8, h: 4, d: 8 }
            ],
            weaponDrop: {
                active: false,
                x: 0,
                y: 1.2,
                z: 0,
                radius: 1.6
            },
            // 核心：醫療補給包伺服器狀態
            healthPacks: {
                pack_01: { id: "pack_01", active: false, x: 10, y: 0.5, z: -10, radius: 1.2, healAmount: 40 },
                pack_02: { id: "pack_02", active: false, x: -15, y: 0.5, z: 20, radius: 1.2, healAmount: 40 }
            }
        }
    }
};

const GAME_CONFIG = {
    maxPlayersPerRoom: 20,
    playerMaxHp: 100,
    weapons: {
        RIFLE: { damage: 22, fireRate: 200 },
        SHOTGUN: { damage: 15, fireRate: 800 },
        SNIPER: { damage: 105, fireRate: 1500 }
    },
    spawnPoints: {
        ALPHA: [
            { x: -35, y: 1.6, z: 35, ry: Math.PI / 4 },
            { x: -45, y: 1.6, z: 15, ry: 0 }
        ],
        OMEGA: [
            { x: 35, y: 1.6, z: -35, ry: -Math.PI * 0.75 },
            { x: 45, y: 1.6, z: -15, ry: Math.PI }
        ]
    }
};

io.on('connection', (socket) => {
    console.log(`[NETWORK] Connected: ${socket.id}`);

    // 玩家進入房間
    socket.on('joinRoom', (payload) => {
        try {
            const currentRoom = WORLD_STATE.rooms["MAIN_ARENA"];
            socket.join("MAIN_ARENA");

            let selectedTeam = currentRoom.teamCounts.ALPHA > currentRoom.teamCounts.OMEGA ? "OMEGA" : "ALPHA";
            currentRoom.teamCounts[selectedTeam]++;

            currentRoom.players[socket.id] = {
                id: socket.id,
                name: payload.name ? payload.name.substring(0, 16).trim() : `Agent_${socket.id.substring(0, 4)}`,
                team: selectedTeam,
                x: 0, y: 1.6, z: 0, ry: 0,
                hp: GAME_CONFIG.playerMaxHp,
                currentWeapon: "RIFLE",
                isDeployed: false
            };

            // 初始化世界數據（包含醫療包當前狀態）
            socket.emit('init', {
                id: socket.id,
                team: selectedTeam,
                obstacles: currentRoom.obstacles,
                playerList: currentRoom.players,
                healthPacks: currentRoom.healthPacks
            });

            if (currentRoom.weaponDrop.active) {
                socket.emit('spawnWeaponDrop', { x: currentRoom.weaponDrop.x, z: currentRoom.weaponDrop.z });
            }

        } catch (error) {
            console.error(error);
        }
    });

    // 特務選擇武器出擊
    socket.on('selectWeaponAndDeploy', (payload) => {
        const currentRoom = WORLD_STATE.rooms["MAIN_ARENA"];
        const p = currentRoom.players[socket.id];
        if (!p) return;

        p.currentWeapon = GAME_CONFIG.weapons[payload.weapon] ? payload.weapon : "RIFLE";
        p.hp = GAME_CONFIG.playerMaxHp;
        p.isDeployed = true;

        const spawns = GAME_CONFIG.spawnPoints[p.team];
        const rSpawn = spawns[Math.floor(Math.random() * spawns.length)];
        p.x = rSpawn.x; p.y = rSpawn.y; p.z = rSpawn.z; p.ry = rSpawn.ry;

        io.to("MAIN_ARENA").emit('playerRespawn', { id: socket.id, info: p });
    });

    // 高頻物理與碰撞動態更新（包含黃金平台與醫療包碰撞檢測）
    socket.on('playerUpdate', (payload) => {
        const currentRoom = WORLD_STATE.rooms["MAIN_ARENA"];
        const p = currentRoom.players[socket.id];
        if (!p || !p.isDeployed) return;

        p.x = payload.x; p.y = payload.y; p.z = payload.z; p.ry = payload.ry;

        socket.to("MAIN_ARENA").emit('playerMoved', { id: socket.id, info: p });

        // A. 黃金平台拾取判定
        if (currentRoom.weaponDrop.active) {
            const dx = p.x - currentRoom.weaponDrop.x;
            const dz = p.z - currentRoom.weaponDrop.z;
            if (Math.sqrt(dx*dx + dz*dz) < currentRoom.weaponDrop.radius && p.y >= 2.5) {
                currentRoom.weaponDrop.active = false;
                p.currentWeapon = "SNIPER";
                io.to("MAIN_ARENA").emit('weaponPickedUp', { pickerId: socket.id });
            }
        }

        // B. 醫療包拾取與回復生命值判定
        for (let packId in currentRoom.healthPacks) {
            const pack = currentRoom.healthPacks[packId];
            if (pack.active) {
                const hx = p.x - pack.x;
                const hz = p.z - pack.z;
                const dist = Math.sqrt(hx*hx + hz*hz);

                // 當玩家碰到醫療包且生命值未滿時觸發治療
                if (dist < pack.radius && p.hp < GAME_CONFIG.playerMaxHp) {
                    pack.active = false;
                    p.hp = Math.min(GAME_CONFIG.playerMaxHp, p.hp + pack.healAmount);
                    
                    console.log(`[HEALING EFFECT] Player ${p.name} picked up ${packId}. Current HP: ${p.hp}`);
                    
                    // 1. 通知全房間將該醫療包隱藏
                    io.to("MAIN_ARENA").emit('healthPackStatus', { id: packId, active: false });
                    
                    // 2. 更新並同步該玩家治癒後的血條
                    io.to("MAIN_ARENA").emit('playerHurt', { id: socket.id, hp: p.hp });
                }
            }
        }
    });

    // 槍口閃光廣播
    socket.on('playerFire', () => {
        socket.to("MAIN_ARENA").emit('remoteFire', socket.id);
    });

    // 命中與死亡判定
    socket.on('playerShot', (targetId) => {
        const currentRoom = WORLD_STATE.rooms["MAIN_ARENA"];
        const attacker = currentRoom.players[socket.id];
        const victim = currentRoom.players[targetId];

        if (!attacker || !victim || !victim.isDeployed || attacker.team === victim.team) return;

        const dmg = GAME_CONFIG.weapons[attacker.currentWeapon].damage;
        victim.hp -= dmg;

        io.to("MAIN_ARENA").emit('playerHurt', { id: targetId, hp: Math.max(0, victim.hp) });

        if (victim.hp <= 0) {
            victim.hp = 0;
            victim.isDeployed = false;
            io.to("MAIN_ARENA").emit('killFeed', { attackerName: attacker.name, targetName: victim.name });
            io.to("MAIN_ARENA").emit('playerDead', { id: targetId });
        }
    });

    socket.on('disconnect', () => {
        const currentRoom = WORLD_STATE.rooms["MAIN_ARENA"];
        if (currentRoom && currentRoom.players[socket.id]) {
            currentRoom.teamCounts[currentRoom.players[socket.id].team]--;
            delete currentRoom.players[socket.id];
            io.to("MAIN_ARENA").emit('playerLeft', socket.id);
        }
    });
});

// 定期檢查與刷新機制：黃金平台 (15秒) 與 醫療包 (10秒)
setInterval(() => {
    const currentRoom = WORLD_STATE.rooms["MAIN_ARENA"];
    if (!currentRoom) return;

    // 刷新黃金平台
    if (!currentRoom.weaponDrop.active) {
        currentRoom.weaponDrop.active = true;
        currentRoom.weaponDrop.x = (Math.random() - 0.5) * 50;
        currentRoom.weaponDrop.z = (Math.random() - 0.5) * 50;
        io.to("MAIN_ARENA").emit('spawnWeaponDrop', { x: currentRoom.weaponDrop.x, z: currentRoom.weaponDrop.z });
    }

    // 循環檢查並重新補給已消失的醫療包
    for (let packId in currentRoom.healthPacks) {
        const pack = currentRoom.healthPacks[packId];
        if (!pack.active) {
            pack.active = true;
            // 隨機變更位置增加戰術樂趣
            pack.x = (Math.random() - 0.5) * 60;
            pack.z = (Math.random() - 0.5) * 60;
            
            console.log(`[SUPPLY] Health Pack [${packId}] respawned at (X: ${pack.x.toFixed(1)}, Z: ${pack.z.toFixed(1)})`);
            io.to("MAIN_ARENA").emit('healthPackStatus', { id: packId, active: true, x: pack.x, z: pack.z });
        }
    }
}, 10000);

server.listen(PORT, () => console.log(`FPS Server on port ${PORT}`));

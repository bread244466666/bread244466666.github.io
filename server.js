// =========================================================================
// MULTIPLAYER FIRST-PERSON SHOOTER CORE ENGINE - SERVER (server.js)
// PRODUCTION READY - FULL STATE SYNCHRONIZATION (NO SHORTCUTS)
// =========================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// 掛載前端靜態檔案目錄 (確保能存取 app.js, index.html)
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// 1. 全局遊戲世界狀態機 (WORLD STATE MACHINE)
// =========================================================================
const GAME_ROOMS = {
    MAIN_ARENA: {
        roomId: "MAIN_ARENA",
        players: {}, // 存放所有連線中的玩家數據
        // 伺服器端靜態 3D 地圖障礙物陣列 (與前端 AABB 引擎完全對齊)
        obstacles: [
            { x: 0, y: 3, z: -30, w: 20, h: 6, d: 4, color: 0x3a4454 },  // 中央大掩體
            { x: -25, y: 2, z: 10, w: 8, h: 4, d: 8, color: 0x2a323d },   // 左側戰術方塊
            { x: 25, y: 2, z: 15, w: 8, h: 4, d: 8, color: 0x2a323d },    // 右側戰術方塊
            { x: -40, y: 4, z: -20, w: 6, h: 8, d: 6, color: 0x4a5768 },  // 高塔障礙物 A
            { x: 40, y: 4, z: -20, w: 6, h: 8, d: 6, color: 0x4a5768 }    // 高塔障礙物 B
        ],
        // 黃金空投平台與武器狀態
        weaponDrop: {
            active: false,
            x: 0,
            z: 0,
            radius: 2.0 // 拾取判定半徑 (考慮到平台寬度為 3)
        },
        teamCounts: { ALPHA: 0, OMEGA: 0 }
    }
};

// 玩家屬性常數
const PLAYER_CONFIG = {
    maxHp: 100,
    spawnPoints: {
        ALPHA: [
            { x: -50, y: 1.6, z: 40, ry: Math.PI / 4 },
            { x: -60, y: 1.6, z: 20, ry: 0 }
        ],
        OMEGA: [
            { x: 50, y: 1.6, z: -40, ry: -Math.PI * 0.75 },
            { x: 60, y: 1.6, z: -20, ry: Math.PI }
        ]
    },
    weaponDamage: {
        RIFLE: 22,
        SHOTGUN: 15, // 單發碎彈傷害，散彈全中會致死
        SNIPER: 101  // 重狙一槍致命
    }
};

// =========================================================================
// 2. SOCKET.IO 監聽模組與核心網路封包解算
// =========================================================================
io.on('connection', (socket) => {
    console.log(`[連線成功] 新客戶端接入 ID: ${socket.id}`);

    // 當玩家請求點擊「Make a Room / Join Room」時觸發
    socket.on('joinRoom', (data) => {
        const roomId = data.roomId || "MAIN_ARENA";
        const room = GAME_ROOMS[roomId];

        if (!room) {
            console.log(`[警告] 找不到指定房間: ${roomId}`);
            return;
        }

        // 將 Socket 本身加入 Socket.io 房間分組
        socket.join(roomId);

        // 自動執行特務隊伍動態平衡演算法
        let assignedTeam = "ALPHA";
        if (room.teamCounts.ALPHA > room.teamCounts.OMEGA) {
            assignedTeam = "OMEGA";
        }
        room.teamCounts[assignedTeam]++;

        // 初始化玩家在伺服器端的數據模型
        room.players[socket.id] = {
            id: socket.id,
            name: data.name || `Agent_${socket.id.substring(0, 4)}`,
            team: assignedTeam,
            x: 0, y: 1.6, z: 0, ry: 0,
            hp: PLAYER_CONFIG.maxHp,
            currentWeapon: "RIFLE",
            isDeployed: false,
            kills: 0,
            deaths: 0
        };

        console.log(`[加入房間] 玩家 ${room.players[socket.id].name} 加入了 ${roomId}，分配至 ${assignedTeam} 隊`);

        // 🛠️ 回傳補完的 'init' 封包給前端，初始化地圖與對齊 AABB 障礙物
        socket.emit('init', {
            id: socket.id,
            team: assignedTeam,
            obstacles: room.obstacles,
            playerList: room.players
        });

        // 如果當前地圖上已經存在黃金空投，通知新加入的玩家渲染
        if (room.weaponDrop.active) {
            socket.emit('spawnWeaponDrop', { x: room.weaponDrop.x, z: room.weaponDrop.z });
        }
    });

    // 接收玩家武器選擇與出擊部署請求
    socket.on('selectWeaponAndDeploy', (data) => {
        const room = GAME_ROOMS["MAIN_ARENA"];
        const player = room ? room.players[socket.id] : null;

        if (!player) return;

        player.currentWeapon = data.weapon || "RIFLE";
        player.hp = PLAYER_CONFIG.maxHp;
        player.isDeployed = true;

        // 根據隊伍動態隨機抽取出生點
        const points = PLAYER_CONFIG.spawnPoints[player.team];
        const spawn = points[Math.floor(Math.random() * points.length)];
        
        player.x = spawn.x;
        player.y = spawn.y;
        player.z = spawn.z;
        player.ry = spawn.ry;

        console.log(`[部署出擊] 特務 ${player.name} 使用武器 ${player.currentWeapon} 進入戰場。`);

        // 向全房間廣播該玩家復活，觸發前端第一人稱鎖定與模型渲染
        io.to("MAIN_ARENA").emit('playerRespawn', {
            id: socket.id,
            info: { x: player.x, y: player.y, z: player.z, ry: player.ry, team: player.team }
        });
    });

    // 高頻率即時動態位置矩陣同步更新
    socket.on('playerUpdate', (data) => {
        const room = GAME_ROOMS["MAIN_ARENA"];
        const player = room ? room.players[socket.id] : null;

        if (!player || !player.isDeployed) return;

        // 更新伺服器端玩家狀態
        player.x = data.x;
        player.y = data.y;
        player.z = data.z;
        player.ry = data.ry;

        // 廣播給房間內的其他所有玩家進行 Lerp 內插過渡
        socket.to("MAIN_ARENA").emit('playerMoved', {
            id: socket.id,
            info: { x: player.x, y: player.y, z: player.z, ry: player.ry }
        });

        // 實時檢查玩家是否走進黃金空投平台的拾取判定範圍
        if (room.weaponDrop.active) {
            const dx = player.x - room.weaponDrop.x;
            const dz = player.z - room.weaponDrop.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // 當距離小於判定半徑，且玩家高度接近平台頂部時觸發拾取
            if (dist < room.weaponDrop.radius && player.y >= 1.5) {
                room.weaponDrop.active = false;
                
                // 強制幫該玩家升級為重狙黃金槍
                player.currentWeapon = "SNIPER";
                
                console.log(`[空投拾取] 玩家 ${player.name} 成功奪取黃金重型狙擊槍！`);
                io.to("MAIN_ARENA").emit('weaponPickedUp', { pickerId: socket.id });
            }
        }
    });

    // 接收遠端開槍視覺廣播請求
    socket.on('playerFire', () => {
        const room = GAME_ROOMS["MAIN_ARENA"];
        if (room && room.players[socket.id] && room.players[socket.id].isDeployed) {
            // 通知其他玩家在該角色的模型槍口繪製動態閃光
            socket.to("MAIN_ARENA").emit('remoteFire', socket.id);
        }
    });

    // 硬核射擊命中射線判定與傷害計算處理
    socket.on('playerShot', (targetId) => {
        const room = GAME_ROOMS["MAIN_ARENA"];
        const attacker = room ? room.players[socket.id] : null;
        const target = room ? room.players[targetId] : null;

        if (!attacker || !target || !target.isDeployed || attacker.team === target.team) {
            return; // 攻擊者或目標不存在、未部署、或是同隊隊友（免疫隊友傷害）
        }

        // 計算對應武器傷害值
        const dmg = PLAYER_CONFIG.weaponDamage[attacker.currentWeapon] || 20;
        target.hp -= dmg;

        console.log(`[命中判定] ${attacker.name} 擊中 ${target.name}，造成 ${dmg} 傷害 (剩餘 HP: ${target.hp})`);

        // 通知全房間更新受害者血量 HUD
        io.to("MAIN_ARENA").emit('playerHurt', { id: targetId, hp: Math.max(0, target.hp) });

        // 判定死亡狀態
        if (target.hp <= 0) {
            target.hp = 0;
            target.isDeployed = false;
            attacker.kills++;
            target.deaths++;

            console.log(`[擊殺公告] 🎯 ${attacker.name} 擊殺了 ${target.name}！`);

            // 1. 發送全網擊殺流公告流
            io.to("MAIN_ARENA").emit('killFeed', {
                attackerName: attacker.name,
                targetName: target.name
            });

            // 2. 通知全場清除該玩家的模型，並將受害者踢回武器選單
            io.to("MAIN_ARENA").emit('playerDead', { id: targetId });
        }
    });

    // 斷線清理程序機制
    socket.on('disconnect', () => {
        console.log(`[中斷連線] 客戶端離線 ID: ${socket.id}`);
        const room = GAME_ROOMS["MAIN_ARENA"];
        
        if (room && room.players[socket.id]) {
            const player = room.players[socket.id];
            room.teamCounts[player.team] = Math.max(0, room.teamCounts[player.team] - 1);
            
            delete room.players[socket.id];
            
            // 通知其餘特務將此人從 3D 場景中抹除
            io.to("MAIN_ARENA").emit('playerLeft', socket.id);
        }
    });
});

// =========================================================================
// 3. 伺服器端黃金戰術空投定期循環計時器 (TACTICAL DROP LOOP)
// =========================================================================
setInterval(() => {
    const room = GAME_ROOMS["MAIN_ARENA"];
    // 如果地圖上當前沒有啟動中的空投，則隨機生成一個新的黃金武器平台
    if (room && !room.weaponDrop.active) {
        // 在賽博戰場中心區域 (-35 到 35 之間) 隨機挑選 X 與 Z 軸坐標
        const dropX = (Math.random() - 0.5) * 70;
        const dropZ = (Math.random() - 0.5) * 70;

        room.weaponDrop.active = true;
        room.weaponDrop.x = dropX;
        room.weaponDrop.z = dropZ;

        console.log(`[戰術空投] AWM 黃金武器平台已於坐標 (X: ${dropX.toFixed(1)}, Z: ${dropZ.toFixed(1)}) 降落！`);
        
        // 廣播通知所有前端建立 3D 黃金積木平台與實體 AABB 碰撞
        io.to("MAIN_ARENA").emit('spawnWeaponDrop', { x: dropX, z: dropZ });
    }
}, 18000); // 每 18 秒重新整理判定一次

// =========================================================================
// 4. 啟動伺服器核心
// =========================================================================
server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` FPS MULTIPLAYER SERVER IS RUNNING ON PORT: ${PORT} `);
    console.log(` PRODUCTION MODE / AABB COLLISION ALIGNED / READY   `);
    console.log(`====================================================`);
});

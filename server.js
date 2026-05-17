const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // 允許跨網域連線
});

// 讓伺服器能夠讀取前端的網頁檔案
app.use(express.static(__dirname));

// 儲存所有在線上玩家的資料庫
const players = {};

io.on('connection', (socket) => {
    console.log(`玩家連線成功: ${socket.id}`);

    // 1. 當新玩家加入，初始化他的座標與旋轉角度
    players[socket.id] = {
        x: 0, y: 1.6, z: 5,
        ry: 0
    };

    // 告訴這個新玩家他自己的 ID，並把目前的玩家列表發給他
    socket.emit('init', { id: socket.id, playerList: players });

    // 告訴其他在線上的玩家：有人加入了！
    socket.broadcast.emit('playerJoined', { id: socket.id, info: players[socket.id] });

    // 2. 當接收到某個玩家的移動或轉頭數據
    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].ry = data.ry;

            // 把這個玩家的新位置，即時廣播給所有其他人
            socket.broadcast.emit('playerMoved', { id: socket.id, info: players[socket.id] });
        }
    });

    // 3. 當玩家斷線或關閉網頁
    socket.on('disconnect', () => {
        console.log(`玩家離開: ${socket.id}`);
        delete players[socket.id];
        // 通知所有人移除這個玩家的 3D 模型
        io.emit('playerLeft', socket.id);
    });
});

// 監聽 3000 端口
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`遊戲伺服器正在運行中：http://localhost:${PORT}`);
});

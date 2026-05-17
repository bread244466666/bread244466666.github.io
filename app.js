// ==========================================
// 1. 基礎環境設定（場景、攝影機、渲染器）
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefefef); // 設定天空/背景顏色

// 建立 3D 攝影機（視野角度 75 度）
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 建立地板網格（方便在 3D 空間中辨識移動）
const gridHelper = new THREE.GridHelper(100, 100, 0x0000ff, 0x888888);
scene.add(gridHelper);

// 加上基本環境光與動態光源，讓 3D 物件有立體感
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// 設定本地玩家的初始位置（Y=1.6 代表模擬人類的身高眼睛視線）
camera.position.set(0, 1.6, 5);

// ==========================================
// 2. 網路連線與遠端玩家管理 (Socket.io)
// ==========================================
const socket = io(); // 初始化 Socket.io 連線
let myId = null;
const remotePlayers = {}; // 用於儲存其他玩家的 3D 模型對照表

// 定義其他玩家的外觀（這裡用紅色的方塊代表敵人身體）
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });

// [網路事件] 2.1 接收伺服器初始化的玩家清單
socket.on('init', (data) => {
    myId = data.id;
    // 根據伺服器傳來的現有玩家列表，把已經在線上的其他人畫出來
    for (let id in data.playerList) {
        if (id !== myId) {
            createRemotePlayer(id, data.playerList[id]);
        }
    }
});

// [網路事件] 2.2 當有新玩家加入遊戲
socket.on('playerJoined', (data) => {
    createRemotePlayer(data.id, data.info);
});

// [網路事件] 2.3 當其他玩家移動或轉頭時，即時更新他們在我們畫面上的位置
socket.on('playerMoved', (data) => {
    if (remotePlayers[data.id]) {
        remotePlayers[data.id].position.set(data.info.x, data.info.y, data.info.z);
        remotePlayers[data.id].rotation.y = data.info.ry;
    }
});

// [網路事件] 2.4 當有人斷線或離開，將其 3D 模型從畫面中移除
socket.on('playerLeft', (id) => {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id]);
        delete remotePlayers[id];
    }
});

// 在 3D 場景中生成其他遠端玩家模型的函式
function createRemotePlayer(id, info) {
    const mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    mesh.position.set(info.x, info.y, info.z);
    scene.add(mesh);
    remotePlayers[id] = mesh; // 存入對照表以便後續追蹤更新
}

// ==========================================
// 3. 滑鼠視角控制 (Pointer Lock API)
// ==========================================
let isLocked = false;

// 點擊網頁任意地方時，請求瀏覽器鎖定並隱藏滑鼠游標
document.body.addEventListener('click', () => {
    if (!isLocked) {
        document.body.requestPointerLock();
    }
});

// 監聽鎖定狀態的改變
document.addEventListener('pointerlockchange', () => {
    isLocked = (document.pointerLockElement === document.body);
});

// 監聽滑鼠移動，藉此改變攝影機（玩家眼睛）的角度
document.addEventListener('mousemove', (event) => {
    if (!isLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // 左右旋轉（繞著 Y 軸旋轉）
    camera.rotation.y -= movementX * 0.002;
    
    // 上下偏轉（繞著 X 軸旋轉），並限制角度，避免玩家頭部過度翻轉
    camera.rotation.x -= movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, camera.rotation.x));
});

// 重要設定：調整旋轉順序為 YXZ（先左右再上下），視角轉動才不會產生扭曲
camera.rotation.order = "YXZ";

// ==========================================
// 4. 鍵盤移動控制 (WASD)
// ==========================================
const keysPressed = { w: false, a: false, s: false, d: false };
const moveSpeed = 0.1; // 玩家移動速度

// 監聽鍵盤按下
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key in keysPressed) keysPressed[key] = true;
});

// 監聽鍵盤放開
document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key in keysPressed) keysPressed[key] = false;
});

// 計算並處理玩家移動的函式
function handleMovement() {
    if (!isLocked) return;

    // 建立一個前進方向的向量（基於目前相機所面對的水平方向）
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // 鎖定在地面高度，防止看著天空前進時整個人飛起來
    direction.normalize();

    // 建立一個向右的方向向量（透過前進方向與世界 Y 軸進行外積計算得出）
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    // 根據目前的 WASD 按鍵狀態改變相機位置
    if (keysPressed.w) camera.position.addScaledVector(direction, moveSpeed);
    if (keysPressed.s) camera.position.addScaledVector(direction, -moveSpeed);
    if (keysPressed.d) camera.position.addScaledVector(right, moveSpeed);
    if (keysPressed.a) camera.position.addScaledVector(right, -moveSpeed);
}

// ==========================================
// 5. 遊戲主迴圈 (Game Loop) ── 每秒執行約 60 次
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    // 1. 處理本地玩家的鍵盤移動
    handleMovement();

    // 2. 如果成功連線且滑鼠處於鎖定狀態，每一影格都將最新位置發送給後端伺服器
    if (myId && isLocked) {
        socket.emit('playerUpdate', {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            ry: camera.rotation.y
        });
    }

    // 3. 渲染出最新的 3D 畫面
    renderer.render(scene, camera);
}

// 監聽視窗大小改變，自動填滿畫面，防止變形
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 啟動遊戲主迴圈
animate();

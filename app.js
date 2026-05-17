// =========================================================================
// 1. 初始化 Socket.io 與 全局變數
// =========================================================================
const socket = io(); // 在 Render 上部署時，留空會自動連接當前網域

let scene, camera, renderer;
let myId = null;
let myTeam = null;
let currentWeapon = "RIFLE";
let isDeployed = false;

// 玩家控制與物理變數
const moveSpeed = 0.15;
let playerVelocity = { x: 0, y: 0, z: 0 };
const gravity = -0.01;
const jumpStrength = 0.16; // 👈 調高跳躍力，確保能跳上黃金平台
let isGrounded = false;

// 輸入狀態追蹤
const keys = {};
let isAiming = false; // 右鍵瞄準狀態

// 遊戲對象儲存庫
const remotePlayers = {};
const obstacles = [];
let weaponDropMesh = null;

// 相機旋轉控制 (指針鎖定)
let pitchObject = new THREE.Object3D();
let yawObject = new THREE.Object3D();

// 我的槍枝 Mesh
let myGunMesh = null;

// 槍枝在畫面的坐標配置 (解決木棍感的關鍵！)
const WEAPON_POSITIONS = {
    RIFLE: {
        hip: { x: 0.25, y: -0.25, z: -0.5, rx: 0, ry: 0, rz: 0 },
        ads: { x: 0.0, y: -0.12, z: -0.35, rx: 0.02, ry: 0, rz: 0.06 } // 👈 帶有 0.06 弧度的戰術側身傾斜
    },
    SHOTGUN: {
        hip: { x: 0.25, y: -0.25, z: -0.45, rx: 0, ry: 0, rz: 0 },
        ads: { x: 0.0, y: -0.10, z: -0.32, rx: 0.01, ry: 0, rz: 0.04 }
    },
    SNIPER: {
        hip: { x: 0.28, y: -0.28, z: -0.6, rx: 0, ry: 0, rz: 0 },
        ads: { x: 0.0, y: -0.08, z: -0.4, rx: 0, ry: 0, rz: 0 } // 狙擊鏡正對前方
    }
};

// =========================================================================
// 2. 遊戲初始化入口
// =========================================================================
function initGame() {
    // 隱藏登入 UI，顯示選單
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('lobby-ui').style.display = 'block';

    // 建立 3D 場景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

    // 相機設定
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 指針鎖定階層式結構
    pitchObject.add(camera);
    yawObject.add(pitchObject);
    scene.add(yawObject);

    // 渲染器設定
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 燈光系統
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionCollectionLight || new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // 建造地板
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 動態加入 HTML 螢光綠準星（如果 UI 沒寫，自動補上）
    if (!document.getElementById('crosshair')) {
        const crosshair = document.createElement('div');
        crosshair.id = 'crosshair';
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.width = '10px';
        crosshair.style.height = '10px';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.pointerEvents = 'none';
        crosshair.style.zIndex = '999';
        
        const style = document.createElement('style');
        style.innerHTML = `
            #crosshair::before, #crosshair::after { content: ''; position: absolute; background: #00ff00; }
            #crosshair::before { top: 4px; left: -5px; width: 20px; height: 2px; }
            #crosshair::after { top: -5px; left: 4px; width: 2px; height: 20px; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(crosshair);
    }

    // 監聽事件
    window.addEventListener('resize', onWindowResize);
    setupInputListeners();

    // 啟動主渲染循環
    animate();
}

// =========================================================================
// 3. 精緻武器 3D 模型手工建構子 (拒絕棍子外觀)
// =========================================================================
function createVisualWeapon(type) {
    const gunGroup = new THREE.Group();

    // 1. 槍身主體 (機匣)
    const bodyGeo = new THREE.BoxGeometry(0.04, 0.06, 0.2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    gunGroup.add(body);

    // 2. 槍管
    const barrelGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.2);
    gunGroup.add(barrel);

    // 3. 機械瞄具 (準星與照門) - 這是消除棍子感的關鍵視覺細節
    const sightGeo = new THREE.BoxGeometry(0.006, 0.015, 0.01);
    const sightMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // 瞄具帶有螢光點
    const frontSight = new THREE.Mesh(sightGeo, sightMat);
    frontSight.position.set(0, 0.025, -0.3);
    gunGroup.add(frontSight);

    // 4. 彈匣
    const magGeo = new THREE.BoxGeometry(0.03, 0.08, 0.03);
    const mag = new THREE.Mesh(magGeo, bodyMat);
    mag.position.set(0, -0.06, -0.05);
    mag.rotation.x = -0.2;
    gunGroup.add(mag);

    // 根據武器種類微調外觀
    if (type === "SNIPER") {
        // 幫狙擊槍加一個巨大的瞄準鏡
        const scopeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12);
        const scope = new THREE.Mesh(scopeGeo, bodyMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.05, -0.05);
        gunGroup.add(scope);
    } else if (type === "SHOTGUN") {
        barrel.scale.set(1.5, 0.8, 1.5); // 散彈槍槍管變粗變短
    }

    return gunGroup;
}

function equipWeaponMesh(type) {
    if (myGunMesh) pitchObject.remove(myGunMesh);
    
    myGunMesh = createVisualWeapon(type);
    
    // 初始化至腰射位置
    const pos = WEAPON_POSITIONS[type].hip;
    myGunMesh.position.set(pos.x, pos.y, pos.z);
    pitchObject.add(myGunMesh);
}

// =========================================================================
// 4. 輸入控制系統 (鍵盤與滑鼠)
// =========================================================================
function setupInputListeners() {
    // 鍵盤按下
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'Space' && isGrounded && isDeployed) {
            playerVelocity.y = jumpStrength; // 執行跳躍
            isGrounded = false;
        }
    });

    // 鍵盤放開
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // 滑鼠點擊點進遊戲鎖定指針
    window.addEventListener('click', () => {
        if (isDeployed) document.body.requestPointerLock();
    });

    // 滑鼠移動旋轉視角
    window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            yawObject.rotation.y -= e.movementX * 0.002;
            pitchObject.rotation.x -= e.movementY * 0.002;
            pitchObject.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitchObject.rotation.x));
        }
    });

    // 滑鼠開槍與開鏡
    window.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement !== document.body || !isDeployed) return;

        if (e.button === 0) {
            // 左鍵開槍
            socket.emit('playerFire');
            performRaycastShoot();
        } else if (e.button === 2) {
            // 右鍵開鏡瞄準 (ADS)
            isAiming = true;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            // 放開右鍵取消瞄準
            isAiming = false;
        }
    });

    // 防止右鍵彈出瀏覽器選單
    window.addEventListener('contextmenu', e => e.preventDefault());
}

// =========================================================================
// 5. 射擊命中判定 (Raycaster)
// =========================================================================
function performRaycastShoot() {
    const raycaster = new THREE.Raycaster();
    // 從畫面中心發射射線
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // 收集所有遠端玩家的模型組件以進行擊中判定
    const targets = [];
    for (let id in remotePlayers) {
        if (remotePlayers[id].mesh) {
            targets.push(remotePlayers[id].mesh);
        }
    }

    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
        let hitMesh = intersects[0].object;
        // 向上尋找帶有擁有者資訊的父節點
        while (hitMesh.parent && !hitMesh.userData.playerId) {
            hitMesh = hitMesh.parent;
        }
        
        const targetId = hitMesh.userData.playerId;
        if (targetId) {
            socket.emit('playerShot', targetId);
        }
    }
}

// =========================================================================
// 6. 遊戲更新與渲染循環 (核心動畫)
// =========================================================================
function animate() {
    requestAnimationFrame(animate);

    if (isDeployed) {
        // 1. 處理物理與移動
        let moveX = 0;
        let moveZ = 0;
        if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

        // 計算相機相對方向向量
        const direction = new THREE.Vector3(moveX, 0, moveZ).normalize();
        direction.applyQuaternion(yawObject.quaternion);
        
        yawObject.position.x += direction.x * moveSpeed;
        yawObject.position.z += direction.z * moveSpeed;

        // 處理重力
        playerVelocity.y += gravity;
        yawObject.position.y += playerVelocity.y;

        // 地底碰撞與限制
        if (yawObject.position.y <= 1.6) {
            yawObject.position.y = 1.6;
            playerVelocity.y = 0;
            isGrounded = true;
        }

        // 2. 核心視覺：開鏡瞄準動畫過渡 (Lerp)
        if (myGunMesh) {
            const config = WEAPON_POSITIONS[currentWeapon];
            const targetTransform = isAiming ? config.ads : config.hip;
            
            // 武器位置平滑移動
            myGunMesh.position.x += (targetTransform.x - myGunMesh.position.x) * 0.2;
            myGunMesh.position.y += (targetTransform.y - myGunMesh.position.y) * 0.2;
            myGunMesh.position.z += (targetTransform.z - myGunMesh.position.z) * 0.2;
            
            // 武器旋轉平滑移動
            myGunMesh.rotation.x += (targetTransform.rx - myGunMesh.rotation.x) * 0.2;
            myGunMesh.rotation.y += (targetTransform.ry - myGunMesh.rotation.y) * 0.2;
            myGunMesh.rotation.z += (targetTransform.rz - myGunMesh.rotation.z) * 0.2;

            // 開鏡時拉近相機視野 (FOV Zoom Effect)
            const targetFOV = isAiming ? (currentWeapon === "SNIPER" ? 25 : 50) : 75;
            camera.fov += (targetFOV - camera.fov) * 0.2;
            camera.updateProjectionMatrix();
        }

        // 3. 回傳位置給後端伺服器
        socket.emit('playerUpdate', {
            x: yawObject.position.x,
            y: yawObject.position.y,
            z: yawObject.position.z,
            ry: yawObject.rotation.y
        });
    }

    // 旋轉黃金空投物資(如果存在)
    if (weaponDropMesh) {
        weaponDropMesh.rotation.y += 0.02;
    }

    renderer.render(scene, camera);
}

// =========================================================================
// 7. Socket.io 後端事件監聽與同步
// =========================================================================
socket.on('init', (data) => {
    myId = data.id;
    myTeam = data.team;
    
    // 渲染伺服器傳來的障礙物
    data.obstacles.forEach(obs => {
        const obsGeo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
        const obsMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.4 });
        const mesh = new THREE.Mesh(obsGeo, obsMat);
        mesh.position.set(obs.x, obs.y, obs.z);
        scene.add(mesh);
        obstacles.push(mesh);
    });

    // 同步既有遠端玩家
    for (let id in data.playerList) {
        if (id !== myId && data.playerList[id].isDeployed) {
            createRemotePlayerMesh(id, data.playerList[id]);
        }
    }
});

socket.on('playerRespawn', (data) => {
    if (data.id === myId) {
        // 我自己部署重生
        isDeployed = true;
        yawObject.position.set(data.info.x, data.info.y, data.info.z);
        yawObject.rotation.set(0, data.info.ry, 0);
        equipWeaponMesh(currentWeapon);
        document.getElementById('weapon-menu').style.display = 'none';
        document.body.requestPointerLock();
    } else {
        // 敵人或隊友重生
        createRemotePlayerMesh(data.id, data.info);
    }
});

socket.on('playerMoved', (data) => {
    if (remotePlayers[data.id]) {
        remotePlayers[data.id].mesh.position.set(data.info.x, data.info.y, data.info.z);
        remotePlayers[data.id].mesh.rotation.y = data.info.ry;
    }
});

socket.on('remoteFire', (attackerId) => {
    // 補回老功能：遠端玩家開槍時產生槍口火光特效
    if (remotePlayers[attackerId]) {
        const flashGeo = new THREE.PointLight(0xffaa00, 3, 5);
        flashGeo.position.set(0, 0, -0.5);
        remotePlayers[attackerId].mesh.add(flashGeo);
        setTimeout(() => {
            remotePlayers[attackerId].mesh.remove(flashGeo);
        }, 60);
    }
});

socket.on('playerDead', (data) => {
    if (data.id === myId) {
        isDeployed = false;
        document.exitPointerLock();
        document.getElementById('weapon-menu').style.display = 'block';
    } else if (remotePlayers[data.id]) {
        scene.remove(remotePlayers[data.id].mesh);
        delete remotePlayers[data.id];
    }
});

socket.on('spawnWeaponDrop', (data) => {
    // 建立黃金槍空投平台
    const dropGroup = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 }); // 黃金質感
    const box = new THREE.Mesh(boxGeo, boxMat);
    dropGroup.add(box);

    dropGroup.position.set(data.x, 1, data.z); // Y 軸設為 1，玩家跳躍力加大後能輕鬆踩上去
    scene.add(dropGroup);
    weaponDropMesh = dropGroup;
});

socket.on('weaponPickedUp', () => {
    if (weaponDropMesh) {
        scene.remove(weaponDropMesh);
        weaponDropMesh = null;
    }
});

socket.on('playerLeft', (id) => {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id].mesh);
        delete remotePlayers[id];
    }
});

// =========================================================================
// 8. 輔助工具函數
// =========================================================================
function createRemotePlayerMesh(id, info) {
    if (remotePlayers[id]) scene.remove(remotePlayers[id].mesh);

    const playerGroup = new THREE.Group();
    playerGroup.userData = { playerId: id };

    // 膠囊形身體
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: info.team === "ALPHA" ? 0x0055ff : 0xff3300 // 藍隊 vs 紅隊
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    playerGroup.add(body);

    playerGroup.position.set(info.x, info.y, info.z);
    playerGroup.rotation.y = info.ry;
    scene.add(playerGroup);

    remotePlayers[id] = { mesh: playerGroup, info: info };
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 前端部署按鈕綁定公用函數
window.deployAgent = function(weaponType) {
    currentWeapon = weaponType;
    socket.emit('selectWeaponAndDeploy', { weapon: weaponType });
};

window.joinQueue = function() {
    const name = document.getElementById('player-name').value;
    initGame();
    socket.emit('joinRoom', { roomId: "MAIN_ARENA", name: name });
};

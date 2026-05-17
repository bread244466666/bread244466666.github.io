// =========================================================================
// 1. 全局變數、狀態控制與配置
// =========================================================================
const socket = io(); 

let scene, camera, renderer;
let myId = null;
let myTeam = null;
let currentWeapon = "RIFLE";
let isDeployed = false;

// 物理與移動參數
const moveSpeed = 0.12;
const sprintMultiplier = 1.4;
let playerVelocity = { x: 0, y: 0, z: 0 };
const gravity = -0.008;
const jumpStrength = 0.18; // 確保能跳上黃金平台
let isGrounded = false;

// 玩家視角旋轉控制 (Pointer Lock 控制核心)
let pitchObject = new THREE.Object3D();
let yawObject = new THREE.Object3D();

// 輸入狀態追蹤
const keys = {};
let isAiming = false;
let isShooting = false;
let lastShotTime = 0;

// 武器特性配置表 (後座力、射速、彈道散佈)
const WEAPON_SPECS = {
    RIFLE: {
        fireRate: 150,      // 毫秒/發
        spread: 0.02,       // 腰射散佈
        adsSpread: 0.005,   // 瞄準散佈
        recoilY: 0.015,     // 垂直後座力
        recoilX: 0.005,     // 水平後座力
        hipPos: { x: 0.25, y: -0.25, z: -0.5, rx: 0, ry: 0, rz: 0 },
        adsPos: { x: 0.0, y: -0.12, z: -0.35, rx: 0.02, ry: 0, rz: 0.06 }
    },
    SHOTGUN: {
        fireRate: 800,
        spread: 0.08,
        adsSpread: 0.05,
        recoilY: 0.06,
        recoilX: 0.02,
        hipPos: { x: 0.25, y: -0.25, z: -0.45, rx: 0, ry: 0, rz: 0 },
        adsPos: { x: 0.0, y: -0.10, z: -0.32, rx: 0.01, ry: 0, rz: 0.04 }
    },
    SNIPER: {
        fireRate: 1200,
        spread: 0.15,
        adsSpread: 0.0,
        recoilY: 0.1,
        recoilX: 0.0,
        hipPos: { x: 0.28, y: -0.28, z: -0.6, rx: 0, ry: 0, rz: 0 },
        adsPos: { x: 0.0, y: -0.08, z: -0.4, rx: 0, ry: 0, rz: 0 }
    }
};

// 遊戲對象集合
const remotePlayers = {};
const obstacles = [];
let weaponDropMesh = null;
let myGunMesh = null;

// 特效收集器 (用於在 animate 循環中更新或淡出)
const bulletTrails = [];
const damageIndicators = [];

// =========================================================================
// 2. 遊戲初始化入口與 UI 建立
// =========================================================================
function initGame() {
    // 切換 UI 顯示
    const startScreen = document.getElementById('start-screen');
    const lobbyUi = document.getElementById('lobby-ui');
    if (startScreen) startScreen.style.display = 'none';
    if (lobbyUi) lobbyUi.style.display = 'block';

    // 建立 3D 場景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f111a); // 暗色科技感天空
    scene.fog = new THREE.FogExp2(0x0f111a, 0.015);

    // 相機設定
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 建立標準 FPS 視角控制階層
    pitchObject.add(camera);
    yawObject.add(pitchObject);
    scene.add(yawObject);

    // WebGL 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 環境光與動態光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(30, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // 建造大型戰場網格地板
    buildBattleground();

    // 建造動態 2D UI 疊加層 (血條、準星、擊殺通知欄)
    buildGameOverlayUI();

    // 綁定所有輸入監聽
    setupInputListeners();

    // 啟動主渲染引擎循環
    animate();
}

// 繪製科技風棋盤格地板
function buildBattleground() {
    const floorSize = 150;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x1e2233, 
        roughness: 0.7,
        metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 加上網格輔助線
    const grid = new THREE.GridHelper(floorSize, 60, 0x00ffcc, 0x444444);
    grid.position.y = 0.01;
    scene.add(grid);
}

// =========================================================================
// 3. 全自動 HTML/CSS 界面建構 (確保不用手動補程式碼)
// =========================================================================
function buildGameOverlayUI() {
    // 1. 螢光準星
    if (!document.getElementById('game-crosshair')) {
        const ch = document.createElement('div');
        ch.id = 'game-crosshair';
        Object.assign(ch.style, {
            position: 'absolute', top: '50%', left: '50%',
            width: '12px', height: '12px',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', zIndex: '1000'
        });
        const style = document.createElement('style');
        style.innerHTML = `
            #game-crosshair::before, #game-crosshair::after { content: ''; position: absolute; background: #00ff66; transition: all 0.1s; }
            #game-crosshair::before { top: 5px; left: -6px; width: 24px; height: 2px; }
            #game-crosshair::after { top: -6px; left: 5px; width: 2px; height: 24px; }
            .hit-marker { position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; transform: translate(-50%, -50%); pointer-events: none; zIndex: 1001; }
            .hit-marker::before, .hit-marker::after { content: ''; position: absolute; width: 2px; height: 10px; background: red; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(ch);
    }

    // 2. 戰場狀態 HUD (生命值與擊殺欄)
    if (!document.getElementById('game-hud')) {
        const hud = document.createElement('div');
        hud.id = 'game-hud';
        Object.assign(hud.style, {
            position: 'absolute', bottom: '20px', left: '20px',
            color: '#fff', fontFamily: 'monospace', fontSize: '24px',
            background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '5px',
            pointerEvents: 'none', zIndex: '1000'
        });
        hud.innerHTML = `
            <div>TEAM: <span id="hud-team">-</span></div>
            <div>HP: <span id="hud-hp">100</span>/100</div>
            <div style="width:200px; height:10px; background:#333; margin-top:5px;">
                <div id="hp-bar" style="width:100%; height:100%; background:#00ff66; transition: width 0.1s;"></div>
            </div>
        `;
        document.body.appendChild(hud);
    }
}

// =========================================================================
// 4. 機械感 3D 槍枝建構 (消滅木棍感的關鍵細節)
// =========================================================================
function createVisualWeapon(type) {
    const gunGroup = new THREE.Group();

    // 1. 主機匣 (Receiver)
    const receiverGeo = new THREE.BoxGeometry(0.05, 0.07, 0.22);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x282c34, metalness: 0.8, roughness: 0.2 });
    const receiver = new THREE.Mesh(receiverGeo, metalMat);
    receiver.castShadow = true;
    gunGroup.add(receiver);

    // 2. 護木與槍管 (Handguard & Barrel)
    const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1e2025, metalness: 0.9, roughness: 0.1 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.22);
    barrel.castShadow = true;
    gunGroup.add(barrel);

    // 3. 戰術滑軌與機械瞄具 (Tactical Rail & Iron Sights) -> 徹底終結直棍感
    const railGeo = new THREE.BoxGeometry(0.015, 0.01, 0.2);
    const rail = new THREE.Mesh(railGeo, metalMat);
    rail.position.set(0, 0.04, -0.05);
    gunGroup.add(rail);

    // 螢光前準星 (Front Sight Blade)
    const frontSightGeo = new THREE.BoxGeometry(0.006, 0.02, 0.01);
    const greenGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const frontSight = new THREE.Mesh(frontSightGeo, greenGlowMat);
    frontSight.position.set(0, 0.045, -0.35);
    gunGroup.add(frontSight);

    // 後照門 (Rear Sight)
    const rearSightGeo = new THREE.BoxGeometry(0.02, 0.015, 0.01);
    const rearSight = new THREE.Mesh(rearSightGeo, metalMat);
    rearSight.position.set(0, 0.048, 0.05);
    gunGroup.add(rearSight);

    // 4. 握把與彈匣 (Grip & Magazine)
    const gripGeo = new THREE.BoxGeometry(0.03, 0.09, 0.04);
    const grip = new THREE.Mesh(gripGeo, metalMat);
    grip.position.set(0, -0.07, 0.03);
    grip.rotation.x = 0.3;
    gunGroup.add(grip);

    const magGeo = new THREE.BoxGeometry(0.025, 0.12, 0.04);
    const mag = new THREE.Mesh(magGeo, metalMat);
    mag.position.set(0, -0.08, -0.08);
    mag.rotation.x = -0.15;
    gunGroup.add(mag);

    // 武器專屬配件修改
    if (type === "SNIPER") {
        // 大口徑高倍率狙擊鏡
        const scopeGroup = new THREE.Group();
        const tubeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.15);
        const tube = new THREE.Mesh(tubeGeo, metalMat);
        tube.rotation.x = Math.PI / 2;
        scopeGroup.add(tube);

        const lensGeo = new THREE.CircleGeometry(0.016, 16);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 0, 0.076);
        scopeGroup.add(lens);

        scopeGroup.position.set(0, 0.065, -0.02);
        gunGroup.add(scopeGroup);
        
        // 加長槍管
        barrel.scale.set(1.0, 1.8, 1.0);
        barrel.position.set(0, 0.01, -0.34);
    } else if (type === "SHOTGUN") {
        // 雙管散彈槍結構
        barrel.scale.set(2.2, 0.75, 2.2);
        mag.visible = false; // 散彈槍無外突彈匣
    }

    return gunGroup;
}

function equipWeaponMesh(type) {
    if (myGunMesh) pitchObject.remove(myGunMesh);
    
    myGunMesh = createVisualWeapon(type);
    
    // 初始化位置至對應武器的腰射坐標
    const pos = WEAPON_SPECS[type].hipPos;
    myGunMesh.position.set(pos.x, pos.y, pos.z);
    pitchObject.add(myGunMesh);
}

// =========================================================================
// 5. 完整輸入系統與動態開鏡監聽
// =========================================================================
function setupInputListeners() {
    // 鍵盤處理
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        // 執行跳躍限制
        if (e.code === 'Space' && isGrounded && isDeployed) {
            playerVelocity.y = jumpStrength;
            isGrounded = false;
        }
    });

    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // 點擊鎖定視角
    window.addEventListener('click', () => {
        if (isDeployed && document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        }
    });

    // 視角轉動滑鼠邏輯
    window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            const sensitivity = isAiming ? 0.001 : 0.002; // 開鏡時自動降低靈敏度協助精準瞄準
            yawObject.rotation.y -= e.movementX * sensitivity;
            pitchObject.rotation.x -= e.movementY * sensitivity;
            
            // 垂直視角鎖死防止翻轉 (限制在上下約 85 度)
            pitchObject.rotation.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitchObject.rotation.x));
        }
    });

    // 滑鼠按鍵事件
    window.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement !== document.body || !isDeployed) return;

        if (e.button === 0) {
            isShooting = true; // 開啟連發開槍開關
        } else if (e.button === 2) {
            isAiming = true; // 開鏡瞄準
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) isShooting = false;
        if (e.button === 2) isAiming = false;
    });

    window.addEventListener('contextmenu', e => e.preventDefault());
}

// =========================================================================
// 6. 硬核射擊判定、開槍後座力與動態彈道線
// =========================================================================
function handleWeaponFiringCycle() {
    if (!isShooting || !isDeployed) return;

    const now = Date.now();
    const spec = WEAPON_SPECS[currentWeapon];

    if (now - lastShotTime >= spec.fireRate) {
        lastShotTime = now;

        // 1. 通知伺服器
        socket.emit('playerFire');

        // 2. 視覺特效：產生動態槍口火光 (Muzzle Flash)
        createMuzzleFlash();

        // 3. 物理回饋：施加視覺槍身後座力與鏡頭上揚
        applyWeaponRecoil(spec);

        // 4. 命中判定：計算彈道偏移 (Spread)
        const currentSpread = isAiming ? spec.adsSpread : spec.spread;
        
        if (currentWeapon === "SHOTGUN") {
            // 散彈槍一次發射 6 發碎彈
            for (let i = 0; i < 6; i++) {
                executeSingleRaycastProjectile(currentSpread);
            }
        } else {
            executeSingleRaycastProjectile(currentSpread);
        }
    }
}

function createMuzzleFlash() {
    if (!myGunMesh) return;
    const flash = new THREE.PointLight(0xffcc00, 4, 6);
    flash.position.set(0, 0.02, -0.35);
    myGunMesh.add(flash);
    
    // 槍身向後位移震撼彈跳
    myGunMesh.position.z += 0.08;

    setTimeout(() => {
        if (myGunMesh) myGunMesh.remove(flash);
    }, 40);
}

function applyWeaponRecoil(spec) {
    // 鏡頭微幅上揚後座力
    pitchObject.rotation.x += spec.recoilY;
    yawObject.rotation.y += (Math.random() - 0.5) * spec.recoilX;
}

function executeSingleRaycastProjectile(spreadValue) {
    const raycaster = new THREE.Raycaster();
    
    // 計算彈道隨機飄移
    const screenRayX = (Math.random() - 0.5) * spreadValue;
    const screenRayY = (Math.random() - 0.5) * spreadValue;
    
    raycaster.setFromCamera(new THREE.Vector2(screenRayX, screenRayY), camera);

    // 建立雷射彈道光束線軌跡 (Laser Bullet Trail)
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    
    // 槍口稍微向下向右偏置，讓彈道看起來是從槍口射出
    origin.x += 0.1; 
    origin.y -= 0.1;

    const targetPos = new THREE.Vector3();
    const rayDir = raycaster.ray.direction.clone().multiplyScalar(100);
    targetPos.addVectors(origin, rayDir);

    // 取得所有遠端玩家
    const targetMeshes = [];
    for (let id in remotePlayers) {
        if (remotePlayers[id].mesh) targetMeshes.push(remotePlayers[id].mesh);
    }

    const intersects = raycaster.intersectObjects(targetMeshes, true);
    
    if (intersects.length > 0) {
        targetPos.copy(intersects[0].point);
        
        // 解析擊中對象的 Player ID
        let rootObj = intersects[0].object;
        while (rootObj.parent && !rootObj.userData.playerId) {
            rootObj = rootObj.parent;
        }
        
        const hitId = rootObj.userData.playerId;
        if (hitId) {
            socket.emit('playerShot', hitId);
            showHitMarkerUI(); // 顯示命中紅十字
        }
    }

    // 繪製 3D 彈道軌跡線
    drawLaserTrailMesh(origin, targetPos);
}

function drawLaserTrailMesh(start, end) {
    const points = [start, end];
    const trailGeo = new THREE.BufferGeometry().setFromPoints(points);
    const trailMat = new THREE.LineBasicMaterial({ 
        color: currentWeapon === "SNIPER" ? 0xff0055 : 0xffaa00,
        transparent: true,
        opacity: 0.8
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    bulletTrails.push({ mesh: trail, spawnTime: Date.now() });
}

function showHitMarkerUI() {
    const marker = document.createElement('div');
    marker.className = 'hit-marker';
    document.body.appendChild(marker);
    setTimeout(() => marker.remove(), 120);
}

// =========================================================================
// 7. 核心物理引擎、運動模擬與平滑渲染過渡 (Lerp)
// =========================================================================
function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();

    if (isDeployed) {
        // 1. 定期開槍循環
        handleWeaponFiringCycle();

        // 2. 移動矩陣計算
        let moveX = 0;
        let moveZ = 0;
        if (keys['KeyW']) moveZ -= 1;
        if (keys['KeyS']) moveZ += 1;
        if (keys['KeyA']) moveX -= 1;
        if (keys['KeyD']) moveX += 1;

        const dir = new THREE.Vector3(moveX, 0, moveZ).normalize();
        dir.applyQuaternion(yawObject.quaternion);

        // 檢查是否按下 Shift 疾跑
        const currentSpeedMultiplier = keys['ShiftLeft'] ? sprintMultiplier : 1.0;
        
        yawObject.position.x += dir.x * moveSpeed * currentSpeedMultiplier;
        yawObject.position.z += dir.z * moveSpeed * currentSpeedMultiplier;

        // 3. 處理重力與跳躍高度物理
        playerVelocity.y += gravity;
        yawObject.position.y += playerVelocity.y;

        // 地面精準阻擋
        if (yawObject.position.y <= 1.6) {
            yawObject.position.y = 1.6;
            playerVelocity.y = 0;
            isGrounded = true;
        }

        // 4. 【高階視覺修復】開鏡瞄準舉槍平滑動畫 (Lerp)
        if (myGunMesh) {
            const spec = WEAPON_SPECS[currentWeapon];
            const target = isAiming ? spec.adsPos : spec.hipPos;

            // 位置線性插值平滑過渡
            myGunMesh.position.x += (target.x - myGunMesh.position.x) * 0.25;
            myGunMesh.position.y += (target.y - myGunMesh.position.y) * 0.25;
            myGunMesh.position.z += (target.z - myGunMesh.position.z) * 0.25;

            // 旋轉線性插值平滑過渡 (帶側向傾斜防呆)
            myGunMesh.rotation.x += (target.rx - myGunMesh.rotation.x) * 0.25;
            myGunMesh.rotation.y += (target.ry - myGunMesh.rotation.y) * 0.25;
            myGunMesh.rotation.z += (target.rz - myGunMesh.rotation.z) * 0.25;

            // 動態拉近相機視野矩陣 (FOV Zoom Effect)
            const targetFOV = isAiming ? (currentWeapon === "SNIPER" ? 20 : 48) : 75;
            camera.fov += (targetFOV - camera.fov) * 0.2;
            camera.updateProjectionMatrix();

            // 準星動態縮放回饋
            const crosshair = document.getElementById('game-crosshair');
            if (crosshair) {
                crosshair.style.transform = `translate(-50%, -50%) scale(${isAiming ? 0.4 : 1.0})`;
            }
        }

        // 5. 即時回報位置數據給 Node 伺服器
        socket.emit('playerUpdate', {
            x: yawObject.position.x,
            y: yawObject.position.y,
            z: yawObject.position.z,
            ry: yawObject.rotation.y
        });
    }

    // 6. 清理與淡出過期的雷射子彈彈道線
    for (let i = bulletTrails.length - 1; i >= 0; i--) {
        if (now - bulletTrails[i].spawnTime > 200) { // 彈道線存活 0.2 秒
            scene.remove(bulletTrails[i].mesh);
            bulletTrails.splice(i, 1);
        }
    }

    // 旋轉中央空投物件
    if (weaponDropMesh) {
        weaponDropMesh.rotation.y += 0.02;
        weaponDropMesh.position.y = 1.0 + Math.sin(now * 0.003) * 0.1; // 懸浮飄浮動效
    }

    renderer.render(scene, camera);
}

// =========================================================================
// 8. Socket.io 網路封包監聽與多玩家狀態機同步
// =========================================================================
socket.on('init', (data) => {
    myId = data.id;
    myTeam = data.team;
    
    const teamSpan = document.getElementById('hud-team');
    if (teamSpan) teamSpan.innerText = myTeam;

    // 清空舊障礙物
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;

    // 建構地圖障礙物
    data.obstacles.forEach(obs => {
        const obsGeo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
        const obsMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.5 });
        const mesh = new THREE.Mesh(obsGeo, obsMat);
        mesh.position.set(obs.x, obs.y, obs.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        obstacles.push(mesh);
    });

    // 渲染已存在的其他遠端特務
    for (let id in data.playerList) {
        if (id !== myId && data.playerList[id].isDeployed) {
            createRemotePlayerMesh(id, data.playerList[id]);
        }
    }
});

socket.on('playerRespawn', (data) => {
    if (data.id === myId) {
        isDeployed = true;
        yawObject.position.set(data.info.x, data.info.y, data.info.z);
        yawObject.rotation.set(0, data.info.ry, 0);
        pitchObject.rotation.set(0, 0, 0);
        
        equipWeaponMesh(currentWeapon);
        
        const menu = document.getElementById('weapon-menu');
        if (menu) menu.style.display = 'none';
        document.body.requestPointerLock();
    } else {
        createRemotePlayerMesh(data.id, data.info);
    }
});

socket.on('playerMoved', (data) => {
    if (remotePlayers[data.id]) {
        remotePlayers[data.id].mesh.position.set(data.info.x, data.info.y, data.info.z);
        remotePlayers[data.id].mesh.rotation.y = data.info.ry;
    }
});

socket.on('playerHurt', (data) => {
    if (data.id === myId) {
        // 更新我自己的血條 HUD
        const hpText = document.getElementById('hud-hp');
        const hpBar = document.getElementById('hp-bar');
        if (hpText) hpText.innerText = data.hp;
        if (hpBar) hpBar.style.width = `${data.hp}%`;
    }
});

socket.on('remoteFire', (attackerId) => {
    if (remotePlayers[attackerId]) {
        // 渲染遠端玩家開槍火焰
        const flashGeo = new THREE.PointLight(0xff9900, 3, 4);
        flashGeo.position.set(0, 0.2, -0.6);
        remotePlayers[attackerId].mesh.add(flashGeo);
        setTimeout(() => {
            if (remotePlayers[attackerId]) remotePlayers[attackerId].mesh.remove(flashGeo);
        }, 50);
    }
});

socket.on('playerDead', (data) => {
    if (data.id === myId) {
        isDeployed = false;
        document.exitPointerLock();
        const menu = document.getElementById('weapon-menu');
        if (menu) menu.style.display = 'block';
    } else if (remotePlayers[data.id]) {
        scene.remove(remotePlayers[data.id].mesh);
        delete remotePlayers[data.id];
    }
});

socket.on('spawnWeaponDrop', (data) => {
    if (weaponDropMesh) scene.remove(weaponDropMesh);

    const dropGroup = new THREE.Group();
    const platformGeo = new THREE.BoxGeometry(2, 0.4, 2);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
    const platform = new THREE.Mesh(platformGeo, goldMat);
    dropGroup.add(platform);

    // 在平台上放置黃金槍支裝飾
    const gunBonus = createVisualWeapon("SNIPER");
    gunBonus.position.y = 0.3;
    gunBonus.scale.set(2, 2, 2);
    dropGroup.add(gunBonus);

    dropGroup.position.set(data.x, 1.2, data.z); // 下調 Y 軸高度，確保跳躍力增強後完美踩踏拾取
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
// 9. 網格輔助生成函數組
// =========================================================================
function createRemotePlayerMesh(id, info) {
    if (remotePlayers[id]) scene.remove(remotePlayers[id].mesh);

    const playerGroup = new THREE.Group();
    playerGroup.userData = { playerId: id };

    // 膠囊形特務身體
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: info.team === "ALPHA" ? 0x0066ff : 0xff2233,
        roughness: 0.4 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    playerGroup.add(body);

    // 加上面向護木頭部，方便辨識轉向
    const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.6, -0.1);
    playerGroup.add(head);

    playerGroup.position.set(info.x, info.y - 1.6, info.z); // 修正對齊底座坐標
    playerGroup.rotation.y = info.ry;
    scene.add(playerGroup);

    remotePlayers[id] = { mesh: playerGroup, info: info };
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 供前端 UI Button 直接點擊呼叫的全局掛載函數
window.deployAgent = function(weaponType) {
    currentWeapon = weaponType;
    socket.emit('selectWeaponAndDeploy', { weapon: weaponType });
};

window.joinQueue = function() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput ? nameInput.value : "Agent";
    initGame();
    socket.emit('joinRoom', { roomId: "MAIN_ARENA", name: name });
};

// =========================================================================
// MULTIPLAYER FIRST-PERSON SHOOTER CORE ENGINE - FRONTEND (app.js)
// TOTAL LINES: 1000+ SYSTEM ARCHITECTURE (NO SHORTCUTS / FULL RENDER LOOP)
// =========================================================================

(function () {
    "use strict";

    // =====================================================================
    // 1. 全局配置與核心狀態管理機 (ENGINE STATES)
    // =====================================================================
    const socket = io(); // 部署於 Render 時自動偵測當前網域

    let scene, camera, renderer;
    let myId = null;
    let myTeam = null;
    let currentWeapon = "RIFLE";
    let isDeployed = false;

    // 基礎物理與客戶端動態運動數值
    const PHYSICS_CONFIG = {
        moveSpeed: 0.11,
        sprintMultiplier: 1.45,
        crouchMultiplier: 0.55,
        gravity: -0.009,         // 精準重力加速度常數
        jumpStrength: 0.19,     // 確保最高跳躍高度能完美踏上 Y=1.2 的黃金平台
        playerRadius: 0.4,
        playerHeight: 1.8,
        eyeHeight: 1.6          // 相機相對於腳底的 Y 軸偏置
    };

    // 當前玩家物理實體狀態
    let playerPosition = { x: 0, y: 1.6, z: 0 };
    let playerVelocity = { x: 0, y: 0, z: 0 };
    let isGrounded = false;
    let isCrouching = false;
    let isSprinting = false;

    // 視角控制系統 (標準 FPS 雙軸階層架構)
    let yawObject = new THREE.Object3D();
    let pitchObject = new THREE.Object3D();

    // 輸入緩衝追蹤器
    const inputBuffer = {};
    let isAiming = false;
    let isShooting = false;
    let lastShotTime = 0;

    // 遊戲世界內對象快取容器
    const remotePlayers = {};
    const obstacles = [];
    let weaponDropMesh = null;
    let myGunMesh = null;

    // 全局粒子系統與動態視覺特效收集佇列
    const bulletTrails = [];
    const particleSystems = [];
    const dynamicLights = [];
    const damageTexts = [];

    // =====================================================================
    // 2. 武器特性與 ADS 第一人稱矩陣變換配置表 (終結木棍透視)
    // =====================================================================
    const WEAPON_DATABASE = {
        RIFLE: {
            name: "突擊步槍 (AR-15 Custom)",
            fireRate: 140,       // 射速 (ms)
            spread: 0.025,      // 腰射彈道擴散
            adsSpread: 0.004,    // 開鏡瞄準彈道擴散
            recoilY: 0.016,      // 垂直後座力最大角度
            recoilX: 0.006,      // 水平後座力左右隨機
            recoilRecovery: 0.1, // 後座力恢復係數
            zoomFOV: 48,         // 開鏡後的視野 FOV
            hipTransform: { x: 0.24, y: -0.24, z: -0.52, rx: 0, ry: 0, rz: 0 },
            adsTransform: { x: 0.0, y: -0.125, z: -0.38, rx: 0.015, ry: 0, rz: 0.06 } // 👈 rz: 0.06 帶來右傾戰術機瞄質感
        },
        SHOTGUN: {
            name: "戰術散彈槍 (M870)",
            fireRate: 850,
            spread: 0.09,
            adsSpread: 0.065,
            recoilY: 0.065,
            recoilX: 0.02,
            recoilRecovery: 0.08,
            zoomFOV: 55,
            hipTransform: { x: 0.22, y: -0.22, z: -0.48, rx: 0, ry: 0, rz: 0 },
            adsTransform: { x: 0.0, y: -0.11, z: -0.34, rx: 0.01, ry: 0, rz: 0.04 }
        },
        SNIPER: {
            name: "重型狙擊槍 (AWM Gold)",
            fireRate: 1300,
            spread: 0.18,
            adsSpread: 0.0,
            recoilY: 0.12,
            recoilX: 0.0,
            recoilRecovery: 0.05,
            zoomFOV: 18,         // 超高倍率縮放
            hipTransform: { x: 0.26, y: -0.26, z: -0.62, rx: 0, ry: 0, rz: 0 },
            adsTransform: { x: 0.0, y: -0.075, z: -0.42, rx: 0, ry: 0, rz: 0 }
        }
    };

    // =====================================================================
    // 3. 遊戲主入口初始化模組 (ENGINE INITIALIZATION)
    // =====================================================================
    function initializeEngineCore() {
        console.log("FPS Engine Core Initializing...");

        // 介面狀態切換
        toggleUIElement('start-screen', false);
        toggleUIElement('lobby-ui', true);

        // 3D 場景核心環境架設
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0b10); 
        scene.fog = new THREE.FogExp2(0x0a0b10, 0.012);

        // 透視相機架設
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
        
        // 建立階層式 Pointer Lock 旋轉結構
        pitchObject.add(camera);
        yawObject.add(pitchObject);
        scene.add(yawObject);

        // 物理基準高度初始化
        yawObject.position.set(0, PHYSICS_CONFIG.eyeHeight, 0);

        // 渲染器高性能配置
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        document.body.appendChild(renderer.domElement);

        // 光照系統布署
        setupSceneLighting();

        // 科技風格賽博戰場地圖建構
        generateCyberBattleground();

        // 渲染動態 2D DOM 疊加 HUD 系統
        buildAdvancedDOMOverlay();

        // 綁定極限輸入事件監聽器
        bindInputSystemEventListeners();

        // 啟動主渲染與物理運算雙循環引擎
        executeMainRenderLoop();

        console.log("FPS Engine Core Online. Systems Stable.");
    }

    // =====================================================================
    // 4. 場景光照與環境建構模組 (ENVIRONMENT GENERATION)
    // =====================================================================
    function setupSceneLighting() {
        const ambientLight = new THREE.AmbientLight(0x222533, 0.4);
        scene.add(ambientLight);

        const primarySun = new THREE.DirectionalLight(0xffffff, 0.7);
        primarySun.position.set(40, 80, 20);
        primarySun.castShadow = true;
        primarySun.shadow.mapSize.width = 2048;
        primarySun.shadow.mapSize.height = 2048;
        primarySun.shadow.camera.near = 0.5;
        primarySun.shadow.camera.far = 250;
        
        const d = 60;
        primarySun.shadow.camera.left = -d;
        primarySun.shadow.camera.right = d;
        primarySun.shadow.camera.top = d;
        primarySun.shadow.camera.bottom = -d;
        primarySun.shadow.bias = -0.0005;
        scene.add(primarySun);

        // 基地霓虹氛圍藍色補光
        const neonCyanLight = new THREE.DirectionalLight(0x00ffff, 0.25);
        neonCyanLight.position.set(-40, 20, -20);
        scene.add(neonCyanLight);
    }

    function generateCyberBattleground() {
        const arenaSize = 160;

        // 1. 地板網格主體
        const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize, 1, 1);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x11131a,
            roughness: 0.8,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // 2. 科技感發光網格
        const gridHelper = new THREE.GridHelper(arenaSize, 80, 0x00ffaa, 0x222633);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);

        // 3. 外圍防逃隔離電子巨牆
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x151922, roughness: 0.5 });
        const wallHeight = 12;
        const wallThickness = 2;

        const wallConfigs = [
            { w: arenaSize, h: wallHeight, d: wallThickness, x: 0, y: wallHeight / 2, z: -arenaSize / 2 },
            { w: arenaSize, h: wallHeight, d: wallThickness, x: 0, y: wallHeight / 2, z: arenaSize / 2 },
            { w: wallThickness, h: wallHeight, d: arenaSize, x: -arenaSize / 2, y: wallHeight / 2, z: 0 },
            { w: wallThickness, h: wallHeight, d: arenaSize, x: arenaSize / 2, y: wallHeight / 2, z: 0 }
        ];

        wallConfigs.forEach(w => {
            const wallGeo = new THREE.BoxGeometry(w.w, w.h, w.d);
            const wallMesh = new THREE.Mesh(wallGeo, wallMat);
            wallMesh.position.set(w.x, w.y, w.z);
            wallMesh.receiveShadow = true;
            wallMesh.castShadow = true;
            scene.add(wallMesh);
            obstacles.push(wallMesh);
        });

        // 4. 新增：戰術掩體與高台矩陣 (Tactical Obstacles & Elevated Platforms)
        const obstacleMat = new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.4, metalness: 0.5 });
        const platformMat = new THREE.MeshStandardMaterial({ color: 0x28354d, roughness: 0.6, metalness: 0.3 });

        const mapStructures = [
            // 中央黃金對決高台 (對應物理跳躍高度 Y=1.2 設計)
            { w: 12, h: 1.2, d: 12, x: 0, y: 0.6, z: 0, mat: platformMat },
            { w: 4, h: 2.4, d: 4, x: 0, y: 1.2, z: 0, mat: obstacleMat }, // 高台中央的圓柱核心掩體

            // 四周戰術十字掩體壁壘
            { w: 6, h: 2.2, d: 1.5, x: -15, y: 1.1, z: -15, mat: obstacleMat },
            { w: 1.5, h: 2.2, d: 6, x: -15, y: 1.1, z: -12, mat: obstacleMat },

            { w: 6, h: 2.2, d: 1.5, x: 15, y: 1.1, z: 15, mat: obstacleMat },
            { w: 1.5, h: 2.2, d: 6, x: 15, y: 1.1, z: 12, mat: obstacleMat },

            { w: 1.5, h: 2.2, d: 8, x: -25, y: 1.1, z: 20, mat: obstacleMat },
            { w: 8, h: 2.2, d: 1.5, x: 25, y: 1.1, z: -20, mat: obstacleMat },

            // 長距離阻絕狙擊邊牆
            { w: 20, h: 4.0, d: 3, x: -45, y: 2.0, z: -5, mat: platformMat },
            { w: 20, h: 4.0, d: 3, x: 45, y: 2.0, z: 5, mat: platformMat }
        ];

        mapStructures.forEach(struct => {
            const geo = new THREE.BoxGeometry(struct.w, struct.h, struct.d);
            const mesh = new THREE.Mesh(geo, struct.mat);
            mesh.position.set(struct.x, struct.y, struct.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            obstacles.push(mesh); // 全數登錄至 AABB 物理引擎
        });
    }

    // =====================================================================
    // 5. 高階第一人稱 3D 槍枝手工組裝模組 (ANTI-STICK WEAPON MODELER)
    // =====================================================================
    function craftTactical3DWeapon(type) {
        const weaponGroup = new THREE.Group();

        // 通用暗黑鎢鋼塗裝材質
        const receiverMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.85, roughness: 0.25 });
        const polymerMat = new THREE.MeshStandardMaterial({ color: 0x111215, metalness: 0.2, roughness: 0.6 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.95, roughness: 0.15 });
        const tritiumMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 }); // 氚氣夜光瞄具

        // 1. 主機匣盒 (Receiver)
        const recGeo = new THREE.BoxGeometry(0.046, 0.065, 0.24);
        const receiver = new THREE.Mesh(recGeo, receiverMat);
        receiver.castShadow = true;
        weaponGroup.add(receiver);

        // 2. 戰術上機匣導軌 (Picatinny Rail)
        const railGeo = new THREE.BoxGeometry(0.016, 0.012, 0.22);
        const rail = new THREE.Mesh(railGeo, steelMat);
        rail.position.set(0, 0.038, -0.01);
        weaponGroup.add(rail);

        // 3. 後照門 (Rear Aperture Sight) -> 消除長條棍子感的關鍵核心
        const rearSightGroup = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(0.024, 0.016, 0.01);
        const baseMesh = new THREE.Mesh(baseGeo, receiverMat);
        rearSightGroup.add(baseMesh);
        
        const ringGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8);
        const ring = new THREE.Mesh(ringGeo, steelMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.012, 0);
        rearSightGroup.add(ring);
        
        rearSightGroup.position.set(0, 0.045, 0.09);
        weaponGroup.add(rearSightGroup);

        // 4. 槍管組件 (Barrel & Gas Block)
        let barrelLength = 0.32;
        if (type === "SNIPER") barrelLength = 0.55;
        if (type === "SHOTGUN") barrelLength = 0.24;

        const barrelGeo = new THREE.CylinderGeometry(0.011, 0.011, barrelLength, 8);
        const barrel = new THREE.Mesh(barrelGeo, steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.008, -(0.12 + barrelLength / 2));
        barrel.castShadow = true;
        weaponGroup.add(barrel);

        // 5. 氚氣螢光前準星 (Front Tritium Sight Blade)
        const frontPostGroup = new THREE.Group();
        const postGeo = new THREE.BoxGeometry(0.006, 0.022, 0.01);
        const post = new THREE.Mesh(postGeo, receiverMat);
        frontPostGroup.add(post);
        
        const glowDotGeo = new THREE.BoxGeometry(0.004, 0.004, 0.004);
        const glowDot = new THREE.Mesh(glowDotGeo, tritiumMat);
        glowDot.position.set(0, 0.008, 0.004);
        frontPostGroup.add(glowDot);

        frontPostGroup.position.set(0, 0.042, -(0.11 + barrelLength));
        weaponGroup.add(frontPostGroup);

        // 6. 下人體工學握把 (Pistol Grip)
        const gripGeo = new THREE.BoxGeometry(0.028, 0.085, 0.036);
        const grip = new THREE.Mesh(gripGeo, polymerMat);
        grip.position.set(0, -0.068, 0.04);
        grip.rotation.x = 0.28;
        weaponGroup.add(grip);

        // 7. 各武器特有特徵構造分支
        if (type === "RIFLE") {
            // 曲弧形彈匣
            const magGeo = new THREE.BoxGeometry(0.024, 0.13, 0.05);
            const mag = new THREE.Mesh(magGeo, polymerMat);
            mag.position.set(0, -0.085, -0.06);
            mag.rotation.x = -0.22;
            weaponGroup.add(mag);

            // 鏤空散熱護木
            const handguardGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8);
            const handguard = new THREE.Mesh(handguardGeo, polymerMat);
            handguard.rotation.x = Math.PI / 2;
            handguard.position.set(0, 0.008, -0.2);
            weaponGroup.add(handguard);
        } 
        else if (type === "SNIPER") {
            // 高倍率特戰狙擊鏡組 (Advanced Scope Assembly)
            const scopeContainer = new THREE.Group();
            const mainTubeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.18, 12);
            const mainTube = new THREE.Mesh(mainTubeGeo, receiverMat);
            mainTube.rotation.x = Math.PI / 2;
            scopeContainer.add(mainTube);

            // 前遮光罩大口徑筒
            const bellGeo = new THREE.CylinderGeometry(0.026, 0.018, 0.05, 12);
            const bell = new THREE.Mesh(bellGeo, receiverMat);
            bell.rotation.x = Math.PI / 2;
            bell.position.z = -0.09;
            scopeContainer.add(bell);

            // 狙擊鏡反光鏡面
            const lensGeo = new THREE.CircleGeometry(0.016, 16);
            const lensMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
            const lens = new THREE.Mesh(lensGeo, lensMat);
            lens.position.set(0, 0, 0.091);
            scopeContainer.add(lens);

            // 鏡座
            const mountGeo = new THREE.BoxGeometry(0.012, 0.03, 0.08);
            const mount = new THREE.Mesh(mountGeo, steelMat);
            mount.position.y = -0.02;
            scopeContainer.add(mount);

            scopeContainer.position.set(0, 0.07, -0.01);
            weaponGroup.add(scopeContainer);

            // 直型盒狀彈匣
            const sMagGeo = new THREE.BoxGeometry(0.024, 0.09, 0.045);
            const sMag = new THREE.Mesh(sMagGeo, receiverMat);
            sMag.position.set(0, -0.075, -0.04);
            weaponGroup.add(sMag);
        } 
        else if (type === "SHOTGUN") {
            // 下方泵動管狀彈倉與握木護手
            const pumpGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8);
            const pump = new THREE.Mesh(pumpGeo, polymerMat);
            pump.rotation.x = Math.PI / 2;
            pump.position.set(0, -0.012, -0.18);
            weaponGroup.add(pump);
        }

        return weaponGroup;
    }

    function syncActiveWeaponTransformMesh(type) {
        if (myGunMesh) pitchObject.remove(myGunMesh);
        
        myGunMesh = craftTactical3DWeapon(type);
        
        // 設定初始預設腰射變換坐標
        const t = WEAPON_DATABASE[type].hipTransform;
        myGunMesh.position.set(t.x, t.y, t.z);
        pitchObject.add(myGunMesh);
    }

    // =====================================================================
    // 6. DOM HUD 與動態戰術圖形元件生成 (ADVANCED GUI MODULE)
    // =====================================================================
    function toggleUIElement(id, show) {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'block' : 'none';
    }

    function buildAdvancedDOMOverlay() {
        // 1. 全方位殺戮流動式通知通知欄 (Killfeed Layer)
        if (!document.getElementById('killfeed-container')) {
            const kf = document.createElement('div');
            kf.id = 'killfeed-container';
            Object.assign(kf.style, {
                position: 'absolute', top: '20px', right: '20px',
                width: '320px', display: 'flex', flexDirection: 'column',
                gap: '6px', pointerEvents: 'none', zIndex: '2000',
                fontFamily: '"Courier New", monospace', fontSize: '14px'
            });
            document.body.appendChild(kf);
        }

        // 2. 特種雷達掃描雷達 HUD 元件 (Radar System)
        if (!document.getElementById('tactical-radar')) {
            const radar = document.createElement('div');
            radar.id = 'tactical-radar';
            Object.assign(radar.style, {
                position: 'absolute', top: '20px', left: '20px',
                width: '110px', height: '110px', borderRadius: '50%',
                background: 'rgba(10, 15, 26, 0.75)', border: '2px solid #00ffaa',
                boxShadow: '0 0 12px rgba(0,255,170,0.3)', pointerEvents: 'none',
                zIndex: '2000', overflow: 'hidden'
            });
            
            const sweep = document.createElement('div');
            Object.assign(sweep.style, {
                width: '100%', height: '100%',
                background: 'linear-gradient(45deg, rgba(0,255,170,0.2) 0%, transparent 50%)',
                transformOrigin: '50% 50%', animation: 'radarRotate 2s linear infinite'
            });
            
            const radarStyle = document.createElement('style');
            radarStyle.innerHTML = `
                @keyframes radarRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .radar-dot { position: absolute; width: 6px; height: 6px; border-radius: 50%; transform: translate(-50%, -50%); }
                .radar-alpha { background: #0088ff; box-shadow: 0 0 6px #0088ff; }
                .radar-omega { background: #ff3300; box-shadow: 0 0 6px #ff3300; }
            `;
            document.head.appendChild(radarStyle);
            radar.appendChild(sweep);
            document.body.appendChild(radar);
        }
    }

    function pushKillfeedNotification(attacker, target) {
        const container = document.getElementById('killfeed-container');
        if (!container) return;

        const feed = document.createElement('div');
        Object.assign(feed.style, {
            background: 'rgba(15, 20, 30, 0.85)', borderLeft: '4px solid #ffaa00',
            padding: '6px 12px', color: '#fff', borderRadius: '0 4px 4px 0',
            display: 'flex', justifyContent: 'space-between', animation: 'fadeInRight 0.2s ease-out'
        });
        feed.innerHTML = `<span style="color:#00e5ff">${attacker}</span> <span style="color:#ff3b30">⚔</span> <span style="color:#ffcc00">${target}</span>`;
        
        container.appendChild(feed);
        setTimeout(() => {
            feed.style.animation = 'fadeOutRight 0.3s ease-in';
            setTimeout(() => feed.remove(), 300);
        }, 4000);
    }

    // =====================================================================
    // 7. 鍵盤滑鼠極速異步核心輸入系統 (INPUT RECEPTOR)
    // =====================================================================
    function bindInputSystemEventListeners() {
        window.addEventListener('keydown', (e) => {
            inputBuffer[e.code] = true;
            
            // 戰術蹲下轉換
            if (e.code === 'KeyC' && isDeployed) {
                isCrouching = !isCrouching;
                PHYSICS_CONFIG.eyeHeight = isCrouching ? 0.9 : 1.6;
            }

            // 核心物理：執行高空彈跳
            if (e.code === 'Space' && isGrounded && isDeployed) {
                playerVelocity.y = PHYSICS_CONFIG.jumpStrength;
                isGrounded = false;
            }
        });

        window.addEventListener('keyup', (e) => { inputBuffer[e.code] = false; });

        window.addEventListener('mousedown', (e) => {
    // 🔒 檢查是否鎖定滑鼠指標，防止在大廳或選單時誤開槍
    if (document.pointerLockElement !== document.body) return;
    
    // 🖱️ 檢查是否點擊滑鼠左鍵 (e.button === 0)
    if (e.button === 0) {
        
        // 📏 A. 設定子彈發射起點 (以相機位置為基準，y 軸稍微往下調 0.2 當作模擬槍口位置)
        const fromPos = { 
            x: camera.position.x, 
            y: camera.position.y - 0.2, 
            z: camera.position.z 
        };
        
        // 🧭 B. 獲取相機目前正面向的 3D 朝向向量
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        // 🚀 C. 計算子彈往前飛行 75 個單位距離後的終點 3D 座標
        const toPos = {
            x: camera.position.x + direction.x * 75,
            y: camera.position.y + direction.y * 75,
            z: camera.position.z + direction.z * 75
        };

        // 📡 D. 將資料打包送往 server.js (包含你原本雷達用的 x, z 軸，與新的 bulletPath)
        socket.emit('playerFire', {
            x: camera.position.x,
            z: camera.position.z,
            bulletPath: { from: fromPos, to: toPos }
        });

        // 🔄 觸發你原本的連發半自動/全自動開火循環邏輯
        isShooting = true; 

    } else if (e.button === 2) {
        // 🔍 右鍵 ADS 舉槍機械瞄準狀態
        isAiming = true;   
    }
});

        window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isShooting = false; // 停止連發循環
    } else if (e.button === 2) {
        isAiming = false;   // 解除機瞄狀態
    }
});

        // 二維滑鼠差值微分演算法轉換為 FPS 三維相機 Pitch/Yaw 旋轉角
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                // 如果正處於機械開鏡開鏡狀態，滑鼠阻尼係數拉高，調低動態靈敏度
                const dynamicSensitivity = isAiming ? 0.0009 : 0.0022;
                
                yawObject.rotation.y -= e.movementX * dynamicSensitivity;
                pitchObject.rotation.x -= e.movementY * dynamicSensitivity;
                
                // 上下看極限仰俯角限制防穿透 (約正負 86 度)
                pitchObject.rotation.x = Math.max(-Math.PI / 2.08, Math.min(Math.PI / 2.08, pitchObject.rotation.x));
            }
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // =====================================================================
    // 8. 硬核 AABB 立體封閉射線碰撞演算法模組 (CUSTOM RUNTIME COLLISION ENGINE)
    // =====================================================================
    function executeAABBMovementCollisionDetection(oldPos) {
        // 建造玩家當前的立體包圍盒 (Bounding Box)
        const pRadius = PHYSICS_CONFIG.playerRadius;
        const pHeight = PHYSICS_CONFIG.playerHeight;
        
        // 計算玩家的腳底位置
        const footY = yawObject.position.y - PHYSICS_CONFIG.eyeHeight;

        const playerBox = new THREE.Box3(
            new THREE.Vector3(yawObject.position.x - pRadius, footY, yawObject.position.z - pRadius),
            new THREE.Vector3(yawObject.position.x + pRadius, footY + pHeight, yawObject.position.z + pRadius)
        );

        let hitAnyObstacleFloor = false;

        for (let i = 0; i < obstacles.length; i++) {
            const obsBox = new THREE.Box3().setFromObject(obstacles[i]);
            
            if (playerBox.intersectsBox(obsBox)) {
                // 1. 垂直落腳踩踏判定 (Vertical Step/Platform Collision)
                const previousFootY = oldPos.y - PHYSICS_CONFIG.eyeHeight;
                if (previousFootY >= obsBox.max.y - 0.25 && playerVelocity.y <= 0) {
                    yawObject.position.y = obsBox.max.y + PHYSICS_CONFIG.eyeHeight;
                    playerVelocity.y = 0;
                    hitAnyObstacleFloor = true;
                    isGrounded = true;
                    continue;
                }

                // 2. 水平 X-Z 軸物理排擠回彈演算法 (Horizontal Push-back)
                const overlapX = Math.min(playerBox.max.x - obsBox.min.x, obsBox.max.x - playerBox.min.x);
                const overlapZ = Math.min(playerBox.max.z - obsBox.min.z, obsBox.max.z - playerBox.min.z);

                if (overlapX < overlapZ) {
                    yawObject.position.x = (yawObject.position.x > (obsBox.min.x + obsBox.max.x) / 2) ? obsBox.max.x + pRadius : obsBox.min.x - pRadius;
                } else {
                    yawObject.position.z = (yawObject.position.z > (obsBox.min.z + obsBox.max.z) / 2) ? obsBox.max.z + pRadius : obsBox.min.z - pRadius;
                }
                
                // 重新計算包圍盒以利下一輪迴圈精準剔除
                const updatedFootY = yawObject.position.y - PHYSICS_CONFIG.eyeHeight;
                playerBox.set(
                    new THREE.Vector3(yawObject.position.x - pRadius, updatedFootY, yawObject.position.z - pRadius),
                    new THREE.Vector3(yawObject.position.x + pRadius, updatedFootY + pHeight, yawObject.position.z + pRadius)
                );
            }
        }

        // 如果沒有踩在任何實體方塊平台上，判定是否落回無限大地板
        if (!hitAnyObstacleFloor) {
            if (yawObject.position.y <= PHYSICS_CONFIG.eyeHeight) {
                yawObject.position.y = PHYSICS_CONFIG.eyeHeight;
                playerVelocity.y = 0;
                isGrounded = true;
            } else {
                isGrounded = false;
            }
        }
    }

    // =====================================================================
    // 9. 射擊彈道幾何物理散佈與粒子特效模組 (BALLISTICS & PARTICLE EMITTER)
    // =====================================================================
    function triggerWeaponFiringProcess() {
        if (!isShooting || !isDeployed) return;

        const now = Date.now();
        const spec = WEAPON_DATABASE[currentWeapon];

        if (now - lastShotTime >= spec.fireRate) {
            lastShotTime = now;

            // 廣播至 Node 伺服器
            socket.emit('playerFire');

            // 1. 動態後座力與視覺震撼偏移量演算
            pitchObject.rotation.x += spec.recoilY;
            yawObject.rotation.y += (Math.random() - 0.5) * spec.recoilX;

            // 2. 第一人稱模型劇烈後座力位移
            if (myGunMesh) myGunMesh.position.z += 0.085;

            // 3. 槍口動態點光源火光閃爍
            spawnMuzzleFlashDynamicLight();

            // 4. 根據腰射或開鏡計算高階散佈
            const activeSpread = isAiming ? spec.adsSpread : spec.spread;

            if (currentWeapon === "SHOTGUN") {
                // 散彈槍單次爆發 8 發獨立碎彈線
                for (let s = 0; s < 8; s++) {
                    castDynamicProjectileRay(activeSpread);
                }
            } else {
                castDynamicProjectileRay(activeSpread);
            }
        }
    }

    function spawnMuzzleFlashDynamicLight() {
        const flash = new THREE.PointLight(0xff9900, 3.5, 6);
        flash.position.set(0, 0.02, -0.38);
        myGunMesh.add(flash);
        setTimeout(() => { if (myGunMesh) myGunMesh.remove(flash); }, 35);
    }

    function castDynamicProjectileRay(spreadValue) {
        const raycaster = new THREE.Raycaster();
        
        // 高階高斯彈道擴散偏置矩陣
        const spreadX = (Math.random() - 0.5) * spreadValue;
        const spreadY = (Math.random() - 0.5) * spreadValue;
        
        raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

        const camWorldPos = new THREE.Vector3();
        camera.getWorldPosition(camWorldPos);

        // 微調起點讓雷射光束精準由槍口噴發
        const laserOrigin = camWorldPos.clone();
        laserOrigin.x += 0.08; laserOrigin.y -= 0.1;

        const laserEndpoint = new THREE.Vector3();
        const maxRangeVector = raycaster.ray.direction.clone().multiplyScalar(120);
        laserEndpoint.addVectors(camWorldPos, maxRangeVector);

        // 收集潛在敵方特務碰撞靶
        const enemyTargets = [];
        for (let id in remotePlayers) {
            if (remotePlayers[id].mesh) enemyTargets.push(remotePlayers[id].mesh);
        }

        const sceneHits = raycaster.intersectObjects(enemyTargets, true);

        if (sceneHits.length > 0) {
            laserEndpoint.copy(sceneHits[0].point);
            
            // 解碼溯源被擊中 Mesh 的特務 ID
            let rootNode = sceneHits[0].object;
            while (rootNode.parent && !rootNode.userData.playerId) {
                rootNode = rootNode.parent;
            }

            const enemyId = rootNode.userData.playerId;
            if (enemyId) {
                socket.emit('playerShot', enemyId);
                triggerUIHitmarkerFeedback();
            }
            
            // 在撞擊點噴發火花粒子碎屑
            spawnImpactParticles(sceneHits[0].point, sceneHits[0].face.normal);
        }

        // 3D 空間渲染雷射彈道光束線
        generateLaserTrail3DLine(laserOrigin, laserEndpoint);
    }

    function generateLaserTrail3DLine(start, end) {
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({
            color: currentWeapon === "SNIPER" ? 0xff0055 : 0xffcc33,
            transparent: true, opacity: 0.75
        });
        const line = new THREE.Line(geo, mat);
        scene.add(line);
        bulletTrails.push({ mesh: line, creationTime: Date.now() });
    }

    function spawnImpactParticles(pos, normal) {
        const particleCount = 6;
        const geometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const meshes = [];

        for (let i = 0; i < particleCount; i++) {
            const p = new THREE.Mesh(geometry, material);
            p.position.copy(pos);
            
            // 給予物理噴發初速度向量
            p.userData = {
                velocity: new THREE.Vector3(
                    normal.x * 2 + (Math.random() - 0.5) * 2,
                    normal.y * 2 + Math.random() * 2,
                    normal.z * 2 + (Math.random() - 0.5) * 2
                ).multiplyScalar(0.03),
                age: 0
            };
            scene.add(p);
            meshes.push(p);
        }
        particleSystems.push(meshes);
    }

    function triggerUIHitmarkerFeedback() {
        const hm = document.createElement('div');
        hm.className = 'hit-marker';
        Object.assign(hm.style, {
            position: 'absolute', top: '50%', left: '50%',
            width: '24px', height: '24px', transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', zIndex: '2001'
        });
        hm.innerHTML = `
            <div style="position:absolute; top:0; left:0; width:2px; height:8px; background:red; transform:rotate(45deg); transform-origin:top left;"></div>
            <div style="position:absolute; top:0; right:0; width:2px; height:8px; background:red; transform:rotate(-45deg); transform-origin:top right;"></div>
            <div style="position:absolute; bottom:0; left:0; width:2px; height:8px; background:red; transform:rotate(-45deg); transform-origin:bottom left;"></div>
            <div style="position:absolute; bottom:0; right:0; width:2px; height:8px; background:red; transform:rotate(45deg); transform-origin:bottom right;"></div>
        `;
        document.body.appendChild(hm);
        setTimeout(() => hm.remove(), 110);
    }

    // =====================================================================
    // 10. 全功能核心渲染與物理運算雙循環引擎 (MAIN ENGINE TICK LOOP)
    // =====================================================================
    function executeMainRenderLoop() {
        requestAnimationFrame(executeMainRenderLoop);

        const timestampNow = Date.now();
        const oldPlayerPosition = yawObject.position.clone();

        if (isDeployed) {
            // 1. 每一個 Tick 自動執行開火速率判定
            triggerWeaponFiringProcess();

            // 2. 鍵盤輸入緩衝解算移動向量矩陣
            let inputDirX = 0;
            let inputDirZ = 0;

            if (inputBuffer['KeyW']) inputDirZ -= 1;
            if (inputBuffer['KeyS']) inputDirZ += 1;
            if (inputBuffer['KeyA']) inputDirX -= 1;
            if (inputBuffer['KeyD']) inputDirX += 1;

            const movementVector = new THREE.Vector3(inputDirX, 0, inputDirZ).normalize();
            movementVector.applyQuaternion(yawObject.quaternion);

            // 計算動態速率加權 (疾跑 / 蹲下狀態衰減)
            let velocityModifier = 1.0;
            if (inputBuffer['ShiftLeft'] && !isAiming && inputDirZ < 0) {
                isSprinting = true;
                velocityModifier = PHYSICS_CONFIG.sprintMultiplier;
            } else {
                isSprinting = false;
                if (isCrouching) velocityModifier = PHYSICS_CONFIG.crouchMultiplier;
            }

            yawObject.position.x += movementVector.x * PHYSICS_CONFIG.moveSpeed * velocityModifier;
            yawObject.position.z += movementVector.z * PHYSICS_CONFIG.moveSpeed * velocityModifier;

            // 3. 處理重力落體物理加速度
            playerVelocity.y += PHYSICS_CONFIG.gravity;
            yawObject.position.y += playerVelocity.y;

            // 4. 執行客製化封閉式 AABB 碰撞阻擋迴圈
            executeAABBMovementCollisionDetection(oldPlayerPosition);

            // 5. 【高階第一人稱平滑矩陣變換】開鏡瞄準舉槍 (Lerp)
            if (myGunMesh) {
                const spec = WEAPON_DATABASE[currentWeapon];
                
                // 根據開鏡狀態選擇目標變換空間矩陣
                const targetTransform = isAiming ? spec.adsTransform : spec.hipTransform;

                // 槍身平滑線性差值 Lerp 過渡 (0.24 彈性速率)
                myGunMesh.position.x += (targetTransform.x - myGunMesh.position.x) * 0.24;
                myGunMesh.position.y += (targetTransform.y - myGunMesh.position.y) * 0.24;
                myGunMesh.position.z += (targetTransform.z - myGunMesh.position.z) * 0.24;

                myGunMesh.rotation.x += (targetTransform.rx - myGunMesh.rotation.x) * 0.24;
                myGunMesh.rotation.y += (targetTransform.ry - myGunMesh.rotation.y) * 0.24;
                myGunMesh.rotation.z += (targetTransform.rz - myGunMesh.rotation.z) * 0.24;

                // 開鏡後座力恢復演算 (Recoil Recovery)
                pitchObject.rotation.x += (0 - pitchObject.rotation.x) * spec.recoilRecovery;

                // 相機 FOV 鏡頭縮放平滑轉化
                const targetCameraFOV = isAiming ? spec.zoomFOV : 75;
                camera.fov += (targetCameraFOV - camera.fov) * 0.22;
                camera.updateProjectionMatrix();

                // 2D 螢幕中心十字準星動態隨移動狀態與瞄準縮放
                const ch = document.getElementById('game-crosshair');
                if (ch) {
                    let crosshairScale = isAiming ? 0.35 : 1.0;
                    if (movementVector.lengthSq() > 0) crosshairScale *= 1.3; // 移動時準星擴大
                    ch.style.transform = `translate(-50%, -50%) scale(${crosshairScale})`;
                }
            }

            // 6. 即時封包打包上傳網路伺服器
            socket.emit('playerUpdate', {
                x: yawObject.position.x,
                y: yawObject.position.y,
                z: yawObject.position.z,
                ry: yawObject.rotation.y
            });
        }

        // 7. 特效回收清理核心線程 (GC Effects)
        for (let i = bulletTrails.length - 1; i >= 0; i--) {
            if (timestampNow - bulletTrails[i].creationTime > 160) {
                scene.remove(bulletTrails[i].mesh);
                bulletTrails.splice(i, 1);
            }
        }

        // 火花粒子彈跳與淡出物理演算
        for (let i = particleSystems.length - 1; i >= 0; i--) {
            const meshes = particleSystems[i];
            let allDead = true;

            meshes.forEach(p => {
                p.position.add(p.userData.velocity);
                p.userData.velocity.y += -0.05; // 碎屑微重力
                p.userData.age += 1;
                if (p.userData.age > 25) {
                    scene.remove(p);
                } else {
                    allDead = false;
                }
            });

            if (allDead) particleSystems.splice(i, 1);
        }

        // 戰術空投黃金方塊動態漂浮旋轉
        if (weaponDropMesh) {
            weaponDropMesh.rotation.y += 0.016;
            weaponDropMesh.position.y = 1.1 + Math.sin(timestampNow * 0.0025) * 0.12;
        }

        // 即時戰術小地圖/雷達同位映射渲染
        updateTacticalRadarCoordinates();

        renderer.render(scene, camera);
    }

    // =====================================================================
    // 11. 戰術雷達與同位投影模組 (TACTICAL RADAR RADIAL PROJECTION)
    // =====================================================================
    function updateTacticalRadarCoordinates() {
        const radar = document.getElementById('tactical-radar');
        if (!radar || !isDeployed) return;

        // 清空既有舊點標籤
        const legacyDots = radar.querySelectorAll('.radar-dot');
        legacyDots.forEach(d => d.remove());

        const centerPos = yawObject.position;
        const radarScale = 1.4; // 縮放級別控制半徑視野

        for (let id in remotePlayers) {
            const rp = remotePlayers[id];
            if (!rp.mesh) continue;

            const dx = rp.mesh.position.x - centerPos.x;
            const dz = rp.mesh.position.z - centerPos.z;

            // 計算二維極坐標半徑
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < 45) { // 超過 45 米不顯示於雷達
                const dot = document.createElement('div');
                dot.className = `radar-dot ${rp.info.team === myTeam ? 'radar-alpha' : 'radar-omega'}`;
                
                // 相對映射坐標轉為百分比定位
                const leftPercent = 50 + (dx * radarScale);
                const topPercent = 50 + (dz * radarScale);
                
                Object.assign(dot.style, {
                    left: `${Math.max(5, Math.min(95, leftPercent))}%`,
                    top: `${Math.max(5, Math.min(95, topPercent))}%`
                });
                radar.appendChild(dot);
            }
        }
    }

    // =====================================================================
    // 12. SOCKET.IO 全球廣播網路事件接收接聽模組 (NETWORK NETWORK SYNC)
    // =====================================================================
    socket.on('init', (data) => {
        myId = data.id;
        myTeam = data.team;
        
        const tSpan = document.getElementById('hud-team');
        if (tSpan) tSpan.innerText = myTeam;

        // 伺服器同步清除並全面重建靜態碰撞體
        obstacles.forEach(o => scene.remove(o));
        obstacles.length = 0;

        data.obstacles.forEach(obs => {
            const obsGeo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
            const obsMat = new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.45 });
            const mesh = new THREE.Mesh(obsGeo, obsMat);
            mesh.position.set(obs.x, obs.y, obs.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            obstacles.push(mesh);
        });

        // 建立遠端同場特務
        for (let id in data.playerList) {
            if (id !== myId && data.playerList[id].isDeployed) {
                spawnRemoteAgentMeshInScene(id, data.playerList[id]);
            }
        }
    });

    socket.on('playerRespawn', (data) => {
        if (data.id === myId) {
            isDeployed = true;
            yawObject.position.set(data.info.x, data.info.y, data.info.z);
            yawObject.rotation.set(0, data.info.ry, 0);
            pitchObject.rotation.set(0, 0, 0);
            playerVelocity.y = 0;
            
            syncActiveWeaponTransformMesh(currentWeapon);
            
            toggleUIElement('weapon-menu', false);
            document.body.requestPointerLock();
        } else {
            spawnRemoteAgentMeshInScene(data.id, data.info);
        }
    });

    socket.on('playerMoved', (data) => {
        if (remotePlayers[data.id]) {
            remotePlayers[data.id].mesh.position.set(data.info.x, data.info.y - PHYSICS_CONFIG.eyeHeight, data.info.z);
            remotePlayers[data.id].mesh.rotation.y = data.info.ry;
        }
    });

    socket.on('playerHurt', (data) => {
        if (data.id === myId) {
            const t = document.getElementById('hud-hp');
            const b = document.getElementById('hp-bar');
            if (t) t.innerText = data.hp;
            if (b) b.style.width = `${data.hp}%`;
        }
    });

    socket.on('remoteFire', (attackerId) => {
        if (remotePlayers[attackerId]) {
            const rFlash = new THREE.PointLight(0xff6600, 3, 5);
            rFlash.position.set(0, 0.8, -0.6);
            remotePlayers[attackerId].mesh.add(rFlash);
            setTimeout(() => { if (remotePlayers[attackerId]) remotePlayers[attackerId].mesh.remove(rFlash); }, 45);
        }
    });

    socket.on('killFeed', (data) => {
        pushKillfeedNotification(data.attackerName, data.targetName);
    });

    socket.on('playerDead', (data) => {
        if (data.id === myId) {
            isDeployed = false;
            isShooting = false;
            isAiming = false;
            document.exitPointerLock();
            toggleUIElement('weapon-menu', true);
        } else if (remotePlayers[data.id]) {
            scene.remove(remotePlayers[data.id].mesh);
            delete remotePlayers[data.id];
        }
    });

    socket.on('spawnWeaponDrop', (data) => {
        if (weaponDropMesh) {
            scene.remove(weaponDropMesh);
            const index = obstacles.indexOf(weaponDropMesh.userData.collisionBoxMesh);
            if (index > -1) obstacles.splice(index, 1);
        }

        const dropGroup = new THREE.Group();
        
        // 🛠️ 最佳化合理尺寸平台：寬 3, 厚 0.5, 深 3 (面積加大，保證輕鬆跳上踩踏)
        const platGeo = new THREE.BoxGeometry(3, 0.5, 3);
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.1 });
        const platform = new THREE.Mesh(platGeo, goldMat);
        platform.castShadow = true;
        platform.receiveShadow = true;
        dropGroup.add(platform);

        // 平台頂部生成懸浮展示狙擊槍
        const gunBonus = craftTactical3DWeapon("SNIPER");
        gunBonus.position.y = 0.4;
        gunBonus.scale.set(1.4, 1.4, 1.4);
        dropGroup.add(gunBonus);

        // 設定合理中心 Y=1.2。頂部表面在 Y=1.45。跳躍高度 Y=1.62 可隨意完美站立！
        dropGroup.position.set(data.x, 1.2, data.z);
        scene.add(dropGroup);
        
        dropGroup.userData = { collisionBoxMesh: platform };
        obstacles.push(platform); // 塞入實體障礙物陣列，賦予踩踏物理碰撞體
        
        weaponDropMesh = dropGroup;
    });

    socket.on('weaponPickedUp', () => {
        if (weaponDropMesh) {
            const index = obstacles.indexOf(weaponDropMesh.userData.collisionBoxMesh);
            if (index > -1) obstacles.splice(index, 1);
            
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

    // =====================================================================
    // 13. 遠端特務立體模型組裝函數組 (REMOTE CHARACTER FACTORY)
    // =====================================================================
    function spawnRemoteAgentMeshInScene(id, info) {
        if (remotePlayers[id]) scene.remove(remotePlayers[id].mesh);

        const group = new THREE.Group();
        group.userData = { playerId: id };

        // 身體主結構
        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: info.team === "ALPHA" ? 0x0066ff : 0xff2233, roughness: 0.4
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // 面向方塊頭部
        const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 1.62, -0.05);
        group.add(head);

        // 對齊物理基準點
        group.position.set(info.x, info.y - PHYSICS_CONFIG.eyeHeight, info.z);
        group.rotation.y = info.ry;
        scene.add(group);

        remotePlayers[id] = { mesh: group, info: info };
    }

    // =====================================================================
    // 14. 網頁全域名稱空間函數綁定 (WINDOW EXPOSURE GLOBAL BRIDGE)
    // =====================================================================
    window.deployAgent = function (weaponType) {
        currentWeapon = weaponType;
        socket.emit('selectWeaponAndDeploy', { weapon: weaponType });
    };

    window.joinQueue = function () {
        const input = document.getElementById('player-name');
        const nickName = input ? input.value.trim() : "特務 Agent";
        initializeEngineCore();
        socket.emit('joinRoom', { roomId: "MAIN_ARENA", name: nickName });
    };

})();

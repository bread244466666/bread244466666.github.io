// =========================================================================
// MULTIPLAYER FIRST-PERSON SHOOTER CORE ENGINE - FRONTEND (app.js)
// TOTAL LINES: FULL SYSTEM ARCHITECTURE - PRODUCTION READY
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
    let myGunMesh = null;

    // 全局粒子系統與動態視覺特效收集佇列
    const bulletTrails = [];
    const particleSystems = [];

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

        // 將場景掛載至 window 供子彈渲染模組跨域存取
        window.scene = scene;

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

        const neonCyanLight = new THREE.DirectionalLight(0x00ffff, 0.25);
        neonCyanLight.position.set(-40, 20, -20);
        scene.add(neonCyanLight);
    }

    function generateCyberBattleground() {
        const arenaSize = 160;

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

        const gridHelper = new THREE.GridHelper(arenaSize, 80, 0x00ffaa, 0x222633);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);

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

        const obstacleMat = new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.4, metalness: 0.5 });
        const platformMat = new THREE.MeshStandardMaterial({ color: 0x28354d, roughness: 0.6, metalness: 0.3 });

        const mapStructures = [
            { w: 12, h: 1.2, d: 12, x: 0, y: 0.6, z: 0, mat: platformMat },
            { w: 4, h: 2.4, d: 4, x: 0, y: 1.2, z: 0, mat: obstacleMat }, 
            { w: 6, h: 2.2, d: 1.5, x: -15, y: 1.1, z: -15, mat: obstacleMat },
            { w: 1.5, h: 2.2, d: 6, x: -15, y: 1.1, z: -12, mat: obstacleMat },
            { w: 6, h: 2.2, d: 1.5, x: 15, y: 1.1, z: 15, mat: obstacleMat },
            { w: 1.5, h: 2.2, d: 6, x: 15, y: 1.1, z: 12, mat: obstacleMat },
            { w: 1.5, h: 2.2, d: 8, x: -25, y: 1.1, z: 20, mat: obstacleMat },
            { w: 8, h: 2.2, d: 1.5, x: 25, y: 1.1, z: -20, mat: obstacleMat },
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
            obstacles.push(mesh); 
        });
    }

    // =====================================================================
    // 5. 高階第一人稱 3D 槍枝手工組裝模組 (ANTI-STICK WEAPON MODELER)
    // =====================================================================
    function craftTactical3DWeapon(type) {
        const weaponGroup = new THREE.Group();

        const receiverMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.85, roughness: 0.25 });
        const polymerMat = new THREE.MeshStandardMaterial({ color: 0x111215, metalness: 0.2, roughness: 0.6 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.95, roughness: 0.15 });
        const tritiumMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 }); 

        const recGeo = new THREE.BoxGeometry(0.046, 0.065, 0.24);
        const receiver = new THREE.Mesh(recGeo, receiverMat);
        receiver.castShadow = true;
        weaponGroup.add(receiver);

        const railGeo = new THREE.BoxGeometry(0.016, 0.012, 0.22);
        const rail = new THREE.Mesh(railGeo, steelMat);
        rail.position.set(0, 0.038, -0.01);
        weaponGroup.add(rail);

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

        let barrelLength = 0.32;
        if (type === "SNIPER") barrelLength = 0.55;
        if (type === "SHOTGUN") barrelLength = 0.24;

        const barrelGeo = new THREE.CylinderGeometry(0.011, 0.011, barrelLength, 8);
        const barrel = new THREE.Mesh(barrelGeo, steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.008, -(0.12 + barrelLength / 2));
        barrel.castShadow = true;
        weaponGroup.add(barrel);

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

        const gripGeo = new THREE.BoxGeometry(0.028, 0.085, 0.036);
        const grip = new THREE.Mesh(gripGeo, polymerMat);
        grip.position.set(0, -0.068, 0.04);
        grip.rotation.x = 0.28;
        weaponGroup.add(grip);

        if (type === "RIFLE") {
            const magGeo = new THREE.BoxGeometry(0.024, 0.13, 0.05);
            const mag = new THREE.Mesh(magGeo, polymerMat);
            mag.position.set(0, -0.085, -0.06);
            mag.rotation.x = -0.22;
            weaponGroup.add(mag);

            const handguardGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8);
            const handguard = new THREE.Mesh(handguardGeo, polymerMat);
            handguard.rotation.x = Math.PI / 2;
            handguard.position.set(0, 0.008, -0.2);
            weaponGroup.add(handguard);
        } 
        else if (type === "SNIPER") {
            const scopeContainer = new THREE.Group();
            const mainTubeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.18, 12);
            const mainTube = new THREE.Mesh(mainTubeGeo, receiverMat);
            mainTube.rotation.x = Math.PI / 2;
            scopeContainer.add(mainTube);

            const bellGeo = new THREE.CylinderGeometry(0.026, 0.018, 0.05, 12);
            const bell = new THREE.Mesh(bellGeo, receiverMat);
            bell.rotation.x = Math.PI / 2;
            bell.position.z = -0.09;
            scopeContainer.add(bell);

            const lensGeo = new THREE.CircleGeometry(0.016, 16);
            const lensMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
            const lens = new THREE.Mesh(lensGeo, lensMat);
            lens.position.set(0, 0, 0.091);
            scopeContainer.add(lens);

            const mountGeo = new THREE.BoxGeometry(0.012, 0.03, 0.08);
            const mount = new THREE.Mesh(mountGeo, steelMat);
            mount.position.y = -0.02;
            scopeContainer.add(mount);

            scopeContainer.position.set(0, 0.07, -0.01);
            weaponGroup.add(scopeContainer);

            const sMagGeo = new THREE.BoxGeometry(0.024, 0.09, 0.045);
            const sMag = new THREE.Mesh(sMagGeo, receiverMat);
            sMag.position.set(0, -0.075, -0.04);
            weaponGroup.add(sMag);
        } 
        else if (type === "SHOTGUN") {
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
        // 點擊畫面觸發 Pointer Lock 鎖定滑鼠
        window.addEventListener('click', () => {
            if (isDeployed && document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        });

        window.addEventListener('keydown', (e) => {
            inputBuffer[e.code] = true;
            
            if (e.code === 'KeyC' && isDeployed) {
                isCrouching = !isCrouching;
                PHYSICS_CONFIG.eyeHeight = isCrouching ? 0.9 : 1.6;
            }

            if (e.code === 'Space' && isGrounded && isDeployed) {
                playerVelocity.y = PHYSICS_CONFIG.jumpStrength;
                isGrounded = false;
            }
            if (e.code === 'ShiftLeft' && isDeployed) {
                isSprinting = true;
            }
        });

        window.addEventListener('keyup', (e) => { 
            inputBuffer[e.code] = false; 
            if (e.code === 'ShiftLeft') isSprinting = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement !== document.body) return;
            
            if (e.button === 0) {
                const fromPos = { 
                    x: yawObject.position.x, 
                    y: yawObject.position.y - 0.2, 
                    z: yawObject.position.z 
                };
                
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);

                const toPos = {
                    x: yawObject.position.x + direction.x * 75,
                    y: yawObject.position.y + direction.y * 75,
                    z: yawObject.position.z + direction.z * 75
                };

                socket.emit('playerFire', {
                    x: yawObject.position.x,
                    z: yawObject.position.z,
                    bulletPath: { from: fromPos, to: toPos }
                });

                isShooting = true; 

            } else if (e.button === 2) {
                isAiming = true;   
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                isShooting = false; 
            } else if (e.button === 2) {
                isAiming = false;   
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                const dynamicSensitivity = isAiming ? 0.0009 : 0.0022;
                
                yawObject.rotation.y -= e.movementX * dynamicSensitivity;
                pitchObject.rotation.x -= e.movementY * dynamicSensitivity;
                
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
        const pRadius = PHYSICS_CONFIG.playerRadius;
        const pHeight = PHYSICS_CONFIG.playerHeight;
        const footY = yawObject.position.y - PHYSICS_CONFIG.eyeHeight;

        const playerBox = new THREE.Box3(
            new THREE.Vector3(yawObject.position.x - pRadius, footY, yawObject.position.z - pRadius),
            new THREE.Vector3(yawObject.position.x + pRadius, footY + pHeight, yawObject.position.z + pRadius)
        );

        let hitAnyObstacleFloor = false;

        for (let i = 0; i < obstacles.length; i++) {
            const obsBox = new THREE.Box3().setFromObject(obstacles[i]);
            
            if (playerBox.intersectsBox(obsBox)) {
                const previousFootY = oldPos.y - PHYSICS_CONFIG.eyeHeight;
                if (previousFootY >= obsBox.max.y - 0.25 && playerVelocity.y <= 0) {
                    yawObject.position.y = obsBox.max.y + PHYSICS_CONFIG.eyeHeight;
                    playerVelocity.y = 0;
                    hitAnyObstacleFloor = true;
                    isGrounded = true;
                    continue;
                }

                const overlapX = Math.min(playerBox.max.x - obsBox.min.x, obsBox.max.x - playerBox.min.x);
                const overlapZ = Math.min(playerBox.max.z - obsBox.min.z, obsBox.max.z - playerBox.min.z);

                if (overlapX < overlapZ) {
                    yawObject.position.x = (yawObject.position.x > (obsBox.min.x + obsBox.max.x) / 2) ? obsBox.max.x + pRadius : obsBox.min.x - pRadius;
                } else {
                    yawObject.position.z = (yawObject.position.z > (obsBox.min.z + obsBox.max.z) / 2) ? obsBox.max.z + pRadius : obsBox.min.z - pRadius;
                }
                
                const updatedFootY = yawObject.position.y - PHYSICS_CONFIG.eyeHeight;
                playerBox.set(
                    new THREE.Vector3(yawObject.position.x - pRadius, updatedFootY, yawObject.position.z - pRadius),
                    new THREE.Vector3(yawObject.position.x + pRadius, updatedFootY + pHeight, yawObject.position.z + pRadius)
                );
            }
        }

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

            pitchObject.rotation.x += spec.recoilY;
            yawObject.rotation.y += (Math.random() - 0.5) * spec.recoilX;

            if (myGunMesh) myGunMesh.position.z += 0.085;

            spawnMuzzleFlashDynamicLight();

            const activeSpread = isAiming ? spec.adsSpread : spec.spread;

            if (currentWeapon === "SHOTGUN") {
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
        
        const spreadX = (Math.random() - 0.5) * spreadValue;
        const spreadY = (Math.random() - 0.5) * spreadValue;
        
        raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

        const camWorldPos = new THREE.Vector3();
        camera.getWorldPosition(camWorldPos);

        const laserOrigin = camWorldPos.clone();
        laserOrigin.x += 0.08; laserOrigin.y -= 0.1;

        const laserEndpoint = new THREE.Vector3();
        const maxRangeVector = raycaster.ray.direction.clone().multiplyScalar(120);
        laserEndpoint.addVectors(camWorldPos, maxRangeVector);

        const enemyTargets = [];
        for (let id in remotePlayers) {
            if (remotePlayers[id].mesh) enemyTargets.push(remotePlayers[id].mesh);
        }

        const sceneHits = raycaster.intersectObjects(enemyTargets, true);

        if (sceneHits.length > 0) {
            laserEndpoint.copy(sceneHits[0].point);
            
            let rootNode = sceneHits[0].object;
            while (rootNode.parent && !rootNode.userData.playerId) {
                rootNode = rootNode.parent;
            }

            const enemyId = rootNode.userData.playerId;
            if (enemyId) {
                socket.emit('playerShot', enemyId);
                triggerUIHitmarkerFeedback();
            }
            
            if (sceneHits[0].face) {
                spawnImpactParticles(sceneHits[0].point, sceneHits[0].face.normal);
            }
        }
    }

    function spawnImpactParticles(pos, normal) {
        const particleCount = 6;
        const geometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const meshes = [];

        for (let i = 0; i < particleCount; i++) {
            const p = new THREE.Mesh(geometry, material);
            p.position.copy(pos);
            
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
            // A

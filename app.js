// =========================================================================
// 1. 3D 場景與電影級光影初始化
// =========================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040712); 
scene.fog = new THREE.FogExp2(0x040712, 0.035); 

let defaultFOV = 75; 
let aimFOV = 35; 
const camera = new THREE.PerspectiveCamera(defaultFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const gridHelper = new THREE.GridHelper(120, 60, 0x223e5a, 0x050c1e);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

const ambientLight = new THREE.AmbientLight(0x0a1128, 0.85);
scene.add(ambientLight);
const blueLight = new THREE.DirectionalLight(0x0088ff, 1.3);
blueLight.position.set(30, 40, 20);
scene.add(blueLight);
const redLight = new THREE.DirectionalLight(0xff3300, 1.1);
redLight.position.set(-30, 40, -20);
scene.add(redLight);

// =========================================================================
// 2. 武器庫物理與彈道參數配置
// =========================================================================
const WEAPON_CONFIGS = {
    // 【步槍】：中規中矩。5發致死（20*5=100）。彈道穩定，控槍好的人最愛。
    RIFLE: { maxAmmo: 30, aimFov: 35, color: 0x00ffcc, barrelLength: 0.5, barrelRadius: 0.02, fireRate: 130, damage: 20, recoil: 0.03, spread: 0.02, pellets: 1 },
    
    // 【散彈槍】：近戰壓制。單發彈丸 12 傷害 * 6 顆 = 總傷 72。
    // 雖然貼臉全中不能秒殺（留給對手反擊機會），但能瞬間把人打殘，配合滑鏟極強。
    // 將擴散度稍微收斂到 0.12，讓它在近距離更可靠，而不是你原本設定的 0.2（太散了打不中人）。
    SHOTGUN: { maxAmmo: 6, aimFov: 45, color: 0xff00ff, barrelLength: 0.35, barrelRadius: 0.035, fireRate: 750, damage: 12, recoil: 0.13, spread: 0.12, pellets: 6 },
    
    // 【狙擊槍】：一槍致命。傷害直接給到 100。
    // 代價是：把射速下調到 1.5 秒一發（fireRate: 1500），沒打中就會有極大的空檔被抓。
    // 這才符合硬核慢速回血局的「邊緣試探」感——高風險，但只要賽到一槍就是一個擊殺！
    SNIPER: { maxAmmo: 5, aimFov: 10, color: 0xffff00, barrelLength: 0.8, barrelRadius: 0.015, fireRate: 1500, damage: 100, recoil: 0.35, spread: 0.0, pellets: 1 }
};

let currentWeaponType = "RIFLE"; 
let velocityY = 0; 
const gravity = 0.008; 
const jumpStrength = 0.18;  
let isGrounded = true; 
let isAiming = false; 
let maxAmmo = 30; 
let currentAmmo = 30; 
let isReloading = false;
let myHp = 100; 
let myTeam = "PENDING"; 
let mouseSensitivity = 0.0022; 
let lastUpdateTime = 0; 
const tickInterval = 1000 / 30; 
let lastFireTime = 0;

// 進階身法與大招變數
let isSliding = false;
let slideStartTime = 0;
const slideDuration = 400; // 滑鏟 0.4 秒
let speedModifier = 1.0;   // 連殺大招增加 1.1 倍
let isRadarXrayActive = false;

// 物理地圖物件控制
let dropWeaponMesh = null;
const jumpPadPos = { x: 0, z: 0, radius: 1.8 };

// 動態手感控制變數
let recoilPitch = 0; 
let recoilYaw = 0; 
let screenShakeIntensity = 0;
let targetWeaponPos = new THREE.Vector3(); 
let currentWeaponPos = new THREE.Vector3(); 
let weaponRotationZ = 0;
const pendingInputs = [];    
let sequenceNumber = 0;

camera.position.set(0, 1.6, 5);

// 靜態生成一個發光的 3D 彈跳墊盤子
const padGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.1, 24);
const padMat = new THREE.MeshStandardMaterial({ color: 0x050c14, emissive: 0x00ffcc, emissiveIntensity: 1.2 });
const padMesh = new THREE.Mesh(padGeo, padMat);
padMesh.position.set(jumpPadPos.x, 0.05, jumpPadPos.z);
scene.add(padMesh);

// =========================================================================
// 3. UI 元素與 DOM 標籤對接
// =========================================================================
const hitInfoUI = document.getElementById('hit-info');
const hitmarkerUI = document.getElementById('hitmarker');
const hpBarUI = document.getElementById('hp-bar');
const hpNumUI = document.getElementById('hp-num');
const ammoTextUI = document.getElementById('ammo-text');
const reloadPromptUI = document.getElementById('reload-prompt');
const weaponOverlay = document.getElementById('weapon-overlay');
const victoryOverlay = document.getElementById('victory-overlay');
const killFeedUI = document.getElementById('kill-feed');

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const usernameInput = document.getElementById('username-input');

const uiRoomId = document.getElementById('ui-room-id');
const uiMyTeam = document.getElementById('ui-my-team');
const uiScoreAlpha = document.getElementById('score-alpha');
const uiScoreOmega = document.getElementById('score-omega');
const uiMatchTimer = document.getElementById('match-timer');

let hitmarkerTimeout = null; 
const socket = io(); 
let myId = null; 
const remotePlayers = {}; 
const obstacleMeshes = []; 
const obstacleBoxes = []; 

// =========================================================================
// 4. 第一人稱程序化槍枝模型建立
// =========================================================================
const gunGroup = new THREE.Group();
const hipfirePosition = new THREE.Vector3(0.22, -0.25, -0.5); 
const aimPosition = new THREE.Vector3(0.0, -0.16, -0.42);     
let barrel = null; 
let muzzleFlash = null;

function rebuildFirstPersonGun(type) {
    while(gunGroup.children.length > 0) { gunGroup.remove(gunGroup.children[0]); }
    const config = WEAPON_CONFIGS[type];
    maxAmmo = config.maxAmmo; 
    currentAmmo = config.maxAmmo; 
    aimFOV = config.aimFov;

    const barrelGeometry = new THREE.CylinderGeometry(config.barrelRadius, config.barrelRadius * 1.2, config.barrelLength, 16);
    const barrelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x11131a, emissive: config.color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.8 
    });
    barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2; 
    currentWeaponPos.copy(isAiming ? aimPosition : hipfirePosition);
    barrel.position.copy(currentWeaponPos); 
    gunGroup.add(barrel);

    const flashGeometry = new THREE.ConeGeometry(0.06, 0.15, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
    muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
    muzzleFlash.rotation.x = -Math.PI / 2;
    muzzleFlash.position.set(0, config.barrelLength / 2 + 0.08, 0); 
    muzzleFlash.visible = false;
    barrel.add(muzzleFlash);
    
    updateHudUI();
}
rebuildFirstPersonGun("RIFLE"); 
camera.add(gunGroup);
scene.add(camera);

function makeTeamTextSprite(message, team) {
    const canvas = document.createElement('canvas'); 
    const context = canvas.getContext('2d');
    canvas.width = 512; canvas.height = 128;
    context.font = "Bold 34px monospace"; 
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillStyle = "rgba(4, 8, 20, 0.85)"; 
    context.fillRect(32, 16, 448, 96); 
    
    const strokeColor = (team === "ALPHA") ? "#0088ff" : "#ff3300";
    context.strokeStyle = strokeColor; context.lineWidth = 5; 
    context.strokeRect(32, 16, 448, 96);
    context.fillStyle = strokeColor; context.fillText(message, 256, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
}

// =========================================================================
// 5. 網路事件與多房間數據管道同步
// =========================================================================
if (createRoomBtn) { createRoomBtn.addEventListener('click', () => { socket.emit('createRoom'); }); }
socket.on('roomCreated', (createdRoomId) => { if (roomIdInput) roomIdInput.value = createdRoomId; });

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
        const rId = roomIdInput ? roomIdInput.value.trim() : "";
        const uName = usernameInput ? usernameInput.value.trim() : "";
        if (!rId || !uName) return;
        socket.emit('joinRoom', { roomId: rId, name: uName });
    });
}

function completelyRemovePlayer(targetId) {
    if (remotePlayers[targetId]) { scene.remove(remotePlayers[targetId]); delete remotePlayers[targetId]; }
}

socket.on('init', (data) => {
    myId = data.id; myTeam = data.team;
    if (uiRoomId) uiRoomId.innerText = `ROOM ID: ${data.roomId}`;
    if (uiMyTeam) {
        uiMyTeam.innerText = `TEAM: ${myTeam}`;
        uiMyTeam.style.color = myTeam === "ALPHA" ? "#0088ff" : "#ff3300";
    }
    updateScoreUI(data.scores);
    updateTimerText(data.timeLeft);
    
    if (document.getElementById('login-overlay')) document.getElementById('login-overlay').style.display = 'none';
    if (weaponOverlay) weaponOverlay.style.display = 'flex';

    for (let id in data.playerList) { 
        if (id !== myId && data.playerList[id].isDeployed) createRemotePlayer(id, data.playerList[id]); 
    }

    obstacleMeshes.forEach(m => scene.remove(m)); 
    obstacleMeshes.length = 0; obstacleBoxes.length = 0;
    
    data.obstacles.forEach(obs => {
        const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d); 
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x070b14, emissive: obs.color, emissiveIntensity: 0.6, roughness: 0.1 }));
        mesh.position.set(obs.x, obs.y, obs.z); 
        scene.add(mesh); obstacleMeshes.push(mesh); 
        obstacleBoxes.push(new THREE.Box3().setFromObject(mesh));
    });
});

socket.on('playerMoved', (data) => {
    if (remotePlayers[data.id]) { 
        remotePlayers[data.id].position.set(data.info.x, data.info.y - 0.6, data.info.z); 
        remotePlayers[data.id].rotation.y = data.info.ry; 
    }
});

socket.on('serverAck', (data) => {
    while (pendingInputs.length > 0 && pendingInputs[0].seq <= data.seq) { pendingInputs.shift(); }
    if (Math.abs(camera.position.x - data.x) > 0.08 || Math.abs(camera.position.z - data.z) > 0.08) {
        camera.position.x = data.x; camera.position.z = data.z;
        pendingInputs.forEach(i => { camera.position.x += i.dx; camera.position.z += i.dz; });
    }
});

socket.on('scoreUpdate', (scores) => { updateScoreUI(scores); });
socket.on('timeUpdate', (timeLeft) => { updateTimerText(timeLeft); });

function updateScoreUI(scores) {
    if (uiScoreAlpha) uiScoreAlpha.innerText = scores.ALPHA;
    if (uiScoreOmega) uiScoreOmega.innerText = scores.OMEGA;
}
function updateTimerText(timeLeft) {
    let mins = Math.floor(timeLeft / 60); let secs = timeLeft % 60;
    if (uiMatchTimer) uiMatchTimer.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

socket.on('playerHurt', (data) => {
    if (data.id === myId) {
        if (data.hp < myHp) screenShakeIntensity = 0.16; // 受傷震動，回血不震動
        myHp = data.hp; updateHudUI(); return;
    }
    if (hitInfoUI) {
        hitInfoUI.innerHTML = `💥 HIT！殘餘生命: ${data.hp}%`;
        if (hitmarkerUI) hitmarkerUI.style.display = 'block';
        if (hitmarkerTimeout) clearTimeout(hitmarkerTimeout);
        hitmarkerTimeout = setTimeout(() => { if (hitmarkerUI) hitmarkerUI.style.display = 'none'; }, 150);
    }
});

socket.on('killFeed', (data) => {
    if (!killFeedUI) return;
    const feedItem = document.createElement('div');
    feedItem.style.color = "#ff3300";
    feedItem.innerText = `💀 ${data.attackerName} 擊殺了 ${data.targetName}`;
    killFeedUI.appendChild(feedItem);
    setTimeout(() => feedItem.remove(), 4000);
});

// 削弱版大招與連殺通知
socket.on('streakBuff', (data) => { speedModifier = data.speedMultiplier; });
socket.on('radarScan', (data) => { if (data.team === myTeam) isRadarXrayActive = true; });
socket.on('radarScanEnd', () => { isRadarXrayActive = false; });

socket.on('spawnWeaponDrop', (data) => {
    if (dropWeaponMesh) scene.remove(dropWeaponMesh);
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.8 });
    dropWeaponMesh = new THREE.Mesh(boxGeo, boxMat);
    dropWeaponMesh.position.set(data.x, 0.4, data.z);
    scene.add(dropWeaponMesh);
});
socket.on('weaponPickedUp', () => { if (dropWeaponMesh) { scene.remove(dropWeaponMesh); dropWeaponMesh = null; } });

socket.on('playerDead', (data) => {
    if (data.id === myId) {
        document.exitPointerLock(); isLocked = false;
        speedModifier = 1.0; isRadarXrayActive = false;
        if (weaponOverlay) weaponOverlay.style.display = 'flex';
    } else { completelyRemovePlayer(data.id); }
});

socket.on('playerRespawn', (data) => {
    if (data.id === myId) {
        myHp = 100; isReloading = false; 
        if (reloadPromptUI) reloadPromptUI.style.display = 'none';
        camera.position.set(data.info.x, data.info.y, data.info.z); 
        velocityY = 0; pendingInputs.length = 0; updateHudUI();
    } else { 
        completelyRemovePlayer(data.id); createRemotePlayer(data.id, data.info); 
    }
});
socket.on('playerLeft', (id) => completelyRemovePlayer(id));

socket.on('matchOver', (data) => {
    document.exitPointerLock(); isLocked = false;
    if (victoryOverlay) {
        victoryOverlay.style.display = 'flex';
        const det = document.getElementById('victory-details');
        document.getElementById('victory-title').innerText = data.winner === "DRAW" ? "🤝 平手 🤝" : `🎉 ${data.winner} 隊獲勝 🎉`;
        if (det) det.innerHTML = `ALPHA: ${data.scores.ALPHA} | OMEGA: ${data.scores.OMEGA}`;
    }
});
socket.on('matchReset', () => {
    if (victoryOverlay) victoryOverlay.style.display = 'none';
    for(let id in remotePlayers) completelyRemovePlayer(id);
    if (weaponOverlay) weaponOverlay.style.display = 'flex';
});

function createRemotePlayer(id, info) {
    const playerGroup = new THREE.Group(); playerGroup.name = id;
    const nameSprite = makeTeamTextSprite(`${info.name} [${info.weapon}]`, info.team);
    nameSprite.position.set(0, 1.5, 0); playerGroup.add(nameSprite);

    const teamColor = info.team === "ALPHA" ? 0x0088ff : 0xff3300;
    const armorMaterial = new THREE.MeshStandardMaterial({ color: 0x060b11, emissive: teamColor, emissiveIntensity: 0.8, roughness: 0.1 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), armorMaterial); torso.position.y = 0.4; torso.userData = { playerId: id }; playerGroup.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), armorMaterial); head.position.y = 0.95; head.userData = { playerId: id }; playerGroup.add(head);

    playerGroup.position.set(info.x, info.y - 0.6, info.z); playerGroup.rotation.y = info.ry;
    scene.add(playerGroup); remotePlayers[id] = playerGroup;
}

// =========================================================================
// 6. 滑視角、滑跑身法與滑牆物理引擎
// =========================================================================
let isLocked = false;
document.body.addEventListener('click', (event) => {
    if (document.getElementById('login-overlay').style.display !== 'none' || (weaponOverlay && weaponOverlay.style.display === 'flex')) return;
    if (!isLocked && event.button === 0) document.body.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => { isLocked = (document.pointerLockElement === document.body); });

document.addEventListener('mousemove', (event) => {
    if (!isLocked) return;
    const sensitivity = isAiming ? mouseSensitivity * 0.45 : mouseSensitivity;
    camera.rotation.y -= event.movementX * sensitivity; 
    camera.rotation.x -= event.movementY * sensitivity;
    camera.rotation.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, camera.rotation.x));
});
camera.rotation.order = "YXZ";

const keysPressed = { w: false, a: false, s: false, d: false, c: false }; 
const moveSpeed = 0.14;
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase(); if (key in keysPressed) keysPressed[key] = true; 
    if (!isLocked) return;
    if (key === 'r' && currentAmmo < maxAmmo && !isReloading) handleReload();
    if (event.code === 'Space' && isGrounded) { velocityY = jumpStrength; isGrounded = false; }
});
document.addEventListener('keyup', (event) => { const key = event.key.toLowerCase(); if (key in keysPressed) keysPressed[key] = false; });

function handleReload() {
    isReloading = true; if (reloadPromptUI) reloadPromptUI.style.display = 'block';
    const startTime = Date.now();
    function reloadAnimate() {
        const elapsed = Date.now() - startTime;
        if (elapsed < 1200) { weaponRotationZ = (elapsed / 1200) * Math.PI * 2; requestAnimationFrame(reloadAnimate); } 
        else { 
            weaponRotationZ = 0; currentAmmo = maxAmmo; isReloading = false; 
            if (reloadPromptUI) reloadPromptUI.style.display = 'none'; updateHudUI(); 
        }
    }
    reloadAnimate();
}

function updateHudUI() {
    if (hpBarUI) hpBarUI.style.width = `${myHp}%`; 
    if (hpNumUI) hpNumUI.innerText = `${myHp}%`;
    if (ammoTextUI) ammoTextUI.innerHTML = `${currentAmmo}/${maxAmmo}`;
}

function handleMovement() {
    if (!isLocked) return;
    const oldPos = camera.position.clone();
    const direction = new THREE.Vector3(); camera.getWorldDirection(direction); direction.y = 0; direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    
    // =========================================================================
    // 【核心機制：C 鍵滑鏟物理速度與相機高度衰減】
    // =========================================================================
    let currentSpeed = isAiming ? moveSpeed * 0.45 : moveSpeed;
    currentSpeed *= speedModifier; // 連殺大招倍率

    if (keysPressed['c'] && isGrounded && !isSliding) {
        isSliding = true; slideStartTime = Date.now();
    }

    let pEyeH = 1.6;
    if (isSliding) {
        const elapsed = Date.now() - slideStartTime;
        if (elapsed < slideDuration) {
            currentSpeed *= 1.7; // 滑鏟時爆發衝刺
            pEyeH = 0.9;         // 降低角色判定高度
        } else { isSliding = false; }
    }

    let moveVec = new THREE.Vector3(0, 0, 0);
    if (keysPressed.w) moveVec.addScaledVector(direction, currentSpeed); 
    if (keysPressed.s) moveVec.addScaledVector(direction, -currentSpeed);
    if (keysPressed.d) moveVec.addScaledVector(right, currentSpeed); 
    if (keysPressed.a) moveVec.addScaledVector(right, -currentSpeed);

    const pRadius = 0.35; const pHeight = pEyeH + 0.2;

    // AABB 雙軸滑牆碰撞檢查
    if (moveVec.x !== 0) {
        camera.position.x += moveVec.x;
        let pBoxX = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, camera.position.y - (pEyeH * 0.5), camera.position.z), new THREE.Vector3(pRadius * 2, pHeight, pRadius * 2));
        for (let obs of obstacleBoxes) { if (pBoxX.intersectsBox(obs)) { camera.position.x = moveVec.x > 0 ? obs.min.x - pRadius - 0.002 : obs.max.x + pRadius + 0.002; break; } }
    }
    if (moveVec.z !== 0) {
        camera.position.z += moveVec.z;
        let pBoxZ = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, camera.position.y - (pEyeH * 0.5), camera.position.z), new THREE.Vector3(pRadius * 2, pHeight, pRadius * 2));
        for (let obs of obstacleBoxes) { if (pBoxZ.intersectsBox(obs)) { camera.position.z = moveVec.z > 0 ? obs.min.z - pRadius - 0.002 : obs.max.z + pRadius + 0.002; break; } }
    }
    if (camera.position.x !== oldPos.x || camera.position.z !== oldPos.z) {
        sequenceNumber++; pendingInputs.push({ seq: sequenceNumber, dx: camera.position.x - oldPos.x, dz: camera.position.z - oldPos.z });
    }

    // =========================================================================
    // 【核心機制：地圖中央彈跳墊物理斥力觸發】
    // =========================================================================
    let distToPad = Math.sqrt(Math.pow(camera.position.x - jumpPadPos.x, 2) + Math.pow(camera.position.z - jumpPadPos.z, 2));
    if (distToPad < jumpPadPos.radius && isGrounded) {
        velocityY = jumpStrength * 2.4; // 彈射高空
        isGrounded = false;
    }

    // 隨機空投拾取判定
    if (dropWeaponMesh) {
        let distToDrop = camera.position.distanceTo(dropWeaponMesh.position);
        if (distToDrop < 1.5) {
            socket.emit('pickupWeapon');
            currentWeaponType = "SNIPER"; // 強制撿起黃金狙擊槍
            rebuildFirstPersonGun(currentWeaponType);
        }
    }

    velocityY -= gravity; camera.position.y += velocityY;
    let pBoxY = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, camera.position.y - (pEyeH * 0.5), camera.position.z), new THREE.Vector3(pRadius * 2, pHeight, pRadius * 2));
    let hitCeilingOrFloor = false;
    for (let obsBox of obstacleBoxes) {
        if (pBoxY.intersectsBox(obsBox)) {
            if (velocityY <= 0 && oldPos.y >= obsBox.max.y + (pEyeH - 0.2)) { camera.position.y = obsBox.max.y + pEyeH; if (!isGrounded) screenShakeIntensity = 0.05; velocityY = 0; isGrounded = true; hitCeilingOrFloor = true; } 
            else if (velocityY > 0) { camera.position.y = obsBox.min.y - 0.01; velocityY = 0; hitCeilingOrFloor = true; }
            break;
        }
    }
    if (!hitCeilingOrFloor) { 
        if (camera.position.y <= pEyeH) { camera.position.y = pEyeH; if (!isGrounded) screenShakeIntensity = 0.03; velocityY = 0; isGrounded = true; } 
        else { isGrounded = false; } 
    }
}

// =========================================================================
// 7. 多重射線槍擊判定與開鏡彈道
// =========================================================================
const raycaster = new THREE.Raycaster();
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousedown', (event) => {
    if (!isLocked) return;
    if (event.button === 2) { isAiming = true; camera.fov = aimFOV; camera.updateProjectionMatrix(); }
    if (event.button === 0) {
        if (currentAmmo <= 0 || isReloading) return;
        const now = Date.now(); const config = WEAPON_CONFIGS[currentWeaponType];
        if (now - lastFireTime < config.fireRate) return; lastFireTime = now;

        currentAmmo--; updateHudUI();
        socket.emit('playerFire');
        
        if (muzzleFlash) muzzleFlash.visible = true; currentWeaponPos.z += 0.08; 
        screenShakeIntensity = config.recoil * 0.6; recoilPitch += config.recoil; recoilYaw += (Math.random() - 0.5) * config.recoil * 0.5;
        setTimeout(() => { if (muzzleFlash) muzzleFlash.visible = false; }, 50);

        const targetMeshes = [];
        for (let id in remotePlayers) targetMeshes.push(remotePlayers[id]);
        obstacleMeshes.forEach(m => targetMeshes.push(m));

        for (let p = 0; p < config.pellets; p++) {
            const currentSpread = isAiming ? config.spread * 0.2 : config.spread;
            raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * currentSpread, (Math.random() - 0.5) * currentSpread), camera);
            const intersects = raycaster.intersectObjects(targetMeshes, true);
            if (intersects.length > 0) {
                let hitObject = intersects[0].object; if (obstacleMeshes.includes(hitObject)) continue;
                let targetId = null;
                while (hitObject.parent && hitObject.parent !== scene) {
                    for (let id in remotePlayers) { if (remotePlayers[id] === hitObject.parent || remotePlayers[id] === hitObject) { targetId = id; break; } }
                    if (targetId) break; hitObject = hitObject.parent;
                }
                if (targetId) { socket.emit('playerShot', targetId); if (config.pellets === 1) break; }
            }
        }
    }
});
window.addEventListener('mouseup', (event) => { if (event.button === 2) { isAiming = false; camera.fov = defaultFOV; camera.updateProjectionMatrix(); } });

// =========================================================================
// 8. 介面選槍對接與中央動態動畫循環
// =========================================================================
document.querySelectorAll('.weapon-btn').forEach(button => {
    button.addEventListener('click', () => {
        const selectedWeapon = button.getAttribute('data-gun');
        if (selectedWeapon && WEAPON_CONFIGS[selectedWeapon]) {
            currentWeaponType = selectedWeapon;
            rebuildFirstPersonGun(currentWeaponType);
            if (weaponOverlay) weaponOverlay.style.display = 'none';
            socket.emit('selectWeaponAndDeploy', { weapon: currentWeaponType });
            setTimeout(() => { if (!isLocked) document.body.requestPointerLock(); }, 300);
        }
    });
});

function animate() {
    requestAnimationFrame(animate);
    handleMovement(); 
    
    // 渲染空投自轉特效
    if (dropWeaponMesh) dropWeaponMesh.rotation.y += 0.03;

    targetWeaponPos.copy(isAiming ? aimPosition : hipfirePosition); 
    currentWeaponPos.lerp(targetWeaponPos, 0.15);
    if (barrel) { barrel.position.copy(currentWeaponPos); barrel.rotation.z = weaponRotationZ; }
    
    if (isLocked) { camera.rotation.x += recoilPitch; camera.rotation.y += recoilYaw; recoilPitch *= 0.85; recoilYaw *= 0.85; }
    if (screenShakeIntensity > 0.001) { 
        camera.position.x += (Math.random() - 0.5) * screenShakeIntensity; 
        camera.position.y += (Math.random() - 0.5) * screenShakeIntensity; 
        camera.position.z += (Math.random() - 0.5) * screenShakeIntensity; 
        screenShakeIntensity *= 0.88; 
    }
    
    // =========================================================================
    // 【核心機制：削弱版連殺大招——雷達紅外透視渲染】
    // =========================================================================
    for (let id in remotePlayers) {
        if (isRadarXrayActive) {
            // 透視大招啟動：強制讓敵方玩家模型穿透牆壁（關閉深度測試）
            remotePlayers[id].traverse((child) => {
                if (child.isMesh) { child.material.depthTest = false; child.material.emissiveIntensity = 2.0; }
            });
        } else {
            // 恢復正常遮擋
            remotePlayers[id].traverse((child) => {
                if (child.isMesh) { child.material.depthTest = true; child.material.emissiveIntensity = 0.8; }
            });
        }
    }

    if (myId && isLocked && !(weaponOverlay && weaponOverlay.style.display === 'flex')) {
        const now = Date.now();
        if (now - lastUpdateTime >= tickInterval) {
            socket.emit('playerUpdate', { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y, seq: sequenceNumber });
            lastUpdateTime = now;
        }
    }
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();

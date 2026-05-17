// ==========================================
// 1. 基礎環境設定（場景、攝影機、渲染器）
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefefef);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 建立地板網格
const gridHelper = new THREE.GridHelper(100, 100, 0x0000ff, 0x888888);
scene.add(gridHelper);

// 加上基本燈光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// 設定玩家初始位置（身高 1.6）
camera.position.set(0, 1.6, 5);

// ==========================================
// 2. 滑鼠視角控制 (Pointer Lock API)
// ==========================================
let isLocked = false;

// 點擊網頁畫面時，請求鎖定滑鼠
document.body.addEventListener('click', () => {
    if (!isLocked) {
        document.body.requestPointerLock();
    }
});

// 監聽鎖定狀態改變
document.addEventListener('pointerlockchange', () => {
    isLocked = (document.pointerLockElement === document.body);
});

// 監聽滑鼠移動，改變攝影機視角
document.addEventListener('mousemove', (event) => {
    if (!isLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // 左右旋轉（繞著 Y 軸）
    camera.rotation.y -= movementX * 0.002;
    
    // 上下偏轉（繞著 X 軸），並限制抬頭與低頭的角度（避免翻轉）
    camera.rotation.x -= movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, camera.rotation.x));
});

// 重要：為了讓旋轉順序正常（先左右再上下），設定歐拉角順序為 YXZ
camera.rotation.order = "YXZ";

// ==========================================
// 3. 鍵盤移動控制 (WASD)
// ==========================================
const keysPressed = { w: false, a: false, s: false, d: false };
const moveSpeed = 0.1;

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

// 計算移動方向的函式
function handleMovement() {
    if (!isLocked) return;

    // 建立一個前進方向的向量（基於目前相機面對的方向）
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // 鎖定在地面，不讓玩家因為看天上就往飛上去
    direction.normalize();

    // 建立一個向右的方向向量（透過前進方向與世界 Y 軸的外積算出來）
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    // 根據按鍵計算位移
    if (keysPressed.w) camera.position.addScaledVector(direction, moveSpeed);
    if (keysPressed.s) camera.position.addScaledVector(direction, -moveSpeed);
    if (keysPressed.d) camera.position.addScaledVector(right, moveSpeed);
    if (keysPressed.a) camera.position.addScaledVector(right, -moveSpeed);
}

// ==========================================
// 4. 遊戲主迴圈
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    // 處理每幀的玩家位移
    handleMovement();

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

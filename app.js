// 1. 初始化三大基礎元件：場景、攝影機、渲染器
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefefef); // 天空顏色

// 視野角度 (FOV) 75度，並設定畫布比例
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. 建立地板 (Grid 網格方便辨識空間)
const gridHelper = new THREE.GridHelper(100, 100, 0x0000ff, 0x888888);
scene.add(gridHelper);

// 3. 加入環境光，讓 3D 物件看得見
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// 4. 設定玩家（攝影機）的初始位置（身高約 1.6 單位）
camera.position.set(0, 1.6, 5);

// 5. 遊戲主迴圈 (Game Loop) ── 每秒執行約 60 次
function animate() {
    requestAnimationFrame(animate);
    
    // 這裡未來會放入玩家移動與滑鼠旋轉的邏輯
    
    renderer.render(scene, camera);
}

// 視窗大小改變時自動調整畫面
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 啟動遊戲
animate();

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";

// HTML
const video = document.getElementById("video");
const canvas = document.getElementById("output_canvas");

// ---------------- CAMERA ----------------
async function initCamera() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === "videoinput");

  let backCamera = videoDevices[videoDevices.length - 1]; // last = rear

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: backCamera ? { exact: backCamera.deviceId } : undefined
    }
  });

  video.srcObject = stream;
  await video.play();

  console.log("Camera started ✅");
}

await initCamera();

// ---------------- THREE ----------------
const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera3D.position.z = 2;

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1);
scene.add(light);

// Box
const geometry = new THREE.BoxGeometry(0.2, 0.1, 0.4);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const heel = new THREE.Mesh(geometry, material);
scene.add(heel);

// ---------------- MEDIAPIPE ----------------
const pose = new window.Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 2,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults((results) => {
  if (!results.poseLandmarks) {
    console.log("❌ No landmarks");
    return;
  }

  console.log("✅ Tracking");

  const lm = results.poseLandmarks;

  const heelPoint = lm[29] || lm[30];
  const toePoint = lm[31] || lm[32];

  if (!heelPoint || !toePoint) return;

  const x = ((heelPoint.x + toePoint.x) / 2 - 0.5) * 2;
  const y = -((heelPoint.y + toePoint.y) / 2 - 0.5) * 2;

  heel.position.set(x, y, 0);

  // rotation
  const angle = Math.atan2(
    toePoint.y - heelPoint.y,
    toePoint.x - heelPoint.x
  );
  heel.rotation.z = -angle;

  // scale
  const dist = Math.hypot(
    toePoint.x - heelPoint.x,
    toePoint.y - heelPoint.y
  );
  const s = dist * 5;
  heel.scale.set(s, s, s);
});

// ---------------- MANUAL LOOP (IMPORTANT FIX) ----------------
async function processFrame() {
  if (video.readyState === 4) {
    await pose.send({ image: video });
  }
  requestAnimationFrame(processFrame);
}

processFrame();

// ---------------- RENDER LOOP ----------------
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";

// HTML
const video = document.getElementById("video");
const canvas = document.getElementById("output_canvas");

// ---------------- CAMERA (FORCE BACK CAMERA) ----------------
async function initCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");

    console.log("All cameras:", videoDevices);

    let backCamera = videoDevices.find(device =>
      device.label.toLowerCase().includes("back") ||
      device.label.toLowerCase().includes("rear")
    );

    if (!backCamera && videoDevices.length > 0) {
      backCamera = videoDevices[videoDevices.length - 1];
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: backCamera ? { exact: backCamera.deviceId } : undefined
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    console.log("Using camera:", backCamera?.label);
  } catch (err) {
    console.error("Camera error ❌", err);
  }
}

initCamera();

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

// ---------------- DEBUG BOX ----------------
const geometry = new THREE.BoxGeometry(0.2, 0.1, 0.4);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const heel = new THREE.Mesh(geometry, material);

// ALWAYS visible at start
heel.position.set(0, 0, 0);
scene.add(heel);

// ---------------- MEDIAPIPE ----------------
const pose = new window.Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 2, // 🔥 higher accuracy
  smoothLandmarks: true,
});

pose.onResults((results) => {
  console.log("MediaPipe running 🔥");

  if (!results.poseLandmarks) {
    console.log("❌ No landmarks");
    return;
  }

  console.log("✅ Landmarks detected");

  const lm = results.poseLandmarks;

  // Left foot
  const leftHeel = lm[29];
  const leftFootIndex = lm[31];

  // Right foot
  const rightHeel = lm[30];
  const rightFootIndex = lm[32];

  // Choose whichever is visible
  let heelPoint = null;
  let toePoint = null;

  if (leftHeel && leftFootIndex) {
    heelPoint = leftHeel;
    toePoint = leftFootIndex;
  } else if (rightHeel && rightFootIndex) {
    heelPoint = rightHeel;
    toePoint = rightFootIndex;
  }

  if (!heelPoint || !toePoint) {
    console.log("❌ Foot not detected");
    return;
  }

  // Position
  const x = ((heelPoint.x + toePoint.x) / 2 - 0.5) * 2;
  const y = -((heelPoint.y + toePoint.y) / 2 - 0.5) * 2;

  heel.position.set(x, y, 0);

  // Rotation
  const angle = Math.atan2(
    toePoint.y - heelPoint.y,
    toePoint.x - heelPoint.x
  );
  heel.rotation.z = -angle;

  // Scale
  const distance = Math.sqrt(
    Math.pow(toePoint.x - heelPoint.x, 2) +
    Math.pow(toePoint.y - heelPoint.y, 2)
  );

  const scale = distance * 5;
  heel.scale.set(scale, scale, scale);
});

// ---------------- CAMERA LOOP ----------------
const cameraUtils = new window.Camera(video, {
  onFrame: async () => {
    if (video.readyState === 4) {
      await pose.send({ image: video });
    }
  },
  width: 640,
  height: 480,
});

cameraUtils.start();

// ---------------- RENDER LOOP ----------------
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();

// ---------------- RESIZE ----------------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
});
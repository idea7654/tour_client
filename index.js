import * as THREE from "https://unpkg.com/three/build/three.module.js";
import { ColladaLoader } from "https://threejs.org/examples/jsm/loaders/ColladaLoader.js";

let renderer = null;
let scene = null;
let camera = null;

let character = null;
let box = null;
let controller = null;
let BoxModel = null;
let watch = null;
let gps = null;
let spotPos = null;

const spot = [
  { name: "paichai clock", gps: { lat: 36.318056, lon: 127.367499 } },
];

let targetSpot = null;
let heading = null;

function getGPS() {
  function success(position) {
    // gps = {
    //   lat: position.coords.latitude,
    //   lon: position.coords.longitude,
    // };
    gps = {
      lat: 36.318318,
      lon: 127.367699,
    };

    getSpotPos();
  }

  function error() {
    //alert("error");
    console.log("error");
  }
  const options = {
    enableHighAccuracy: true,
    maximumAge: 300000,
    timeout: 27000,
  };
  watch = navigator.geolocation.watchPosition(success, error, options);
}

function getSpotPos() {
  for (let i = 0; i < spot.length; i++) {
    if (
      spot[i].gps.lat - 0.01 < gps.lat &&
      spot[i].gps.lat + 0.01 > gps.lat &&
      spot[i].gps.lon - 0.01 < gps.lon &&
      spot[i].gps.lon + 0.01 > gps.lon
    ) {
      targetSpot = spot[i];
    }
  }

  spotPos = {
    lat: targetSpot.gps.lat - gps.lat,
    lon: targetSpot.gps.lon - gps.lon,
  };
}

function setCharacterPos() {}

const initScene = (gl, session) => {
  //-- scene, camera(threeJs의 카메라, 씬 설정)
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  //---

  //--- light(빛 설정, 빛 설정을 하지 않으면 오브젝트가 검정색으로밖에 보이지 않는다)
  const light = new THREE.PointLight(0xffffff, 2, 100); // soft white light
  scene.add(light);
  //---
  // create and configure three.js renderer with XR support
  //XR을 사용하기 위해 threeJs의 renderer를 만들고 설정
  renderer = new THREE.WebGLRenderer({
    antialias: true, //위신호 제거
    alpha: true, //캔버스에 알파(투명도)버퍼가 있는지 여부
    autoClear: true, //프레임을 렌더링하기 전에 출력을 자동적으로 지우는지 여부
    context: gl, //기존 RenderingContext에 렌더러를 연결(gl)
  });
  renderer.setPixelRatio(window.devicePixelRatio); //장치 픽셀 비율 설정
  renderer.setSize(window.innerWidth, window.innerHeight); //사이즈 설정
  renderer.xr.enabled = true; //renderer로 xr을 사용할지 여부
  renderer.xr.setReferenceSpaceType("local"); //
  renderer.xr.setSession(session);
  document.body.appendChild(renderer.domElement);
  //---
  controller = renderer.xr.getController(0);
  //controller.addEventListener('select', onSelect);
  scene.add(controller);

  const loader = new ColladaLoader();
  loader.load("BoxModel.dae", (collada) => {
    BoxModel = new THREE.Object3D();
    const box = new THREE.Box3().setFromObject(collada.scene);

    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    collada.scene.position.set(-c.x, size.y / 2 - c.y, -c.z);

    BoxModel.add(collada.scene);

    // const distance = Math.sqrt(
    //   spotPos.lat * spotPos.lat + spotPos.lon * spotPos.lon
    // );
    const distance = 5;
    BoxModel.scale.set(3, 3, 3);
    BoxModel.position
      .set(0, -0.75 * distance, -distance)
      .applyMatrix4(controller.matrixWorld);
    BoxModel.quaternion.setFromRotationMatrix(controller.matrixWorld);

    const otherObject = new THREE.Object3D();
    // otherObject.add(model);
    otherObject.add(BoxModel);

    if (heading && gps) {
      const y = Math.sin(spotPos.lon) * Math.cos(spotPos.lat);
      const x =
        Math.cos(gps.lat) * Math.sin(gps.lat + spotPos.lat) -
        Math.sin(gps.lat) *
          Math.cos(gps.lat + spotPos.lat) *
          Math.cos(spotPos.lon);
      const angle = (Math.atan2(y, x) * 180) / Math.PI;
      const result = getRealAngle(heading, angle);

      otherObject.rotateY(result);
      scene.add(otherObject);
      //BoxModel.
    }
  });

  loader.load("model.dae", (collada) => {});
};

// AR세션을 시작하는 버튼
const xrButton = document.getElementById("xr-button");
// xrSession
let xrSession = null;
// xrReferenceSpace
let xrRefSpace = null;

//렌더링을 위한 캔버스 OpenGL 컨텍스트
let gl = null;

function checkXR() {
  if (!window.isSecureContext) {
    //WebXR은 https환경에서만 사용가능.
    document.getElementById("warning").innerText =
      "WebXR unavailable. Please use secure context";
  }
  if (navigator.xr) {
    //navigator.xr을 지원하는지 여부
    navigator.xr.addEventListener("devicechange", checkSupportedState);
    checkSupportedState();
  } else {
    document.getElementById("warning").innerText =
      "WebXR unavailable for this browser";
  }
}

function checkSupportedState() {
  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    //ArCore를 지원하는 디바이스의 크롬 브라우저인지 여부
    if (supported) {
      xrButton.innerHTML = "Enter AR";
      xrButton.addEventListener("click", onButtonClicked);
    } else {
      xrButton.innerHTML = "AR not found";
    }
    xrButton.disabled = !supported;
  });
}

function onButtonClicked() {
  if (!xrSession) {
    navigator.xr
      .requestSession("immersive-ar", {
        //세션요청
        //optionalFeatures: ['dom-overlay'], //옵션(ex: dom-overlay, hit-test 등)
        //requiredFeatures: ['unbounded', 'hit-test'], //필수옵션
        //domOverlay: {
        //    root: document.getElementById('overlay')
        //} //dom-overlay사용시 어떤 요소에 적용할 것인지 명시
      })
      .then(onSessionStarted, onRequestSessionError);
  } else {
    xrSession.end();
  }
}

function onSessionStarted(session) {
  //세션요청을 성공하면 session값이 반환됨
  xrSession = session;
  xrButton.innerHTML = "Exit AR";

  if (session.domOverlayState) {
    info.innerHTML = "DOM Overlay type: " + session.domOverlayState.type; //session의 dom overlay타입 명시. Ar환경에서는
  }

  // create a canvas element and WebGL context for rendering
  //렌더링을 위한 캔버스 요소와 WebGL 컨텍스트를 만듬
  session.addEventListener("end", onSessionEnded);
  let canvas = document.createElement("canvas"); //HTML5 Canvas
  gl = canvas.getContext("webgl", {
    xrCompatible: true,
  });
  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  }); //세션의 레이어 설정

  // here we ask for viewer reference space, since we will be casting a ray
  // from a viewer towards a detected surface. The results of ray and surface intersection
  session.requestReferenceSpace("viewer").then((refSpace) => {
    xrRefSpace = refSpace;
    //xrRefSpace -> viewer ReferenceSpace
    session.requestAnimationFrame(onXRFrame);
    //onXRFrame을 호출
  });

  // three.js의 씬을 초기화
  initScene(gl, session);
}

function onRequestSessionError(ex) {
  info.innerHTML = "Failed to start AR session.";
  console.error(ex.message);
}

function onSessionEnded(event) {
  //세션을 끝냈을때
  xrSession = null;
  xrButton.innerHTML = "Enter AR";
  info.innerHTML = "";
  gl = null;
}

function updateAnimation() {
  //threeJs의 오브젝트들의 애니메이션을 넣는 곳
}

function onXRFrame(t, frame) {
  let session = frame.session; //매 프레임의 session
  let xrViewerPose = frame.getViewerPose(xrRefSpace); //xrViewerPose
  session.requestAnimationFrame(onXRFrame); //onXRFrame을 반복 호출

  updateAnimation();
  //WebXr로 생성된 gl 컨텍스트를 threeJs 렌더러에 바인딩
  gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
  //threeJs의 씬을 렌더링
  renderer.render(scene, camera);
}

checkXR(); //브라우저가 로딩되면 checkXR을 실행
getGPS();

const handleOrientation = (event) => {
  //   const a = document.getElementById("compass");
  //   a.innerHTML = "작동은합니다";
  if (event.webkitCompassHeading) {
    heading = event.webkitCompassHeading;
  } else {
    heading = 360 - event.alpha;
  }

  //   if (heading && gps) {
  //     const y = Math.sin(spotPos.lon) * Math.cos(spotPos.lat);
  //     const x =
  //       Math.cos(gps.lat) * Math.sin(gps.lat + spotPos.lat) -
  //       Math.sin(gps.lat) *
  //         Math.cos(gps.lat + spotPos.lat) *
  //         Math.cos(spotPos.lon);
  //     const angle = (Math.atan2(y, x) * 180) / Math.PI;
  //     const result = getRealAngle(heading, angle);
  //     a.innerHTML = `CompassDegree: ${Math.ceil(
  //       heading
  //     )}, 계산한 각도: ${result}, angle: ${angle}`;
  //   }
};
window.addEventListener("deviceorientationabsolute", handleOrientation, false);

function getRealAngle(heading, angle) {
  //compassDegree, 역탄젠트값(절대각도)
  let realAngle = 0;
  if (angle < 0) {
    realAngle = 360 - heading + 360 + angle;
  } else {
    realAngle = 360 - heading + angle;
  }
  if (realAngle > 360) {
    realAngle -= 360;
  }
  if (realAngle > 180) {
    realAngle -= 360;
  }

  return realAngle;
}

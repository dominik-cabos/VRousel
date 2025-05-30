let scene, camera, renderer, carousel;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationSpeed = 0;
let raycaster, mouse;
const friction = 0.95; // Configurable: 0.95 means 5% speed reduction per frame
const minSpeed = 0.001; // Minimum speed before stopping

// VR Controllers
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let vrControllerRotationSpeed = 0;
let isVRRotating = false;
let previousControllerRotation = null;

// Define camera position as constants so we can reuse them
const CAMERA_POSITION_Z = 20; // allowed range: 15 <> 45
const CAMERA_POSITION_Y = 4;  // allowed range: -5 <> 5
let originalCarouselParent;

function init() {
  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1, // Reduced near plane for better VR
      1000,
  );

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xcccccc); // Light gray background
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  // Set up lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Create and add carousel
  carousel = new Carousel(5, camera);
  scene.add(carousel.group);
  originalCarouselParent = carousel.group.parent;

  // Position camera for non-VR view
  camera.position.z = CAMERA_POSITION_Z;
  camera.position.y = CAMERA_POSITION_Y;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Set up VR
  renderer.xr.enabled = true;

  // Create VR button manually since we can't use the module
  const vrButton = document.createElement('button');
  vrButton.style.position = 'absolute';
  vrButton.style.bottom = '20px';
  vrButton.style.left = '50%';
  vrButton.style.transform = 'translateX(-50%)';
  vrButton.style.padding = '12px 20px';
  vrButton.style.border = '1px solid #fff';
  vrButton.style.borderRadius = '4px';
  vrButton.style.background = 'rgba(0,0,0,0.1)';
  vrButton.style.color = '#fff';
  vrButton.style.font = 'normal 13px sans-serif';
  vrButton.style.outline = 'none';
  vrButton.style.cursor = 'pointer';
  vrButton.textContent = 'ENTER VR';

  vrButton.onmouseenter = function() {
    vrButton.style.background = 'rgba(0,0,0,0.5)';
  };

  vrButton.onmouseleave = function() {
    vrButton.style.background = 'rgba(0,0,0,0.1)';
  };

  vrButton.onclick = function() {
    if (navigator.xr) {
      navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      }).then(function(session) {
        renderer.xr.setSession(session);
        vrButton.textContent = 'EXIT VR';
      });
    }
  };

  document.body.appendChild(vrButton);

  // Setup VR controllers
  setupVRControllers();

  // Add event listeners for VR session
  renderer.xr.addEventListener('sessionstart', onVRSessionStart);
  renderer.xr.addEventListener('sessionend', onVRSessionEnd);

  // Setup mouse controls
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("mouseup", onMouseUp);
  renderer.domElement.addEventListener("mouseleave", onMouseUp);
  renderer.domElement.addEventListener("click", onClick);

  // Handle window resize
  window.addEventListener("resize", onWindowResize, false);

  // Use animation loop instead of requestAnimationFrame for VR compatibility
  renderer.setAnimationLoop(animate);
}

function setupVRControllers() {
  // Controller 1
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('selectstart', onSelectStart);
  controller1.addEventListener('selectend', onSelectEnd);
  controller1.addEventListener('connected', function(event) {
    this.add(buildController(event.data));
  });
  controller1.addEventListener('disconnected', function() {
    this.remove(this.children[0]);
  });
  scene.add(controller1);

  // Controller 2
  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('selectstart', onSelectStart);
  controller2.addEventListener('selectend', onSelectEnd);
  controller2.addEventListener('connected', function(event) {
    this.add(buildController(event.data));
  });
  controller2.addEventListener('disconnected', function() {
    this.remove(this.children[0]);
  });
  scene.add(controller2);

  // Add simple controller grips (without models for now)
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  scene.add(controllerGrip1);

  controllerGrip2 = renderer.xr.getControllerGrip(1);
  scene.add(controllerGrip2);
}

function buildController(data) {
  let geometry, material;

  switch(data.targetRayMode) {
    case 'tracked-pointer':
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
      material = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending
      });
      return new THREE.Line(geometry, material);

    case 'gaze':
      geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
      material = new THREE.MeshBasicMaterial({
        opacity: 0.5,
        transparent: true
      });
      return new THREE.Mesh(geometry, material);
  }
}

function onSelectStart(event) {
  const controller = event.target;

  // Store the controller's initial rotation when starting to drag
  isVRRotating = true;
  previousControllerRotation = controller.rotation.y;

  // Check if we're pointing at a router
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  const vrRaycaster = new THREE.Raycaster();
  vrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  vrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = vrRaycaster.intersectObjects(carousel.group.children, true);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    if (clickedObject instanceof Router || clickedObject.parent instanceof Router) {
      const router = clickedObject instanceof Router ? clickedObject : clickedObject.parent;
      router.onClick();
      isVRRotating = false; // Don't rotate if we clicked a router
    }
  }
}

function onSelectEnd(event) {
  isVRRotating = false;
  previousControllerRotation = null;
}

// This function will be called when the VR session starts
function onVRSessionStart(event) {
  console.log("VR session started");

  // Create a VR group if it doesn't exist
  if (!window.vrGroup) {
    window.vrGroup = new THREE.Group();
    scene.add(window.vrGroup);
  }

  // Remember the carousel's original parent
  originalCarouselParent = carousel.group.parent;

  // Remove carousel from its current parent
  if (carousel.group.parent) {
    carousel.group.parent.remove(carousel.group);
  }

  // Add carousel to VR group
  window.vrGroup.add(carousel.group);

  // Position the VR group to simulate camera being outside the carousel
  window.vrGroup.position.set(0, -CAMERA_POSITION_Y, -CAMERA_POSITION_Z);

  // Make sure camera is at origin for VR
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld(true);

  // Update VR button text
  const vrButton = document.querySelector('button');
  if (vrButton) vrButton.textContent = 'EXIT VR';
}

function onMouseDown(event) {
  isDragging = true;
  previousMousePosition = {
    x: event.clientX,
    y: event.clientY,
  };
}

function onMouseMove(event) {
  if (isDragging) {
    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y,
    };

    rotationSpeed = deltaMove.x * 0.01;
    carousel.rotate(rotationSpeed);

    previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }
}

function onMouseUp() {
  isDragging = false;
}

// Add VR session end handler function
function onVRSessionEnd() {
  console.log("VR session ended");

  // If we created a VR group, remove carousel from it and reset
  if (window.vrGroup) {
    // Remove carousel from VR group
    if (carousel.group.parent === window.vrGroup) {
      window.vrGroup.remove(carousel.group);
    }

    // Add carousel back to its original parent
    if (originalCarouselParent) {
      originalCarouselParent.add(carousel.group);
    } else {
      scene.add(carousel.group);
    }

    // Remove VR group
    scene.remove(window.vrGroup);
    window.vrGroup = null;
  }

  // Reset camera position for non-VR view
  camera.position.set(0, CAMERA_POSITION_Y, CAMERA_POSITION_Z);
  camera.lookAt(0, 0, 0);

  // Update VR button text
  const vrButton = document.querySelector('button');
  if (vrButton) vrButton.textContent = 'ENTER VR';
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onClick(event) {
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(carousel.group.children, true);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    if (
        clickedObject instanceof Router ||
        clickedObject.parent instanceof Router
    ) {
      const router =
          clickedObject instanceof Router ? clickedObject : clickedObject.parent;
      router.onClick();
    }
  }
}

function updateVRControllerRotation() {
  if (!isVRRotating) return;

  // Check both controllers
  const activeController = controller1.userData.isSelecting ? controller1 :
                         controller2.userData.isSelecting ? controller2 : null;

  if (activeController && previousControllerRotation !== null) {
    // Get controller position for horizontal movement tracking
    const controllerPos = new THREE.Vector3();
    activeController.getWorldPosition(controllerPos);

    // Calculate rotation based on controller movement
    // We'll use the controller's world position X component for rotation
    const currentRotation = Math.atan2(controllerPos.x, controllerPos.z);

    if (previousControllerRotation !== null) {
      const deltaRotation = currentRotation - previousControllerRotation;

      // Apply rotation with sensitivity adjustment
      vrControllerRotationSpeed = deltaRotation * 2.0; // Adjust sensitivity as needed
      carousel.rotate(vrControllerRotationSpeed);
    }

    previousControllerRotation = currentRotation;
  }
}

function animate() {
  // Update controller selection state
  if (controller1) {
    controller1.userData.isSelecting = renderer.xr.getSession() &&
      renderer.xr.getSession().inputSources[0] &&
      renderer.xr.getSession().inputSources[0].gamepad &&
      renderer.xr.getSession().inputSources[0].gamepad.buttons[0].pressed;
  }

  if (controller2) {
    controller2.userData.isSelecting = renderer.xr.getSession() &&
      renderer.xr.getSession().inputSources[1] &&
      renderer.xr.getSession().inputSources[1].gamepad &&
      renderer.xr.getSession().inputSources[1].gamepad.buttons[0].pressed;
  }

  // Update VR controller rotation
  updateVRControllerRotation();

  // Apply inertia for mouse/non-VR rotation
  if (!isDragging && !isVRRotating) {
    // Apply inertia
    if (Math.abs(rotationSpeed) > minSpeed || Math.abs(vrControllerRotationSpeed) > minSpeed) {
      const activeSpeed = Math.abs(rotationSpeed) > Math.abs(vrControllerRotationSpeed) ?
                         rotationSpeed : vrControllerRotationSpeed;
      carousel.rotate(activeSpeed);

      // Apply friction
      if (Math.abs(rotationSpeed) > minSpeed) {
      rotationSpeed *= friction;
    } else {
      rotationSpeed = 0;
    }

      if (Math.abs(vrControllerRotationSpeed) > minSpeed) {
        vrControllerRotationSpeed *= friction;
      } else {
        vrControllerRotationSpeed = 0;
      }
    }
  }

  renderer.render(scene, camera);
}

init();

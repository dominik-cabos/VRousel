let scene, camera, renderer, carousel;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationSpeed = 0;
let raycaster, mouse;
const friction = 0.95; // Configurable: 0.95 means 5% speed reduction per frame
const minSpeed = 0.001; // Minimum speed before stopping

    import { VRButton } from './node_modules/three/examples/jsm/webxr/VRButton.js';
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.4, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xcccccc); // Light gray background
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    // Set up lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create and add carousel
    carousel = new Carousel(5, camera);
    scene.add(carousel.group);

    // Position camera
    camera.position.z = 20; // allowed range: 15 <> 45
    camera.position.y = 4; // allowed range: -5 <> 5

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    document.body.appendChild( VRButton.createButton( renderer ) );
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);
    renderer.domElement.addEventListener('click', onClick);
renderer.xr.enabled = true;
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    renderer.setAnimationLoop( function () {

        renderer.render( scene, camera );

    } );
    animate();
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (isDragging) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        rotationSpeed = deltaMove.x * 0.01;
        carousel.rotate(rotationSpeed);

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function onMouseUp() {
    isDragging = false;
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
        if (clickedObject instanceof Router || clickedObject.parent instanceof Router) {
            const router = clickedObject instanceof Router ? clickedObject : clickedObject.parent;
            router.onClick();
        }
    }
}
function animate() {
    requestAnimationFrame(animate);

    if (!isDragging) {
        // Apply inertia
        if (Math.abs(rotationSpeed) > minSpeed) {

            carousel.rotate(rotationSpeed);

            // Apply friction
            rotationSpeed *= friction;
        } else {

            rotationSpeed = 0;
        }
    }

    renderer.render(scene, camera);

}

init();

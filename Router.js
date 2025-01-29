class Router extends THREE.Mesh {
    constructor(carousel) {
        const width = 1;
        const height = 1.2;
        const depth = 0.75;
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: 0xA0A0A0,
            roughness: 0.2,
            metalness: 0.5
        });
        super(geometry, material);

        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x808080, linewidth: 1 });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.add(edges);

        this.carousel = carousel;
        this.initialPosition = new THREE.Vector3();
        this.initialRotation = new THREE.Euler();
        this.initialScale = new THREE.Vector3(1, 1, 1);
        this.isExpanded = false;
        this.isAnimating = false;
        this.isDragging = false;
        this.previousMousePosition = new THREE.Vector2();

        // Bind the drag handlers to maintain context
        this.onDragStart = this.onDragStart.bind(this);
        this.onDragMove = this.onDragMove.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);

        // Add event listeners for drag rotation
        document.addEventListener('mousedown', this.onDragStart);
        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);
        document.addEventListener('mouseleave', this.onDragEnd);
    }

    expand() {
        if (this.isExpanded || this.isAnimating) return;
        this.isAnimating = true;

        // Double the expansion height (2 * height instead of just height)
        const targetPosition = this.position.clone().add(
            new THREE.Vector3(0, this.geometry.parameters.height * 2, 0)
        );
        const targetScale = new THREE.Vector3(1.5, 1.5, 1.5);

        this.animate(targetPosition, targetScale, this.rotation.clone(), () => {
            this.isExpanded = true;
            this.isAnimating = false;
        });
    }

    collapse() {
        if (!this.isExpanded || this.isAnimating) return;
        this.isAnimating = true;

        this.animate(
            this.initialPosition.clone(),
            this.initialScale.clone(),
            this.initialRotation.clone(),
            () => {
                this.isExpanded = false;
                this.isAnimating = false;
            }
        );
    }

    animate(targetPosition, targetScale, targetRotation, onComplete) {
        const duration = 1000;
        const startPosition = this.position.clone();
        const startScale = this.scale.clone();
        const startRotation = this.rotation.clone();
        const startTime = Date.now();

        const animateFrame = () => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1);

            // Smooth easing function
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            this.position.lerpVectors(startPosition, targetPosition, eased);
            this.scale.lerpVectors(startScale, targetScale, eased);

            // Interpolate rotation
            this.rotation.x = THREE.MathUtils.lerp(startRotation.x, targetRotation.x, eased);
            this.rotation.y = THREE.MathUtils.lerp(startRotation.y, targetRotation.y, eased);
            this.rotation.z = THREE.MathUtils.lerp(startRotation.z, targetRotation.z, eased);

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                onComplete();
            }
        };

        animateFrame();
    }

    onDragStart(event) {
        if (!this.isExpanded) return;

        // Convert mouse coordinates to normalized device coordinates
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        // Create raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.carousel.camera);

        // Check if this router was clicked
        const intersects = raycaster.intersectObject(this, true);
        if (intersects.length > 0) {
            this.isDragging = true;
            this.previousMousePosition.set(event.clientX, event.clientY);
        }
    }

    onDragMove(event) {
        if (!this.isDragging || !this.isExpanded) return;

        const deltaMove = {
            x: event.clientX - this.previousMousePosition.x,
            y: event.clientY - this.previousMousePosition.y
        };

        // Rotate based on drag direction
        this.rotation.y += deltaMove.x * 0.01;
        this.rotation.x += deltaMove.y * 0.01;

        this.previousMousePosition.set(event.clientX, event.clientY);
    }

    onDragEnd() {
        this.isDragging = false;
    }

    onClick() {
        this.carousel.onRouterClick(this);
    }

    dispose() {
        // Clean up event listeners when the router is destroyed
        document.removeEventListener('mousedown', this.onDragStart);
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
        document.removeEventListener('mouseleave', this.onDragEnd);
    }
}

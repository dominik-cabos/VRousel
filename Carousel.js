class Carousel {
    constructor(routerCount, camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.routerCount = routerCount;
        this.radius = 5;
        this.routerWidth = 1;
        this.createBase();
        this.createRouters();
        this.currentRotation = 0;
        this.snapAngle = (Math.PI * 2) / this.routerCount;
        this.expandedRouter = null;
    }

    createBase() {
        const geometry = new THREE.RingGeometry(this.radius - 1, this.radius + 1, 64);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        this.base = new THREE.Mesh(geometry, material);
        this.base.rotation.x = -Math.PI / 2;
        this.group.add(this.base);
    }

    createRouters() {
        this.routers = [];
        for (let i = 0; i < this.routerCount; i++) {
            const angle = (i / this.routerCount) * Math.PI * 2;
            const router = new Router(this);
            router.position.set(
                Math.cos(angle) * this.radius,
                this.routerWidth * 1, // Half of the glass base height
                Math.sin(angle) * this.radius
            );
            router.initialPosition.copy(router.position);
            this.group.add(router);
            this.routers.push(router);
        }
    }

    rotate(angle) {
        this.currentRotation += angle;
        this.group.rotation.y = this.currentRotation;
    }

    getNearestSnapAngle() {
        return Math.round(this.currentRotation / this.snapAngle) * this.snapAngle;
    }

    onRouterClick(clickedRouter) {
        if (this.expandedRouter && this.expandedRouter !== clickedRouter) {
            this.expandedRouter.collapse();
        }

        if (clickedRouter.isExpanded) {
            clickedRouter.collapse();
            this.expandedRouter = null;
        } else {
            clickedRouter.expand();
            this.expandedRouter = clickedRouter;
            this.rotateToFaceRouter(clickedRouter);
        }
    }


    getRouterAngle(router) {
        // Get the angle of the router relative to the carousel's current rotation
        const position = new THREE.Vector3();
        router.getWorldPosition(position);
        return Math.atan2(position.x, position.z);
    }

    rotateToFaceRouter(router) {
        // Calculate target rotation to face the camera (-Math.PI)
        const currentAngle = this.getRouterAngle(router);
        const targetRotation = -Math.PI - currentAngle;

        // Normalize the rotation to find the shortest path
        const normalizedRotation = ((targetRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let deltaRotation = normalizedRotation - (this.currentRotation % (Math.PI * 2));

        // Ensure we rotate the shortest distance
        if (Math.abs(deltaRotation) > Math.PI) {
            deltaRotation -= Math.sign(deltaRotation) * Math.PI * 2;
        }

        this.animateRotation(this.currentRotation + deltaRotation);
    }

    animateRotation(targetRotation) {
        const startRotation = this.currentRotation;
        const duration = 1000; // milliseconds
        const startTime = Date.now();

        const animate = () => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1);

            // Use easeInOutCubic for smooth animation
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            this.currentRotation = startRotation + (targetRotation - startRotation) * eased;
            this.group.rotation.y = this.currentRotation;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }
}

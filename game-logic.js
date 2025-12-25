import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const COLORS = [0xd42c2c, 0xd4af37, 0x228822, 0x3355ff, 0xffffff, 0xff00ff];
const TARGET_TREE_HEIGHT = 4.0;
const ORNAMENT_SIZE = 0.12;

class ChristmasApp {
    constructor() {
        this.canvas = document.querySelector('#glCanvas');
        this.scene = new THREE.Scene();
        this.ornaments = [];
        this.gifts = [];
        this.selectedColor = COLORS[0];
        this.selectedShape = 'bauble';

        this.giftModels = {};
        this.bellModels = {};

        this.treeLoaded = false;

        this.init();
        this.loadTreeModel();
        this.loadGiftModels();
        this.loadBellTextures();

        this.setupInteraction();
        this.setupUI();
        this.animate();
    }
    init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        //cemera
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 2, 8);

        //background
        this.scene.background = new THREE.Color(0x87CEEB);
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('assets/bg.jpg', (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        });
        this.scene.fog = new THREE.Fog(0xffffff, 10, 40);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        //light filling
        const fillLight = new THREE.DirectionalLight(0xb0e0ff, 0.6);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        const floorGeo = new THREE.CircleGeometry(15, 64);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0.0
        });
        this.floor = new THREE.Mesh(floorGeo, floorMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.floor.name = 'FloorSurface';
        this.scene.add(this.floor);

        //controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2.0;
        this.controls.maxDistance = 12.0;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
        this.controls.target.set(0, 2, 0);

        //processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.4, 0.3, 0.9
        );
        this.composer.addPass(bloomPass);
        this.createSnow();
    }

    loadGiftModels() {
        const loader = new GLTFLoader();
        const giftFiles = ['giftbox-1.glb', 'giftbox-2.glb', 'giftbox-3.glb', 'giftbox-4.glb'];

        giftFiles.forEach((file, index) => {
            loader.load(`assets/${file}`, (gltf) => {
                const model = gltf.scene;
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });
                const key = `gift-${index + 1}`;
                this.giftModels[key] = model;
            });
        });
    }

    loadBellTextures() {
        const loader = new GLTFLoader();
        const bellFiles = ['bell-put1.png', 'bell-put2.png', 'bell-put3.png', 'bell-put4.png'];

        bellFiles.forEach((file, index) => {
            loader.load(`assets/${file}`, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                const key = `bell-${index + 1}`;
                this.bellModels[key] = texture;
            });
        });
    }

    //star shape 
    createStarGeometry() {
        const shape = new THREE.Shape();
        const points = 5;
        const outerRadius = ORNAMENT_SIZE * 1.2;
        const innerRadius = ORNAMENT_SIZE * 0.5;

        for (let i = 0; i < points * 2; i++) {
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            const a = (i / (points * 2)) * Math.PI * 2;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        const extrudeSettings = {
            depth: 0.05,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelSegments: 3
        };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        return geometry;
    }
    createBaubleGeometry() {
        return new THREE.SphereGeometry(ORNAMENT_SIZE, 32, 32);
    }
    createSnow() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const context = canvas.getContext('2d');

        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
        const snowTexture = new THREE.CanvasTexture(canvas);
        const count = 2500;
        const positions = new Float32Array(count * 3);
        const vels = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20,
                positions[i * 3 + 1] = Math.random() * 15;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

            vels.push({
                x: (Math.random() - 0.5) * 0.02,
                y: -(Math.random() * 0.02 + 0.01),
                offset: Math.random() * 100
            });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            map: snowTexture,
            size: 0.12,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.NormalBlending
        });
        this.snowSystem = new THREE.Points(geo, mat);
        this.snowSystem.userData = { vels };
        this.scene.add(this.snowSystem);
    }
    loadTreeModel() {
        this.treeGroup = new THREE.Group();
        this.scene.add(this.treeGroup);
        this.ornamentContainer = new THREE.Group();
        this.treeGroup.add(this.ornamentContainer);

        const loader = new GLTFLoader();
        loader.load('assets/tree.glb', (gltf) => {
            const model = gltf.scene;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.name = "TreeSurface";

                    if(child.material){
                        child.material.alphaTest = 0.5;
                        child.material.transparent = true;
                        child.material.side = THREE.DoubleSide;
                    }
                }
            });
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3(); box.getSize(size);
            const center = new THREE.Vector3(); box.getCenter(center);
            const currentY = size.y || 1;
            const scaleFactor = TARGET_TREE_HEIGHT / currentY;

            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
            model.position.x = -center.x * scaleFactor;
            model.position.y = -box.min.y * scaleFactor;
            model.position.z = -center.z * scaleFactor;

            this.treeGroup.add(model);
            this.treeLoaded = true;

            const midHeight = TARGET_TREE_HEIGHT / 2;
            this.controls.target.set(0, midHeight, 0);
            this.camera.position.set(0, midHeight, TARGET_TREE_HEIGHT * 1.5);
            this.controls.update();

            const loaderDiv = document.getElementById('loader');
            if (loaderDiv) {
                setTimeout(() => {
                    loaderDiv.style.opacity = 0;
                    setTimeout(() => loaderDiv.remove(), 500);
                }, 2500);
            }
        }, undefined, (err) => {
            console.error(err);
            alert("Could not load tree.glb");
        });
    }
    setupInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.ghostGeometry = this.createBaubleGeometry();
        this.ghostMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });
        this.ghost = new THREE.Mesh(this.ghostGeometry, this.ghostMaterial);
        this.ghost.visible = false;
        this.scene.add(this.ghost);

        const onMove = (e) => {
            if (!this.treeLoaded) return;
            const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            this.mouse.x = (x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(y / window.innerHeight) * 2 + 1;
            this.checkIntersection();
        };
        const onClick = (e) => {
            if (e.target.closest('#ui')) return;
            if (this.ghost.visible) {
                this.placeItem(this.ghost.position, this.ghost.quaternion);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerdown', onClick);
        window.addEventListener('resize', () => this.onResize());
    }
    updateGhost() {
        this.scene.remove(this.ghost);
        if (this.ghost.geometry) this.ghost.geometry.dispose();

        if (this.selectedShape.startsWith('gift')) {
            const model = this.giftModels[this.selectedShape];
            if (model) {
                this.ghost = model.clone();
                this.ghost.traverse((child) => {
                    if (child.isMesh) {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.5;
                        child.material.depthWrite = false;
                    }
                });
                this.ghost.scale.set(0.2, 0.2, 0.2);
            } else {
                this.ghost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
            }
        }
        //bells
        else if (this.selectedShape.startsWith('bell')) {
            const texture = this.bellModels[this.selectedShape];
            if (texture) {
                const geometry = new THREE.PlaneGeometry(0.3, 0.3);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide,
                    alphaTest: 0.5
                });
                this.ghost = new THREE.Mesh(geometry, material);
            } else {
                this.ghost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.5
                }));
            }
        }
        else if (this.selectedShape === 'star') {
            const geom = this.createStarGeometry();
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            this.ghost = new THREE.Mesh(geom, mat);
        }
        else {
            const geom = this.createBaubleGeometry();
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            this.ghost = new THREE.Mesh(geom, mat);
        }
        this.ghost.visible = false;
        this.scene.add(this.ghost);
    }
    checkIntersection() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        let intersectTarget = [];
        const isGiftMode = this.selectedShape.startsWith('gift');
        if (isGiftMode) {
            intersectTarget = [this.floor];
        } else {
            this.treeGroup.traverse((child) => {
                if (child.isMesh && child.name === "TreeSurface") intersectTarget.push(child);
            });
        }
        const intersects = this.raycaster.intersectObjects(intersectTarget);

        if (intersects.length > 0) {
            const hit = intersects[0];
            this.ghost.visible = true;

            const isBellMode = this.selectedShape.startsWith('bell');

            if (!isGiftMode && !isBellMode && this.ghost.material) {
                this.ghost.material.color.setHex(this.selectedColor);
            }
            if (isGiftMode) {
                this.ghost.position.copy(hit.point);
                this.ghost.quaternion.set(0, 0, 0, 1);
            } else {
                const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                let offsetAmount = 0.06;
                if (this.selectedShape === 'star') offsetAmount = 0.08;
                if (isBellMode) offsetAmount = 0.02;

                this.ghost.position.copy(hit.point.clone().add(normal.multiplyScalar(offsetAmount)));
                this.ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            }
        } else {
            this.ghost.visible = false;
        }
    }
    placeItem(pos, quat) {
        if (this.selectedShape.startsWith('gift')) {
            const originalModel = this.giftModels[this.selectedShape];
            if (!originalModel) return;

            const mesh = originalModel.clone();
            mesh.position.copy(pos);
            mesh.quaternion.copy(quat);
            mesh.scale.set(0, 0, 0);

            this.scene.add(mesh);
            this.gifts.push(mesh);

            let s = 0;
            const targetScale = 0.2;
            const pop = () => {
                s += 0.02;
                mesh.scale.set(s, s, s);
                if (s < targetScale) requestAnimationFrame(pop);
            };
            pop();
        }
        //bell png
        else if (this.selectedShape.startsWith('bell')) {
            const texture = this.bellModels[this.selectedShape];
            if (!texture) return;

            //flat plane
            const geometry = new THREE.PlaneGeometry(0.3, 0.3);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.5,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(pos);
            mesh.quaternion.copy(quat);

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            mesh.scale.set(0, 0, 0);
            this.ornamentContainer.add(mesh);
            this.ornaments.push({ mesh, color: null });
            let s = 0;
            const targetScale = 1;
            const pop = () => {
                s += 0.015;
                mesh.scale.set(s, s, s);
                if (s < targetScale) requestAnimationFrame(pop);
            };
            pop();
        }

        //bauble
        else {
            let geometry;
            if (this.selectedShape === 'star') geometry = this.createStarGeometry();
            else geometry = this.createBaubleGeometry();

            const mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({
                    color: this.selectedColor,
                    metalness: 0.8,
                    roughness: 0.15
                })
            );
            mesh.position.copy(pos);
            mesh.quaternion.copy(quat);
            mesh.castShadow = true;

            this.ornamentContainer.add(mesh);
            this.ornaments.push({ mesh, color: this.selectedColor });

            mesh.scale.set(0, 0, 0);
            let s = 0;
            const pop = () => {
                s += 0.15;
                mesh.scale.set(s, s, s);
                if (s < 1) requestAnimationFrame(pop)
            };
            pop();
        }
    }
    setupUI() {
        const palette = document.getElementById('palette');
        palette.innerHTML = '';

        COLORS.forEach((color, index) => {
            const btn = document.createElement('div');
            btn.className = `color-btn ${index === 0 ? 'active' : ''}`;
            btn.style.backgroundColor = '#' + new THREE.Color(color).getHexString();
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedColor = color;
            });
            palette.appendChild(btn);
        });
        document.getElementById('btn-clear').onclick = () => {
            if (confirm("Remove all decorations?")) {
                this.ornaments.forEach(o => this.ornamentContainer.remove(o.mesh));
                this.ornaments = [];
                this.gifts.forEach(g => this.scene.remove(g));
                this.gifts = [];
            }
        };
        document.getElementById('btn-snap').onclick = () => {
            this.render();
            const link = document.createElement('a');
            link.download = `evergreen-${Date.now()}.png`;
            link.href = this.canvas.toDataURL('image/png');
            link.click();
        };
        const menu = document.getElementById('selection-menu');
        const giftBtn = document.getElementById('btn-gift');
        const paletteContainer = document.querySelector('.controls-area');
        const giftSubmenu = document.getElementById('gift-submenu');
        const bellSubmenu = document.getElementById('bell-submenu');

        giftBtn.onclick = () => {
            menu.classList.toggle('open');
        };
        const itemBtns = menu.querySelectorAll('.item-btn');
        itemBtns.forEach(btn => {
            btn.addEventListener('click', () => {

                itemBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const type = btn.dataset.type;

                giftSubmenu.classList.remove('visible');
                bellSubmenu.classList.remove('visible');
                paletteContainer.classList.remove('hidden');

                if (type === 'gift-mode') {
                    this.selectedShape = 'gift-1';
                    paletteContainer.classList.add('hidden');
                    giftSubmenu.classList.add('visible');

                    document.querySelectorAll('.gift-option').forEach(g => g.classList.remove('active'));
                    const first = document.querySelectorAll('.gift-option[data-gift="1"]');
                    if (first) first.classList.add('active');

                } else if (type === 'bell-mode') {
                    this.selectedShape = 'bell-1';
                    paletteContainer.classList.add('hidden');
                    bellSubmenu.classList.add('visible');

                    document.querySelectorAll('.bell-option').forEach(b => b.classList.remove('active'));
                    const first = document.querySelector('.bell-option[data-bell="1"]');
                    if (first) first.classList.add('active');
                } else {
                    this.selectedShape = type;
                }
                this.updateGhost();

            });
        });
        const giftOptions = document.querySelectorAll('.gift-option');
        giftOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                giftOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                const num = opt.dataset.gift;
                this.selectedShape = `gift-${num}`;
                this.updateGhost();
            });
        });
        const bellOptions = document.querySelectorAll('.bell-option');
        bellOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                bellOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const num = opt.dataset.bell;
                this.selectedShape = `bell-${num}`;
                this.updateGhost();
            });
        });
    }
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }
    render() {
        this.composer.render();
    }
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();

        if (this.snowSystem) {
            const positions = this.snowSystem.geometry.attributes.position.array;
            const vels = this.snowSystem.userData.vels;
            for (let i = 0; i < vels.length; i++) {
                positions[i * 3 + 1] += vels[i].y;
                positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * vels[i].x;
                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 12;
            }
            this.snowSystem.geometry.attributes.position.needsUpdate = true;
        }
        this.render();
    }
}
window.onload = () => new ChristmasApp();
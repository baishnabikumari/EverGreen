//import { Children } from 'react';
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
        this.selectedShape = null;

        this.giftModels = {};
        //this.bellModels = {};

        this.treeLoaded = false;

        this.init();
        this.loadTreeModel();
        this.loadGiftModels();
        //this.loadBellTextures();

        this.setupInteraction();
        this.setupUI();
        this.animate();
    }
    init() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
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
                const rawModel = gltf.scene;
                const box = new THREE.Box3().setFromObject(rawModel);
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                box.getCenter(center);
                box.getSize(size);

                const wrapper = new THREE.Group();
                rawModel.position.x = -center.x;
                rawModel.position.y = -box.min.y;
                rawModel.position.z = -center.z;

                wrapper.add(rawModel);
                wrapper.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });
                const key = `gift-${index + 1}`;
                this.giftModels[key] = wrapper;

                //updation the ghost instantly if the gift is selected
                if(this.selectedShape === key){
                    this.updateGhost();
                }
            });
        });
    }

    /*loadBellTextures() {
        const loader = new GLTFLoader();
        const bellFiles = ['bell-put1.png', 'bell-put2.png', 'bell-put3.png', 'bell-put4.png'];

        bellFiles.forEach((file, index) => {
            loader.load(`assets/${file}`, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                const key = `bell-${index + 1}`;
                this.bellModels[key] = texture;

                if(this.selectedShape === key){
                    this.updateGhost();
                }
            }, undefined, (err) => {
                console.error("Error loading bell texture:", file, err);
            });
        });
    } */

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
        this.hoveredItem = null;

        //cross marker for deletion
        const barGeo = new THREE.BoxGeometry(0.12, 0.03, 0.01);
        const barMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            depthTest: false,
            transparent: true
        });
        const bar1 = new THREE.Mesh(barGeo, barMat);
        const bar2 = new THREE.Mesh(barGeo, barMat);
        bar1.rotation.z = Math.PI / 4;
        bar2.rotation.z = -Math.PI / 4;
        this.deleteMarker = new THREE.Group();
        this.deleteMarker.add(bar1,bar2);
        this.deleteMarker.visible = false;
        this.deleteMarker.renderOrder = 999; //force the render on top
        this.scene.add(this.deleteMarker);

        const startMusic = () => {
            const music = document.getElementById('bg-music');
            if (music){
                music.volume = 0.3;
                music.play().catch(e => console.log("waiting to play the audio"));
            }
            window.removeEventListener('click', startMusic);
            window.removeEventListener('keydown', startMusic);
            window.removeEventListener('touchstart', startMusic);
        };
        window.addEventListener('click', startMusic);
        window.addEventListener('keydown', startMusic);
        window.addEventListener('touchstart', startMusic);

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

            if(e.target !== this.canvas){
                this.ghost.visible = false;
                return;
            }
            const x = e.clientX;
            const y = e.clientY;
            this.mouse.x = (x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(y / window.innerHeight) * 2 + 1;
            this.checkIntersection();
        };
        const onClick = (e) => {
            if (e.target.closest('#ui')) return;

            const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            this.mouse.x = (x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(y / window.innerHeight) * 2 + 1;
            this.checkIntersection();

            if (this.hoveredItem){
                this.scene.remove(this.hoveredItem);
                this.ornamentContainer.remove(this.hoveredItem);

                this.ornaments = this.ornaments.filter(o => o.mesh !== this.hoveredItem);
                this.gifts = this.gifts.filter(g => g != this.hoveredItem);

                if(this.hoveredItem.geometry) this.hoveredItem.geometry.dispose();
                this.hoveredItem = null;
                this.deleteMarker.visible = false;
                this.checkIntersection();
            }
            else if (this.ghost.visible) {
                this.placeItem(this.ghost.position, this.ghost.quaternion);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerdown', onClick);
        window.addEventListener('resize', () => this.onResize());
    }
    updateGhost() {
        if (this.ghost){
            this.scene.remove(this.ghost);
            this.ghost.traverse((child) => {
                if (child.isMesh){
                    if (child.geometry) child.geometry.dispose();
                    if (child.material){
                        if(Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        if (!this.selectedShape) return;
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
                        child.castShadow = false;
                        child.receiveShadow = false;
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
                const geometry = new THREE.PlaneGeometry(0.25, 0.25);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    alphaTest: 0.5
                });
                this.ghost = new THREE.Mesh(geometry, material);
            } else {
                this.ghost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5}));
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

        if(this.hoveredItem && this.hoveredItem.originalHex !== undefined){
            if(this.hoveredItem.material) this.hoveredItem.material.color.setHex(this.hoveredItem.originalHex);
            this.hoveredItem = null;
        }
        let intersectTarget = [];
        const isGiftMode = this.selectedShape?.startsWith('gift') ?? false;

        if(isGiftMode){
            intersectTarget.push(this.floor);
        } else {
            this.treeGroup.traverse((child) => {
                if (child.isMesh && child.name === "TreeSurface") intersectTarget.push(child);
            });
        }
        const ornamentMeshes = this.ornaments.map(o => o.mesh);
        intersectTarget = [...intersectTarget, ...ornamentMeshes, ...this.gifts];

        const intersects = this.raycaster.intersectObjects(intersectTarget);

        if (intersects.length > 0) {
            let hit = intersects.find(i => 
                this.ornaments.some(o => o.mesh === i.object) ||
                this.gifts.includes(i.object)
            );
            let isExistingItem = true;
            if(!hit){
                hit = intersects[0];
                isExistingItem = false;
            }
            const object = hit.object;

            if (isExistingItem){
                this.ghost.visible = false;
                this.hoveredItem = object;
            
                // if(object.material && object.material.color){
                //     if(this.hoveredItem.originalHex === undefined){
                //         this.hoveredItem.originalHex = object.material.color.getHex();
                //     }
                //     object.material.color.setHex(0xff0000);
                // }
                this.deleteMarker.visible = true;
                this.deleteMarker.position.copy(object.position);
                const dir = new THREE.Vector3().subVectors(this.camera.position, object.position).normalize();
                this.deleteMarker.position.add(dir.multiplyScalar(0.2));
                this.deleteMarker.lookAt(this.camera.position);
                this.canvas.style.cursor = 'pointer';
                return;
            }
            this.deleteMarker.visible = false;
            if(!this.selectedShape){
                this.ghost.visible = false;
                this.canvas.style.cursor = 'default';
                return;
            }
            this.hoveredItem = null;
            this.canvas.style.cursor = 'default';
            this.ghost.visible = true;

            const isBellMode = this.selectedShape.startsWith('bell');

            if (!isGiftMode && this.ghost.material && !this.selectedShape.startsWith('gift')){
                if(this.ghost.material.color) this.ghost.material.color.setHex(this.selectedColor);
            }
            if (isGiftMode) {
                this.ghost.position.set(hit.point.x, 0, hit.point.z);
                this.ghost.quaternion.set(0, 0, 0, 1);
            } else {
                const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                let offsetAmount = 0.06;
                if (this.selectedShape === 'star') offsetAmount = 0.08;

                this.ghost.position.copy(hit.point.clone().add(normal.multiplyScalar(offsetAmount)));
                this.ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            }
        } else {
            this.ghost.visible = false;
            this.hoveredItem = null;
            this.canvas.style.cursor = 'default';
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
            if (!texture){
                console.warn("Bell texture not ready yet");
                return;
            }

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
            mesh.castShadow = false;
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
                if (s < 1) requestAnimationFrame(pop);
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
        //const bellSubmenu = document.getElementById('bell-submenu');

        giftBtn.onclick = () => {
            menu.classList.toggle('open');

            if(!menu.classList.contains('open')){
                giftSubmenu.classList.remove('visible');
            }
        };
        const itemBtns = menu.querySelectorAll('.item-btn');
        itemBtns.forEach(btn => {
            btn.addEventListener('click', () => {

                const wasActive = btn.classList.contains('active');
                const type = btn.dataset.type;

                itemBtns.forEach(b => b.classList.remove('active'));
                giftSubmenu.classList.remove('visible');
                //bellSubmenu.classList.remove('visible');
                paletteContainer.classList.remove('hidden');
                this.selectedShape = null;
                if(this.ghost) this.ghost.visible = false;

                if(!wasActive){
                    btn.classList.add('active');

                    if(type === 'gift-mode'){
                        this.selectedShape = 'gift-1';
                        giftSubmenu.classList.add('visible');
                        document.querySelectorAll('.gift-option').forEach(g => g.classList.remove('active'));
                        const first = document.querySelector('.gift-option[data-gift="1"]');
                        if (first) first.classList.add('active');
                    } else {
                        this.selectedShape = type;
                        paletteContainer.classList.remove('hidden');

                        if(type === 'star' || type === 'bauble'){
                            this.selectedColor = 0xffffff;
                            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                            const whiteBtn = document.querySelectorAll('.color-btn')[4];
                            if(whiteBtn) whiteBtn.classList.add('active');
                        }
                    }
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
        /*
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
        */
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
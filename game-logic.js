import { Children } from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

const COLORS = [0xd42c2c, 0xd4af37, 0x228822, 0x3355ff, 0xffffff, 0xff0ff];
const TARGET_TREE_HEIGHT = 4.0;
const ORNAMENT_SIZE = 0.12;

class ChristmasApp{
    constructor(){
        this.canvas = document.querySelector('#glCanvas');
        this.scene = new THREE.Scene();
        this.ornament = [];
        this.selectedColor = COLORS[0];
        this.treeLoaded = false;

        this.init();
        this.loadTreeModel();
        this.setupInteraction();
        this.setupUI();
        this.animate();
    }
    init(){
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio));
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        //cemera
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 2, 8);

        //background
        this.scene.background = new THREE.Color(0x87CEEB);
        const textLoader = new THREE.TextureLoader();
        textLoader.load('', (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        });
        this.scene.fog = new THREE.Fog(0xffffff, 10, 40);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(5,10,5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        //light filling
        const fillLight = new THREE.DirectionalLight(0xb0e0ff, 0.6);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(mainLight);

        const floorGeo = new THREE.CircleGeometry(15, 64);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0.0
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

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
    createSnow(){
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const context = canvas.getContext('2d');

        const gradient = context.createRadialGradient(16,16,0,16,16,16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        context.fillStyle = gradient;
        context.fillRect(0,0,32,32);
        const snowTexture = new THREE.CanvasTexture(canvas);
        const count = 2500;
        const position = new Float32Array(count * 3);
        const vels = [];
        for(let i=0; i<count; i++) {
            position[i*3] = (Math.random() - 0.5) * 20,
            position[i*3+1] = Math.random() * 15;
            position[i*3+2] = (Math.random() - 0.5) * 20;

            vels.push({
                x: (Math.random()-0.5) * 0.02,
                y: -(Math.random()*0.02 + 0.01),
                offset: Math.random() * 100
            });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(position, 3));

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
    loadTreeModel(){
        this.treeGroup = new THREE.Group();
        this.scene.add(this.treeGroup);
        this.ornamentContainer = new THREE.Group();
        this.treeGroup.add(this.ornamentContainer);

        const loader = new GLTFLoader();
        loader.load('assets/tree.glb', (gltf) => {
            const model = gltf.scene;

            model.traverse((child) => {
                if(Child.isMesh){
                    Child.castShadow = true;
                    child.receiveShadow = true;
                    child.name = "TreeSurface";
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

            const loaderDiv = document.getElementById('loader');
            if(loaderDiv){
                setTimeout(() => {
                    loaderDiv,Style.opacity = 0;
                    setTimeout(() => loaderDiv.remove(), 500);
                }, 2500);
            }
        }, undefined, (err) => {
            console.error(err);
            alert("Could not load tree.glb");
        });
    }
    
}
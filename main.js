import * as THREE from 'three'; // Three JS versio 0.180.0
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import Stats from 'three/addons/libs/stats.module.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// VARIABLES
var currentAction = 'idle';
var animationsMap = new Map();
var archer, spine, leftHand, rightHand, bow, arrow;
var play = 'idle';
var fadeDuration = 0.2;
var mouseButton = false;
var arrowMeshes = [];
var arrowBodies = [];
const originalArrowsCount = 10;
var arrows = originalArrowsCount; 
var arrowIndex = 0;
var arrowQuaternion = new THREE.Quaternion();
const mouse = new THREE.Vector2();
const currentCoords = new THREE.Vector3();
var totalScore = 0;

// --- UUDET MUUTTUJAT KAMERAN VIIVEPALAUTUKSELLE ---
let isFollowingArrow = false;   // Onko kamera parhaillaan nuolen perässä
let cameraResetDone = false;    // Onko palautusprosessi jo tehty tälle nuolelle
let resetTimeoutId = null;      // Ajastimen ID

// STATS
const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
document.body.appendChild( stats.domElement );

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color('skyblue');

// CAMERA
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);
const cameraOriginalOffset = new THREE.Vector3(0, 2, -2.5);
const cameraArrowOffset = new THREE.Vector3(0, 2, -5.5);
camera.position.set(cameraOriginalOffset.x, cameraOriginalOffset.y, cameraOriginalOffset.z);
camera.lookAt(0, 1.5, 0);

// RENDERER
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setAnimationLoop( animate );
document.body.appendChild(renderer.domElement);

// VIEWCAMERA
const viewcamera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 100);
const viewcanvas = document.getElementById('target_board_viewer');
const viewrenderer = new THREE.WebGLRenderer({ canvas: viewcanvas });
viewrenderer.setSize(500, 500);
viewcamera.position.set(0, 5, 30);
viewcamera.lookAt(new THREE.Vector3(0, 5, 34.5));

// DIRECTIONAL LIGHT
const directional = new THREE.DirectionalLight();
directional.intensity = 1;
directional.position.set(100, 100, 100);
scene.add(directional);

// AMBIENT LIGHT
const ambient = new THREE.AmbientLight();
ambient.intensity = 1.5;
scene.add(ambient);

// LOADING MANAGER
const manager = new THREE.LoadingManager();

// CANNON
const world = new CANNON.World({gravity: new CANNON.Vec3(0, -9.81, 0)});
const cannonDebugger = new CannonDebugger(scene, world, {
  color: 'yellow'
});

// TEXTURE LOADER
const textureloader = new THREE.TextureLoader(manager);
const texture = textureloader.load('assets/images/archerysheet.png');

// GROUND
const groundMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2000, 1, 2000),
  new THREE.MeshStandardMaterial({ color: 0x444444 })
);
scene.add(groundMesh);
groundMesh.position.y = -1;

const groundBody = new CANNON.Body({
  mass: 0,
  position: groundMesh.position,
  shape: new CANNON.Box(new CANNON.Vec3(1000, 0.5, 1000))
});
world.addBody(groundBody);

// TARGET WALL
const targetGeo = new THREE.BoxGeometry( 10, 10, 1 );
const targetMat = new THREE.MeshStandardMaterial( { color: 'darkgray' } );
const targetMesh = new THREE.Mesh( targetGeo, targetMat );
scene.add( targetMesh );
targetMesh.position.set(0, 5, 35);

const targetBody = new CANNON.Body({
  mass: 0,
  position: targetMesh.position,
  shape: new CANNON.Box(new CANNON.Vec3(5, 5, 0.5))
});
world.addBody(targetBody);

// TARGETSHEET
const sheetGeo = new THREE.PlaneGeometry(5, 5);
const sheetMat = new THREE.MeshStandardMaterial( { map: texture, transparent: true } );
const sheetMesh = new THREE.Mesh( sheetGeo, sheetMat );
scene.add( sheetMesh );
sheetMesh.rotation.y = Math.PI;
sheetMesh.position.set(0, 5, 34.45);

// MIXER
var mixer;

// FBX LOADER(S)
const loader1 = new FBXLoader(manager);
loader1.load('assets/character/Y Bot.fbx', (fbx) => {
    fbx.scale.setScalar(0.01);
    archer = fbx;
    spine = archer.getObjectByName('mixamorigSpine');
    leftHand = archer.getObjectByName('mixamorigLeftHandRing1');
    rightHand = archer.getObjectByName('mixamorigRightHand');
    scene.add(fbx);    
    mixer = new THREE.AnimationMixer(archer);
    loader1.load('assets/character/animations/idle.fbx', ( anim ) => {
        animationsMap.set('idle', mixer.clipAction(anim.animations[0]));
        animationsMap.get('idle').play();
    });
    loader1.load('assets/character/animations/draw.fbx', ( anim ) => {
        animationsMap.set('draw', mixer.clipAction(anim.animations[0]));
    });
    loader1.load('assets/character/animations/aim.fbx', ( anim ) => {
        animationsMap.set('aim', mixer.clipAction(anim.animations[0]));
    });
    loader1.load('assets/character/animations/release.fbx', ( anim ) => {
        animationsMap.set('release', mixer.clipAction(anim.animations[0]));
    });
});

const loader2 = new FBXLoader(manager);
loader2.load('assets/bow/Bow.fbx', (fbx) => {
    fbx.traverse((child) => {
        if (child.material) {
            child.material.color.setHex(0x333333);
        }
    });
    fbx.scale.setScalar(0.01);
    bow = fbx;
    scene.add(fbx);
});

const loader3 = new FBXLoader(manager);
loader3.load('assets/arrow/Arrow.FBX', function (fbx) {
	arrow = fbx;
    arrow.scale.setScalar(0.02);
    for (var i = 0; i < originalArrowsCount; i++) {        
		arrowMeshes.push(arrow.clone());
	}
});


// EVENT LISTENERS
window.addEventListener("resize", function (e) {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
});

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mouseup', (e) => {
    if (currentAction == 'idle' && mouseButton == false)
    {
        if (arrows > 0)
        {
            play = 'draw';
            mouseButton = true;

            setTimeout(() => {
                play = 'aim';
                mouseButton = false;
            }, 800);
        }
        else
        {
            console.log('Out of arrows!');
            const info_text = document.getElementById('info_text');
            info_text.innerHTML = 'OUT OF ARROWS!'
            info_text.className = 'miss';
            setTimeout(() => {
                info_text.innerHTML = ''
            }, 2000);
        }
        
    }
    else if (currentAction == 'aim')
    {
        play = 'release';
        mouseButton = true;
        arrows--;
        
        // Aktivoidaan seuranta uutta nuolta varten
        isFollowingArrow = true;
        cameraResetDone = false;

        // arrow speed
        const impulse = -50;
        const arrowBody = new CANNON.Body({
            mass: 1,
            position: rightHand.getWorldPosition(new THREE.Vector3()),
            quaternion: arrowQuaternion,
            shape: new CANNON.Box(new CANNON.Vec3(0.025, 0.025, 0.8)),
            velocity: new CANNON.Vec3().copy(bow.getWorldDirection(new THREE.Vector3()).multiplyScalar(impulse))
        });
        world.addBody(arrowBody);
        arrowBody.type = CANNON.Body.DYNAMIC;
        arrowBody.userData = { stuck: false };
        arrowBodies.push(arrowBody);
        scene.add(arrowMeshes[arrowIndex]);
        arrowIndex++;

        arrowBody.addEventListener("collide", (e) => {
            if (arrowBody.userData?.stuck) return;

            arrowBody.userData = { stuck: true };

            // e.contact contains details about the collision
            const contact = e.contact;
            // The world-space position of the contact point
            const worldCollisionPoint = contact.bi.position.vadd(contact.ri);
            currentCoords.x = worldCollisionPoint.x;
            currentCoords.y = worldCollisionPoint.y; // ehkä -5 ???
            currentCoords.z = worldCollisionPoint.z;

            calculateScore(e.body.id);

            // stop arrow
            arrowBody.velocity.set(0, 0, 0);
            arrowBody.angularVelocity.set(0, 0, 0);

            // locks arrow on that place
            arrowBody.type = CANNON.Body.STATIC;

            // --- KÄYNNISTETÄÄN DO ONCE AJASTIN JA KLIKKAUS ---
            if (!cameraResetDone) {
                // Automaattinen palautus 2 sekunnin kuluttua
                resetTimeoutId = setTimeout(() => {
                    doCameraDelay();
                }, 2000);
            }
        });

        setTimeout(() => {
            play = 'idle';
            
            const arrows_left = document.getElementById('arrows_left');
            arrows_left.innerHTML = "Arrows: " + arrows + " / 10";
            
        }, 450);
    }

});


// CLOCK
const clock = new THREE.Clock();
const timestep = 1 / 60;

// FUNCTIONS
function animate() {
    var delta = clock.getDelta();

    updateAnimations(delta);

    world.step(timestep);

    //cannonDebugger.update();

    groundMesh.position.copy(groundBody.position);
    groundMesh.quaternion.copy(groundBody.quaternion);

    for (var i = 0; i < arrowMeshes.length; i++)
    {
        if (arrowBodies[i])
        {
            arrowMeshes[i].position.copy(arrowBodies[i].position);
            arrowMeshes[i].quaternion.copy(arrowBodies[i].quaternion);
        }
    }
    
    followArrow(arrowIndex);

    if (spine)
    {
        rotateArcher();
    }

    if (leftHand && bow)
    {
        leftHand.getWorldPosition(bow.position);
        leftHand.getWorldQuaternion(bow.quaternion);
        const bowQ = new THREE.Quaternion();
        // HUOM! 15 = sihtauksen korjaus vasen/oikea suunnassa
        bowQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0).normalize(), ((-Math.PI / 180) * 12.5));
        bow.applyQuaternion(bowQ);
        bowQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1).normalize(), ((-Math.PI / 180) * -10));
        bow.applyQuaternion(bowQ);
        bowQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0).normalize(), ((-Math.PI / 180) * -10));
        bow.applyQuaternion(bowQ);
    }

    renderer.render( scene, camera );
    viewrenderer.render( scene, viewcamera );

    stats.update();
}

function followArrow(INDEX)
{
    if (!arrowBodies[INDEX - 1]) return;
    
    if (!arrowBodies[INDEX - 1].userData?.stuck)
    {
        const objectPosition = new THREE.Vector3();
        arrowMeshes[INDEX - 1].getWorldPosition(objectPosition);

        camera.position.copy(objectPosition).add(cameraArrowOffset);
    }    
}

function calculateScore(ID)
{
    const info_text = document.getElementById('info_text');
    const total_score = document.getElementById('total_score');
    const last_score = document.getElementById('last_score');
    
    if (ID == 0) // FLOOR
    {
        console.log('MISS! YOU HIT THE FLOOR!');
        info_text.innerHTML = 'MISS!';
        info_text.className = 'miss';
        last_score.innerHTML = 'Last Score: 0';
    }
    else if (ID === 1) // TARGET CUBE
    {
        const distance = (Math.round(sheetMesh.position.distanceTo(currentCoords) * 100000) / 100000).toFixed(5);
        //console.log('distance:', distance);
        if (distance <= 0.2525)
        {
            console.log('SCORE 10');
            info_text.innerHTML = 'SCORE 10!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 10';
            totalScore += 10;
        }
        else if (distance <= 0.5 && distance > 0.2525)
        {
            console.log('SCORE 9');
            info_text.innerHTML = 'SCORE 9!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 9';
            totalScore += 9;
        }
        else if (distance <= 0.75 && distance > 0.5)
        {
            console.log('SCORE 8');
            info_text.innerHTML = 'SCORE 8!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 8';
            totalScore += 8;
        }
        else if (distance <= 1.0 && distance > 0.75)
        {
            console.log('SCORE 7');
            info_text.innerHTML = 'SCORE 7!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 7';
            totalScore += 7;
        }
        else if (distance <= 1.25 && distance > 1.0)
        {
            console.log('SCORE 6');
            info_text.innerHTML = 'SCORE 6!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 6';
            totalScore += 6;
        }
        else if (distance <= 1.5 && distance > 1.25)
        {
            console.log('SCORE 5');
            info_text.innerHTML = 'SCORE 5!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 5';
            totalScore += 5;
        }
        else if (distance <= 1.75 && distance > 1.5)
        {
            console.log('SCORE 4');
            info_text.innerHTML = 'SCORE 4!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 4';
            totalScore += 4;
        }
        else if (distance <= 2.0 && distance > 1.75)
        {
            console.log('SCORE 3');
            info_text.innerHTML = 'SCORE 3!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 3';
            totalScore += 3;
        }
        else if (distance <= 2.25 && distance > 2.0)
        {
            console.log('SCORE 2');
            info_text.innerHTML = 'SCORE 2!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 2';
            totalScore += 2;
        }
        else if (distance <= 2.5 && distance > 2.25)
        {
            console.log('SCORE 1');
            info_text.innerHTML = 'SCORE 1!';
            info_text.className = 'hit';
            last_score.innerHTML = 'Last Score: 1';
            totalScore += 1;
        }
        if (distance > 2.5)
        {
            console.log('MISS! YOU HIT THE TARGET CUBE!');
            info_text.innerHTML = 'MISS!';
            info_text.className = 'miss';
            last_score.innerHTML = 'Last Score: 0';
        }
    }
    else
    {
        // DEBUG FOR POSSIBLE BUG SITUATION! CAN COMMENT OR DELETE LATER!!!
        const debug_distance = (Math.round(sheetMesh.position.distanceTo(currentCoords) * 100000) / 100000).toFixed(5);
        console.log('Possible BUG! ID: ' + ID + ' DISTANCE: ' + debug_distance);
    }

    total_score.innerHTML = 'Total Score: ' + totalScore;
}

function rotateArcher()
{
    spine.rotation.z = mouse.y * 0.5;   // up / down
    spine.rotation.y = -mouse.x * 0.75;  // left / right
    bow.getWorldQuaternion(arrowQuaternion);
}

function updateAnimations(delta) 
{
    if (currentAction != play)
    {
        const toPlay = animationsMap.get(play);
        const current = animationsMap.get(currentAction);

        current.fadeOut(fadeDuration);
        toPlay.reset().fadeIn(fadeDuration).play();

        currentAction = play;
    }

    if (mixer)
    {
        mixer.update(delta);
    }
}

// --- DO ONCE: KAMERAN PALAUTUSFUNKTIO ---
function doCameraDelay() {
    if (cameraResetDone) return; // Suoritetaan VASTA kun lukko on auki
    cameraResetDone = true;      // Lukitaan heti (Do once)
    isFollowingArrow = false;    // Lopetetaan seuranta

    // Siivotaan kuuntelijat ja ajastimet
    if (resetTimeoutId) clearTimeout(resetTimeoutId);
 
    // Palautetaan kamera välittömästi pelaajan taakse
    camera.position.set(cameraOriginalOffset.x, cameraOriginalOffset.y, cameraOriginalOffset.z);
    camera.lookAt(0, 1.5, 0);
    
    const info_text = document.getElementById('info_text');
    info_text.innerHTML = '';
    if (arrows == 0)
    {
        const total_score = document.getElementById('total_score');
        const last_score = document.getElementById('last_score');
        const arrows_left = document.getElementById('arrows_left');
        const button = document.getElementById('new_game_button');
        button.disabled = false;
        button.addEventListener('click', (e) => {            
            info_text.innerHTML = ''
            arrows = originalArrowsCount;
            arrowIndex = 0;
            totalScore = 0;
            total_score.innerHTML = 'Total Score: 0';
            last_score.innerHTML = 'Last Score: 0';
            arrows_left.innerHTML = 'Arrows: ' + originalArrowsCount + ' / ' + originalArrowsCount;
            for (var i = 0; i < arrowMeshes.length; i++)
            {
                scene.remove(arrowMeshes[i]);
            }
            for (var i = 0; i < arrowBodies.length; i++)
            {
                world.removeBody(arrowBodies[i]);
            }
            arrowBodies = [];
            button.disabled = true;
        });
    }
    mouseButton = false;
}
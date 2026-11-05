// Blob shadows: a soft dark disc on the ground under everything that
// stands or lies on it. The maps are lit the way the client lit them, with
// no shadows of their own, and a disc grounds a character on the terrain,
// especially on a slope. One disc goes under an actor's root, so it moves,
// turns and scales with it (a champion's is a third bigger, a pet's small).
import * as THREE from "three";

let geometry: THREE.CircleGeometry | undefined;
let material: THREE.MeshBasicMaterial | undefined;

// A radial fade drawn once: dark in the middle, nothing at the edge
function shadowMaterial(): THREE.MeshBasicMaterial {
    if (!material) {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        fade.addColorStop(0, "rgba(0, 0, 0, 0.55)");
        fade.addColorStop(0.55, "rgba(0, 0, 0, 0.38)");
        fade.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
        material = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(canvas),
            transparent: true,
            depthWrite: false,
            toneMapped: false,
        });
    }
    return material;
}

// A shadow this many tiles across under the root (in the root's own units,
// before its scale), just off the ground so it draws over it
export function addShadow(root: THREE.Object3D, radius: number): THREE.Mesh {
    geometry ??= new THREE.CircleGeometry(1, 24);
    const mesh = new THREE.Mesh(geometry, shadowMaterial());
    mesh.name = "shadow";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    mesh.scale.setScalar(radius);
    mesh.renderOrder = -1;
    root.add(mesh);
    return mesh;
}

// A shadow of its own on the ground, for something that floats (a dropped
// item's icon bobs above it)
export function groundShadow(radius: number): THREE.Mesh {
    geometry ??= new THREE.CircleGeometry(1, 24);
    const mesh = new THREE.Mesh(geometry, shadowMaterial());
    mesh.name = "shadow";
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(radius);
    mesh.renderOrder = -1;
    return mesh;
}

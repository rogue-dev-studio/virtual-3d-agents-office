import * as THREE from "three";

/**
 * Coordinate conventions, all verified against the vendored GLB files.
 *
 * The dataset is authored in plan coordinates `(x, y)`; the building's height
 * axis is `z`, and the exported glTF mapping is `gltf = (x, z, -y)`.
 * three.js uses `y` as up, so:
 *
 *   toThree(x, y, height) = (x, height, -y)
 *
 * Everything in `worldData` stays in plan space; only the loaders below convert.
 * Keeping a single conversion point is what keeps walls, doors, furniture and
 * navigation mutually consistent (ADR-2).
 */

export function toThree(x, y, height = 0, target = new THREE.Vector3()) {
  return target.set(x, height, -y);
}

export function planToVector(x, y, height = 0) {
  return new THREE.Vector3(x, height, -y);
}

export function threeToPlan(vector) {
  return { x: vector.x, y: -vector.z };
}

/**
 * A plan angle of `deg` (counter-clockwise, 0° = +x) becomes a three.js rotation
 * about the up axis of the same magnitude, because the plan→glTF flip of `y`→`-z`
 * maps a CCW plan rotation onto a CW screen rotation about +Y.
 *
 * Verified with `building-L1.glb`: the door leaf for `D-L1-02` is authored at
 * `closedDeg = 90` and its local geometry extends along `-z`, so applying
 * `rotation.y = toRad(angle − closedDeg)` swings it correctly.
 */
export function planRotationToY(deg) {
  return THREE.MathUtils.degToRad(deg);
}

/**
 * A character with dataset facing `facingDeg` (0° = +x, counter-clockwise) must
 * point its local `+Z` (the model's nose) along that azimuth, which is
 * `rotation.y = toRad(facingDeg + 90)`.
 */
export function facingToRotationY(facingDeg) {
  return THREE.MathUtils.degToRad(facingDeg + 90);
}

/** Plan position + rotation + floor elevation as a single matrix. */
export function fixtureMatrix(pos, rot, elevation, target = new THREE.Matrix4()) {
  return target.compose(
    toThree(pos[0], pos[1], elevation),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), planRotationToY(rot)),
    { x: 1, y: 1, z: 1 },
  );
}

export function elevationOf(floorMeta) {
  return floorMeta?.elevation ?? 0;
}

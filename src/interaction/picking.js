import * as THREE from "three";

/**
 * Click resolution. Agents are raycast as real meshes; fixtures and props use the
 * axis-aligned proxies produced while building the world (ADR-5), because the
 * merged/instanced geometry is not cheap to raycast and boxes are precise enough
 * for a well-spaced office.
 */
export class Picker {
  constructor({ camera, agents = [], proxies = [], getActiveFloors = () => null }) {
    this.camera = camera;
    this.agents = agents;
    this.proxies = proxies;
    this.getActiveFloors = getActiveFloors;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hitPoint = new THREE.Vector3();
  }

  setProxies(proxies) {
    this.proxies = proxies;
  }

  /** `ndc` is {x,y} in [-1,1] with y up. Returns the nearest interactive hit or null. */
  pick(ndc) {
    this.pointer.set(ndc.x, ndc.y);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const activeFloors = this.getActiveFloors();

    const agentHit = this.#pickAgent(activeFloors);
    const proxyHit = this.#pickProxy(activeFloors);

    if (agentHit && (!proxyHit || agentHit.distance <= proxyHit.distance)) return agentHit;
    return proxyHit;
  }

  #pickAgent(activeFloors) {
    const roots = this.agents.filter((agent) => agent.visible && (!activeFloors || activeFloors.has(agent.floor)));
    const objects = roots.map((agent) => agent.root);
    if (!objects.length) return null;
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const hit of hits) {
      const id = findAgentId(hit.object);
      if (id) return { type: "agent", id, distance: hit.distance, point: hit.point.clone() };
    }
    return null;
  }

  #pickProxy(activeFloors) {
    let best = null;
    for (const proxy of this.proxies) {
      if (proxy.interactive === false) continue;
      if (activeFloors && !activeFloors.has(proxy.floor)) continue;
      if (!this.raycaster.ray.intersectBox(proxy.box, this.hitPoint)) continue;
      const distance = this.raycaster.ray.origin.distanceTo(this.hitPoint);
      if (!best || distance < best.distance) {
        best = {
          type: proxy.kind === "prop" ? "prop" : "fixture",
          id: proxy.id,
          label: proxy.label,
          room: proxy.room,
          floor: proxy.floor,
          distance,
          point: this.hitPoint.clone(),
        };
      }
    }
    return best;
  }
}

function findAgentId(object) {
  let node = object;
  while (node) {
    if (node.userData?.agentId) return node.userData.agentId;
    node = node.parent;
  }
  return null;
}

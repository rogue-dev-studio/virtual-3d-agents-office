export const FLOOR_META = {
  L1: { id: "L1", name: "Ground floor", elevation: 0 },
  L2: { id: "L2", name: "Upper floor", elevation: 4 },
};

export const ROOM_META = {
  "L1-MEET": { name: "Meeting Room A", division: "management", kind: "meeting" },
  "L1-LOBBY": { name: "Lobby & Reception", division: "management", kind: "lobby" },
  "L1-GALLERY": { name: "Design Studio & Showcase", division: "design", kind: "showcase" },
  "L1-PANTRY": { name: "Pantry & Coffee", division: "management", kind: "pantry" },
  "L1-SHAFT-W": { name: "Service Shaft", division: "engineering", kind: "service" },
  "L1-WC": { name: "Restrooms", division: "management", kind: "restroom" },
  "L1-CORR": { name: "Main Corridor", division: "management", kind: "circulation" },
  "L1-DISC": { name: "Product Room", division: "analysis", kind: "work" },
  "L1-IMPL": { name: "Engineering Workspace", division: "engineering", kind: "work" },
  "L1-CORE": { name: "Stairs & Lift", division: "management", kind: "circulation" },
  "L1-NOVA": { name: "Research Lab", division: "analysis", kind: "work" },
  "L1-LAB": { name: "QA Lab", division: "quality", kind: "work" },
  "L1-NCORR": { name: "North Corridor", division: "management", kind: "circulation" },
  "L1-CEO": { name: "CEO Office", division: "management", kind: "office" },
  "L1-HUGO": { name: "Architecture Studio", division: "analysis", kind: "work" },
  "L1-KEVIN": { name: "Design Pod", division: "design", kind: "work" },
  "L1-BRUNO": { name: "Backend Pod", division: "engineering", kind: "work" },
  "L1-SERVER": { name: "Server Room", division: "engineering", kind: "restricted" },
  "L1-STORE": { name: "Storage & Utilities", division: "engineering", kind: "service" },

  "L2-READ": { name: "Library / Focus Area", division: "documentation", kind: "quiet" },
  "L2-LOUNGE": { name: "Lounge & Coffee Bar", division: "management", kind: "recreation" },
  "L2-DINE": { name: "Dining & Break Room", division: "management", kind: "recreation" },
  "L2-SHOWER": { name: "Showers & Lockers", division: "management", kind: "restroom" },
  "L2-SHAFT-W": { name: "Service Shaft", division: "engineering", kind: "service" },
  "L2-WC": { name: "Restrooms", division: "management", kind: "restroom" },
  "L2-CORR": { name: "Main Corridor", division: "management", kind: "circulation" },
  "L2-CHAT": { name: "War Room", division: "management", kind: "meeting" },
  "L2-GARDEN": { name: "Indoor Garden", division: "management", kind: "recreation" },
  "L2-CORE": { name: "Stairs & Lift", division: "management", kind: "circulation" },
  "L2-GAME": { name: "Playtest Lab", division: "design", kind: "recreation" },
  "L2-NCORR": { name: "North Corridor", division: "management", kind: "circulation" },
  "L2-BALCONY": { name: "Terrace", division: "management", kind: "outdoor" },
  "L2-BILLIARD": { name: "Focus Pods", division: "engineering", kind: "quiet" },
  "L2-GYM": { name: "Training & Workshop Room", division: "documentation", kind: "training" },
  "L2-STORE": { name: "Storage", division: "engineering", kind: "service" },
  "L2-SERVICE": { name: "Service Area", division: "engineering", kind: "service" },
};

export function roomMeta(id) {
  return ROOM_META[id] ?? { name: id, division: "management", kind: "room" };
}

export function roomName(id) {
  return roomMeta(id).name;
}

export function roomDivision(id) {
  return roomMeta(id).division;
}

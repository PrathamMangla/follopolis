// Every job a follower comments is sorted into one of these buildings.
// Add words to `words` to send more jobs to a building. Anything unknown goes to the Workshop.
window.JOB_TYPES = [
  { id: "bakery",     label: "Bakery",         emoji: "🥐", words: ["baker", "bread", "pastry", "cake", "donut", "cookie"] },
  { id: "fire",       label: "Fire Station",   emoji: "🚒", words: ["fire", "rescue", "lifeguard"] },
  { id: "tower",      label: "Wizard Tower",   emoji: "🧙", words: ["wizard", "witch", "mage", "magic", "sorcer", "alchemist", "fortune"] },
  { id: "harbour",    label: "Harbour",        emoji: "⚓", words: ["fish", "sailor", "pirate", "captain", "boat", "sea", "mermaid", "surf"] },
  { id: "farm",       label: "Farm",           emoji: "🌾", words: ["farm", "garden", "cow", "shepherd", "plant", "bee", "flower"] },
  { id: "hospital",   label: "Hospital",       emoji: "🏥", words: ["doctor", "nurse", "surgeon", "medic", "vet", "dentist", "therap"] },
  { id: "rocket",     label: "Launch Pad",     emoji: "🚀", words: ["astronaut", "space", "rocket", "alien", "scien", "engineer", "inventor"] },
  { id: "haunted",    label: "Haunted House",  emoji: "👻", words: ["ghost", "vampire", "zombie", "spook", "demon", "necro", "grave"] },
  { id: "castle",     label: "Castle",         emoji: "👑", words: ["king", "queen", "prince", "royal", "knight", "guard", "mayor", "lord", "duke"] },
  { id: "restaurant", label: "Restaurant",     emoji: "🍜", words: ["chef", "cook", "waiter", "pizza", "sushi", "chai", "coffee", "barista", "food", "burger"] },
  { id: "school",     label: "School",         emoji: "📚", words: ["teacher", "student", "professor", "librar", "writer", "author", "poet", "tutor"] },
  { id: "police",     label: "Police Station", emoji: "🚓", words: ["police", "cop", "detective", "sheriff", "spy", "agent", "judge", "lawyer"] },
  { id: "dragon",     label: "Dragon Lair",    emoji: "🐉", words: ["dragon"] },
  { id: "stage",      label: "Music Stage",    emoji: "🎸", words: ["music", "singer", "dj", "guitar", "rapper", "artist", "dancer", "actor", "painter", "streamer", "gamer", "youtuber", "influencer"] },
  { id: "workshop",   label: "Workshop",       emoji: "🔨", words: [] },
];

// Only one citizen can hold each of these. The first person to comment it gets it.
window.RARE_JOBS = ["king", "queen", "wizard", "dragon tamer", "mayor"];

window.jobType = function (job) {
  if (!job) return null;
  // Words match at the start of a word, so "baking" doesn't count as "king".
  const words = job.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const t of window.JOB_TYPES) if (t.words.some(w => words.some(x => x.startsWith(w)))) return t;
  return window.JOB_TYPES[window.JOB_TYPES.length - 1];
};

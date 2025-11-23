export const generateFunnyEventName = (): string => {
  const adjectives = [
    "Slicey", "Hooky", "Chunked", "Shanked", "Duffed", "Whiffed", "Mulligan", "Gimme", 
    "Sandbagging", "Bogey", "Double-Crossed", "Lip-Out", "Fried-Egg", "Water-Logged", 
    "Out-of-Bounds", "Lost-Ball", "Three-Putt", "Four-Putt", "Yippy", "Chili-Dipped",
    "Skull-Rocket", "Worm-Burning", "Hosel-Rocket", "Cart-Path", "Unplayable", "Provisional"
  ];
  
  const nouns = [
    "Scramble", "Shambles", "Shootout", "Showdown", "Invitational", "Open", "Classic", 
    "Masters", "Championship", "Cup", "Challenge", "Tour", "Circuit", "Links", "Fairway", 
    "Green", "Bunker", "Hazard", "Rough", "Divot", "Tee-Box", "Flagstick", "Pin-Seeker",
    "Birdie-Fest", "Par-Party", "Bogey-Bash", "Hack-Attack", "Duff-Derby"
  ];

  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `The ${randomAdjective} ${randomNoun}`;
};

import { MoodScore } from './components/MoodChoices';

export interface MoodHook {
  text: string;
  quickReplies: string[];
}

const LOW_MOOD_HOOKS: MoodHook[] = [
  {
    text: "I hear you, and it’s okay to have days where things feel heavy. Did you know sea otters hold hands when they sleep so they don't drift away with the ocean currents? Nature has quiet ways of keeping things safe. What’s one little thing that brought you even a tiny bit of comfort today?",
    quickReplies: ["A warm cup of tea", "A favorite song", "Taking a deep breath", "Not much yet"],
  },
  {
    text: "Thank you for sharing that with me. You know that scent of fresh rain on dry earth called 'petrichor'? Plants release gentle natural oils into the soil, and humans can detect it even better than sharks detect scent in water. Do you find rainy days soothing, or do you prefer sunshine?",
    quickReplies: ["I love cozy rain", "Give me warm sunshine", "Gloomy weather is nice", "I like stargazing"],
  },
  {
    text: "I’m right here beside you. A comforting thought: trees in an old forest are connected by underground roots, and when one tree is struggling, neighboring trees share nutrients through the soil to help it through. What’s something small you can do just for yourself right now?",
    quickReplies: ["Rest my eyes", "Drink some water", "Stretch for a minute", "Just sit quietly"],
  },
];

const NEUTRAL_MOOD_HOOKS: MoodHook[] = [
  {
    text: "A steady, quiet kind of day. You know what's wild? Honey never spoils. Archeologists found 3,000-year-old pots of honey in ancient Egyptian tombs that are still completely edible! If you had a time machine for an afternoon, which era would you visit?",
    quickReplies: ["Ancient Egypt", "The 1970s / 80s", "100 years into the future", "Right here is good"],
  },
  {
    text: "Taking things as they come. Here’s a fun fact: dolphins and sea lions actually laugh when they play! Scientists found they make ultrasonic joyful whistles when having fun. What was the last thing that made you smile or laugh?",
    quickReplies: ["A hilarious meme", "A silly pet moment", "A conversation with a friend", "A movie or show"],
  },
  {
    text: "A calm middle ground. Here’s a mind-bender: there are more possible iterations of a standard game of chess than there are atoms in the observable universe. Do you lean more towards being strategic or spontaneous?",
    quickReplies: ["Definitely spontaneous", "Always strategic", "Calculated chaos", "Depends on the day"],
  },
];

const HIGH_MOOD_HOOKS: MoodHook[] = [
  {
    text: "I love that energy for you! Did you know hummingbirds have such remarkable memories that they remember every single flower they've ever visited and how long it takes to refill with nectar? What’s something satisfying or fun that happened today?",
    quickReplies: ["Finished something big", "Good news arrived", "Great coffee/food", "Just felt peaceful"],
  },
  {
    text: "That brightens up my whole day! When astronauts look down at Earth from orbit, they experience the 'Overview Effect'—a sudden rush of awe and wonder seeing our blue planet. What’s a place in nature that always takes your breath away?",
    quickReplies: ["Mighty mountains", "The rolling ocean", "A deep green forest", "My own cozy room"],
  },
  {
    text: "Love to see that spark! Whales actually compose intricate songs with catchy melodies that spread across whole ocean pods like trending music hits. What song or music matches your vibe right now?",
    quickReplies: ["Upbeat & energetic", "Chill acoustic lo-fi", "Dreamy synthpop", "Heavy bass / rock"],
  },
];

export function getMoodConversationHook(score: MoodScore): MoodHook {
  let pool = NEUTRAL_MOOD_HOOKS;
  if (score <= 2) {
    pool = LOW_MOOD_HOOKS;
  } else if (score >= 4) {
    pool = HIGH_MOOD_HOOKS;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

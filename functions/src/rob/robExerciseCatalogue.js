export const ROB_CATALOGUE_VERSION = 1;
const rows = [
["wger-73","Bench Press",["Barbell","Bench"],"Chest"],["wger-76","Bench Press Narrow Grip",["Barbell","Bench"],"Triceps"],
["wger-145","Cable Woodchoppers",["Cable"],"Abs"],["wger-148","Calf Raises on Hackenschmitt Machine",["Machine"],"Calves"],
["wger-237","Fly With Cable",["Cable"],"Chest"],["wger-371","Leg Press",["Machine"],"Quads"],
["wger-458","Plank",["Bodyweight"],"Abs"],["wger-475","Pull-ups",["Pull-up bar"],"Back"],
["wger-530","Run - Treadmill",["Treadmill"],"Legs"],["wger-538","Incline Bench Press - Barbell",["Barbell","Bench"],"Chest"],
["wger-567","Shoulder Press, Dumbbells",["Dumbbell"],"Shoulders"],["wger-577","Side Dumbbell Trunk Flexion",["Dumbbell"],"Abs"],
["wger-723","Wide-grip Pulldown",["Cable"],"Back"],["wger-822","Cable Rear Delt Fly",["Cable"],"Shoulders"],
["wger-1088","Dumbbell sumo deadlift",["Dumbbell"],"Legs"],["wger-1193","Russian Twist",["Dumbbell"],"Abs"],
["wger-1370","Dumbbell Deadlift",["Dumbbell"],"Legs"],["wger-1466","Calf Raise using Hack Squat Machine",["Machine"],"Calves"],
["wger-1690","Cable Fly Upper Chest",["Cable"],"Chest"],["wger-1691","Cable Fly Lower Chest",["Cable"],"Chest"],
["wger-1695","Pull-Ups",["Bodyweight"],"Back"],["wger-1801","Barbell Full Squat",["Barbell"],"Legs"],
["wger-2626","Machine Seated Leg Curl",["Machine"],"Hamstrings"],["wger-2628","Machine Seated Calf Raise",["Machine"],"Calves"],
["wger-2669","Bent Over Dumbbell Rows",["Dumbbell"],"Back"],
["wger-500","Reverse Plank",["Bodyweight"],"Abs"],["wger-580","Side Plank",["Bodyweight"],"Abs"],
["wger-1001","High plank",["Bodyweight"],"Abs"],["wger-1288","Dynamic side plank",["Bodyweight"],"Abs"],
["wger-1307","Front Plank",["Bodyweight"],"Abs"],["wger-1406","Plank-to-Elbow Extension",["Bodyweight"],"Abs"],
["wger-1410","Plank with Alternating Leg Lift",["Bodyweight"],"Abs"],["wger-1489","Plank Jacks",["Bodyweight"],"Abs"],
["wger-1766","Plank Reach",["Bodyweight"],"Abs"],["wger-1911","Cat Plank",["Bodyweight"],"Abs"],
];
export const SERVER_CATALOGUE = new Map(rows.map(([id,name,equipment,primaryMuscle]) => [id,{ id, name, equipment, primaryMuscle, source:"wger" }]));
export function authorizeRobCatalogue(version, ids) {
  if (version !== ROB_CATALOGUE_VERSION || !Array.isArray(ids) || !ids.length || ids.length > 32 || new Set(ids).size !== ids.length) return null;
  const entries = ids.map((id) => SERVER_CATALOGUE.get(id));
  return entries.every(Boolean) ? entries : null;
}

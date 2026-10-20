import { MUSCLE_GROUPS } from "../services/muscleWorkload";
import { getBodyMapIntensity, getBodyMapRegionValue } from "../services/muscleBodyMap";

// Each path is an original, schematic region. Coordinates are mirrored around x=70.
const front = [
  ["shoulders", "M49 48 Q39 47 34 60 L31 76 L45 80 L52 65 Z", true],
  ["chest", "M52 52 Q62 58 69 57 L69 81 Q58 84 48 77 Z", true],
  ["biceps", "M32 78 L45 82 L42 103 L29 101 Z", true],
  ["triceps", "M28 82 L32 78 L29 101 L25 104 Z", true],
  ["forearms", "M25 106 L41 108 L36 139 L25 135 Z", true],
  ["core", "M51 84 Q60 88 69 86 L69 132 L51 129 Z", true],
  ["back", "M47 80 L51 84 L50 115 L45 112 Z", true],
  ["hip_adductors", "M58 143 L69 142 L67 185 L61 178 Z", true],
  ["hip_abductors", "M45 136 L54 141 L51 164 L43 158 Z", true],
  ["quadriceps", "M44 160 L59 163 L62 207 L48 208 Z", true],
  ["hamstrings", "M42 164 L45 162 L47 207 L43 206 Z", true],
  ["calves", "M47 215 L61 214 L59 254 L50 255 Z", true],
];
const back = [
  ["shoulders", "M49 48 Q38 48 34 59 L32 75 L46 80 L53 64 Z", true],
  ["back", "M52 54 L68 61 L68 126 L49 119 L46 78 Z", true],
  ["triceps", "M31 78 L45 82 L42 106 L28 103 Z", true],
  ["biceps", "M28 82 L31 79 L28 104 L25 106 Z", true],
  ["forearms", "M25 107 L41 110 L36 139 L25 135 Z", true],
  ["core", "M49 121 L68 128 L68 139 L53 137 Z", true],
  ["hip_abductors", "M45 137 L52 140 L48 161 L42 159 Z", true],
  ["glutes", "M53 140 L68 141 L68 166 Q56 170 48 163 Z", true],
  ["hip_adductors", "M62 169 L68 168 L67 185 L62 183 Z", true],
  ["hamstrings", "M44 168 L61 169 L60 209 L47 209 Z", true],
  ["quadriceps", "M42 168 L44 168 L47 209 L43 207 Z", true],
  ["calves", "M48 215 L61 214 L59 254 L50 255 Z", true],
];

const regionFill = ["#1e293b", "#8db7db", "#43b8bd", "#0bd3a4"];
const names = new Map(MUSCLE_GROUPS);

export default function MuscleBodyMap({ orientation, values, selectedId, onSelect, compact = false }) {
  const regions = orientation === "back" ? back : front;
  const max = Math.max(0, ...Object.values(values ?? {}));
  return <svg viewBox="0 0 140 282" role="group" aria-label={`${orientation === "back" ? "Back" : "Front"} muscle workload map`}
    className={`h-auto min-w-0 w-1/2 ${compact ? "max-w-28" : "max-w-48"}`}>
    <title>{orientation === "back" ? "Back" : "Front"} muscle workload map</title>
    <g fill="#152238" stroke="#43556c" strokeWidth="1.5">
      <ellipse cx="70" cy="25" rx="16" ry="20" />
      <path d="M51 49 Q43 48 35 57 L24 103 L21 134 L29 144 L39 136 L43 107 L46 164 L44 208 L49 261 L59 268 L69 257 L70 191 L71 257 L81 268 L91 261 L96 208 L94 164 L97 107 L101 136 L111 144 L119 134 L116 103 L105 57 Q97 48 89 49 Z" />
    </g>
    {regions.flatMap(([id, path, mirror]) => [
      [id, path, false], ...(mirror ? [[id, path, true]] : []),
    ]).map(([id, path, reflected], index) => {
      const value = getBodyMapRegionValue(id, values);
      return <path key={`${id}-${index}`} d={path} transform={reflected ? "translate(140 0) scale(-1 1)" : undefined}
        fill={regionFill[getBodyMapIntensity(value, max)]}
        stroke={selectedId === id ? "#fff" : "#0a172a"} strokeWidth={selectedId === id ? 2.5 : 1.5}
        strokeLinejoin="round" strokeLinecap="round"
        className={onSelect ? "cursor-pointer outline-none hover:opacity-80" : ""}
        role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? `${names.get(id)}: ${value} weighted sets` : undefined}
        aria-pressed={onSelect ? selectedId === id : undefined}
        onClick={onSelect ? () => onSelect(id) : undefined}
        onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(id); } } : undefined}
      />;
    })}
    <text x="70" y="278" textAnchor="middle" fill="#94a3b8" fontSize="10">{orientation === "back" ? "BACK" : "FRONT"}</text>
  </svg>;
}

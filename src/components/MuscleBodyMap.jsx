import { MUSCLE_GROUPS } from "../services/muscleWorkload";
import { getBodyMapIntensity, getBodyMapRegionValue } from "../services/muscleBodyMap";

// Original stylised anatomy. One side is reflected about x=70 for exact symmetry.
const front = [
  ["shoulders", "M50 51 C40 51 31 57 29 67 C28 74 31 80 39 83 C44 79 45 66 52 55 Z", true],
  ["chest", "M52 56 C57 59 62 61 69 60 L69 84 C60 86 51 82 47 76 C47 67 49 61 52 56 Z", true],
  ["biceps", "M29 76 C27 84 25 92 26 99 C29 102 33 102 37 100 L41 81 C37 83 32 81 29 76 Z", true],
  ["triceps", "M41 81 C45 88 43 99 39 107 L35 102 C39 95 39 87 41 81 Z", true],
  ["forearms", "M26 103 C23 112 21 122 19 131 Q22 135 28 135 C32 125 35 113 37 104 C33 106 29 106 26 103 Z", true],
  ["core", "M48 83 C54 87 61 89 69 88 L69 134 C61 134 54 131 49 126 C46 111 46 97 48 83 Z", true],
  ["back", "M43 79 L48 82 C46 95 47 110 49 125 C44 120 42 107 42 95 Z", true],
  ["hip_adductors", "M59 147 C62 145 66 145 69 146 L69 179 C66 183 63 185 61 181 C60 171 58 157 59 147 Z", true],
  ["hip_abductors", "M49 134 C44 139 43 148 44 157 L48 168 C53 162 56 152 57 140 Z", true],
  ["quadriceps", "M44 163 C49 160 55 162 59 166 C61 180 61 195 60 208 L49 209 C46 196 44 180 44 163 Z", true],
  ["hamstrings", "M43 165 L46 164 C45 180 47 196 49 209 L45 207 C43 193 42 178 43 165 Z", true],
  ["calves", "M49 215 C53 218 58 217 61 213 C62 227 60 241 58 256 L51 257 C49 243 47 228 49 215 Z", true],
];
const back = [
  ["shoulders", "M50 51 C40 51 31 57 29 67 C28 74 31 80 39 83 C44 79 46 66 52 55 Z", true],
  ["back", "M52 56 C58 61 63 63 69 65 L69 126 C60 123 52 121 48 117 C45 102 43 88 43 78 C48 70 49 62 52 56 Z", true],
  ["triceps", "M30 76 C34 81 38 83 42 81 C43 88 41 101 38 106 C32 106 28 103 26 99 C25 92 27 83 30 76 Z", true],
  ["biceps", "M28 79 L31 79 C28 87 27 96 27 103 L24 105 C23 95 25 86 28 79 Z", true],
  ["forearms", "M26 104 C30 107 34 108 38 106 C36 116 32 128 28 136 Q22 135 19 131 C21 122 23 112 26 104 Z", true],
  ["core", "M48 119 C54 124 61 127 69 129 L69 139 C62 140 54 138 50 135 Z", true],
  ["hip_abductors", "M48 137 C45 142 43 149 44 159 L49 167 L54 141 Z", true],
  ["glutes", "M53 141 C58 139 64 139 69 141 L69 164 C62 170 54 169 48 162 C48 152 50 146 53 141 Z", true],
  ["hip_adductors", "M62 170 C64 171 67 171 69 168 L69 184 C66 186 63 185 62 182 Z", true],
  ["hamstrings", "M45 168 C50 170 56 171 61 168 C62 182 61 198 60 209 L49 209 C46 197 45 182 45 168 Z", true],
  ["quadriceps", "M43 167 L46 169 C45 181 47 197 49 209 L45 207 C43 194 42 180 43 167 Z", true],
  ["calves", "M49 215 C53 219 58 218 61 213 C62 227 60 242 58 256 L51 257 C49 244 47 228 49 215 Z", true],
];

const regionFill = ["#1e293b", "#8db7db", "#43b8bd", "#0bd3a4"];
const names = new Map(MUSCLE_GROUPS);

export default function MuscleBodyMap({ orientation, values, selectedId, onSelect, compact = false }) {
  const regions = orientation === "back" ? back : front;
  const max = Math.max(0, ...Object.values(values ?? {}));
  return <svg viewBox="0 0 140 300" role="group" aria-label={`${orientation === "back" ? "Back" : "Front"} muscle workload map`}
    className={`h-auto min-w-0 w-1/2 ${compact ? "max-w-28" : "max-w-48"}`}>
    <title>{orientation === "back" ? "Back" : "Front"} muscle workload map</title>
    <g fill="#152238" stroke="#43556c" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M70 5 C59 5 54 14 54 25 C54 34 58 41 63 44 Q70 49 77 44 C82 41 86 34 86 25 C86 14 81 5 70 5 Z" />
      <path d="M60 44 C55 50 45 50 38 54 C29 58 27 67 25 76 L17 118 Q15 128 20 132 L22 135 L20 142 Q19 148 24 150 Q28 151 31 145 L36 134 Q38 130 36 125 L40 99 L43 88 Q44 108 46 125 Q48 133 47 141 Q42 153 43 166 L46 206 Q48 216 47 228 L50 259 Q51 269 57 270 L63 270 Q68 268 69 261 L70 213 L71 261 Q72 268 77 270 L83 270 Q89 269 90 259 L93 228 Q92 216 94 206 L97 166 Q98 153 93 141 Q92 133 94 125 Q96 108 97 88 L100 99 L104 125 Q102 130 104 134 L109 145 Q112 151 116 150 Q121 148 120 142 L118 135 L120 132 Q125 128 123 118 L115 76 C113 67 111 58 102 54 C95 50 85 50 80 44 Q70 52 60 44 Z" />
      <path d="M51 255 Q50 265 43 270 Q41 273 45 275 L62 275 Q69 274 69 268 L64 260 Z" />
      <path d="M89 255 Q90 265 97 270 Q99 273 95 275 L78 275 Q71 274 71 268 L76 260 Z" />
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
        data-region-id={id} data-side={reflected ? "right" : "left"}
        role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? `${orientation} ${names.get(id)}, ${reflected ? "right" : "left"} side: ${value} weighted sets` : undefined}
        aria-pressed={onSelect ? selectedId === id : undefined}
        onClick={onSelect ? () => onSelect(id) : undefined}
        onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(id); } } : undefined}
      />;
    })}
    <g fill="none" stroke="#122033" strokeWidth="1.1" opacity="0.7" pointerEvents="none">
      {orientation === "front" ? <>
        <path d="M54 94 Q61 97 69 96 M53 107 Q61 110 69 109 M54 120 Q61 123 69 122 M70 86 L70 133" />
        <path d="M86 94 Q79 97 71 96 M87 107 Q79 110 71 109 M86 120 Q79 123 71 122" />
      </> : <>
        <path d="M54 65 Q61 73 69 74 M86 65 Q79 73 71 74 M52 104 Q60 113 69 115 M88 104 Q80 113 71 115" />
      </>}
    </g>
    <text x="70" y="291" textAnchor="middle" fill="#94a3b8" fontSize="10">{orientation === "back" ? "BACK" : "FRONT"}</text>
  </svg>;
}

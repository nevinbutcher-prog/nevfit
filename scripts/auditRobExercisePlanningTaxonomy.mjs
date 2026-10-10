import catalogue from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { auditRobExercisePlanningTaxonomy } from "../src/services/rob/robExercisePlanningTaxonomy.js";

console.log(JSON.stringify(auditRobExercisePlanningTaxonomy(catalogue), null, 2));

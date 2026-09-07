// GymPlus+ Coach — program management module barrel
// Coach dashboard pages render <ProgramWorkspace kind="workout"|"nutrition"/>.

export { ProgramWorkspace } from "./components/ProgramWorkspace";
export { ProgramBuilder } from "./components/ProgramBuilder";
export { ProgramList } from "./components/ProgramList";
export { ProgramCard } from "./components/ProgramCard";
export { ProgramSettings } from "./components/ProgramSettings";
export { ProgramBank } from "./components/ProgramBank";
export { NutritionFoodBank } from "./components/NutritionFoodBank";
export { useProgramData } from "./hooks/useProgramData";

export type {
  ProgramDomain,
  PlanMode,
  ProgramDraft,
  ProgramDay,
  ProgramMeal,
  ProgramExercise,
  ProgramFoodItem,
  RefItem,
  UnitRefItem,
  ExecUnitItem,
  BankItem,
  StructureItem,
} from "./program.types";
export { MODE_LABEL, MODE_OPTIONS, DEFAULT_REFERENCE } from "./program.types";

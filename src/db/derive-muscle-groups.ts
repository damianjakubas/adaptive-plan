/**
 * Distinct, non-null muscle groups across a session's exercises, in stable
 * order. The caller must pass exercises already sorted by `position` (the SQL
 * read does this) so the result reflects exercise order deterministically.
 *
 * Powers `listSessions`' derived `muscleGroups` — the history list shows what a
 * session targeted without loading the (heavier) per-set rows.
 */
function deriveMuscleGroups(exercises: MuscleGroupSource[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const exercise of exercises) {
    if (exercise.muscleGroup && !seen.has(exercise.muscleGroup)) {
      seen.add(exercise.muscleGroup);
      ordered.push(exercise.muscleGroup);
    }
  }
  return ordered;
}

interface MuscleGroupSource {
  muscleGroup: string | null;
}

export { type MuscleGroupSource };
export default deriveMuscleGroups;

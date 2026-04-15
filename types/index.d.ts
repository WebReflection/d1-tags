import type { DB } from './internal';
import type { D1Tags } from './augmented';

/** Default export of `index.js`: given a D1 binding, returns the tagged-SQL API (cached per `DB`). */
export default function d1Tags(DB: DB): D1Tags;

export type {
  DB,
  PreparedStatement,
  Cache,
  Result,
  ExecResult,
} from './internal';
export type {
  D1FirstRow,
  D1FirstCurried,
  D1RawRows,
  D1RawRowsWithNames,
  AugmentedFirst,
  AugmentedRaw,
  AugmentedFactory,
  D1Tags,
} from './augmented';

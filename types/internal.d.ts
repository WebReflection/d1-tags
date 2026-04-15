import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

export type DB = D1Database;
export type PreparedStatement = D1PreparedStatement;
export type Cache = WeakMap<TemplateStringsArray, PreparedStatement>;
export type Result = Promise<D1Result<Record<string, unknown>>>;
export type ExecResult = Promise<D1ExecResult>;

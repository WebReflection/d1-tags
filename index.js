// @ts-check

const { isArray, prototype } = Array;
const { isFrozen } = Object;
const str = String;

/**
 * Escape a field within `'${field}'` single quotes.
 * Usable to pass directly strings within the `exec` utility,
 * without needing to use quotes around them.
 * @param {unknown} field
 * @returns {string}
 */
const escape = field => `'${str(field).replace(/'/g, "''")}'`;

/** @typedef {import('./types/index.js').DB} DB */
/** @typedef {import('./types/index.js').PreparedStatement} PreparedStatement */
/** @typedef {import('./types/index.js').Cache} Cache */
/** @typedef {import('./types/index.js').Result} Result */
/** @typedef {import('./types/index.js').ExecResult} ExecResult */

/**
 * 
 * @param {Cache} wm
 * @param {TemplateStringsArray} template
 * @param {DB} DB
 * @returns {PreparedStatement}
 */
const get = (wm, template, DB) => {
    let stmt = wm.get(template);
    if (!stmt) wm.set(template, (stmt = DB.prepare(template.join('?'))));
    return stmt;
};

/**
 * @param {TemplateStringsArray} template
 * @param {unknown[]} fields
 */
const guard = (template, { length }) => {
  if (!(isArray(template) && isFrozen(template) && (template.length - 1) === length))
    throw new SyntaxError('Invalid template: ' + str(template));
};

const handler = {
  /**
   * @param {ReadonlyArray<Record<string | symbol, unknown>>} list
   * @param {string | symbol} prop
   * @returns {unknown[]}
   */
  get: (list, prop) => list.map(item => item[prop]),
};

/**
 * @template {Record<string, unknown>} T
 * @param {readonly T[]} list
 * @returns {import('./types/index.js').MappedList<T>}
 */
const map = list => /** @type {import('./types/index.js').MappedList<T>} */ (new Proxy(list, handler));

/** @type {WeakMap<DB, import('./types/index.js').D1Tags>} */
const dbs = new WeakMap;

/**
 * @param {DB} DB
 * @returns {import('./types/index.js').D1Tags}
 */
export default DB => {
  let db = dbs.get(DB);
  if (!db) {
    /** @type {Cache} */
    const wm = new WeakMap;

    /**
     * @param {'first' | 'raw'} name
     * @returns {(this: unknown[], template: TemplateStringsArray, ...fields: unknown[]) => Promise<import('./types/index.js').D1FirstCurried | import('./types/index.js').D1RawRows | import('./types/index.js').D1RawRowsWithNames>}
     */
    const action = name => function (template, ...fields) {
      guard(template, fields);
      // @ts-ignore
      return get(wm, template, DB).bind(...fields)[name](...this);
    };

    /**
     * Runtime behavior matches `AugmentedFactory`; RHS widened with `any` for the implementation.
     * @type {import('./types/index.js').AugmentedFactory}
     */
    const augmented = /** @type {any} */ (
      /**
       * @param {'first' | 'raw'} name
       */
      function augmentedInner(name) {
        const fn = action(name);
        /**
         * Shared implementation; overloads live on `AugmentedFactory` / `AugmentedFirst` / `AugmentedRaw`.
         * @param {TemplateStringsArray | unknown} template
         * @param {...unknown} fields
         */
        const tag = (template, ...fields) => (
          fields.length === 0 && !isArray(template) ?
            fn.bind([template]) :
            fn.call(prototype, /** @type {TemplateStringsArray} */ (template), ...fields)
        );
        return tag;
      }
    );

    /**
     * @param {TemplateStringsArray} template
     * @param {...unknown} fields
     */
    const batch = (template, ...fields) => {
      guard(template, fields);
      return DB.batch(fields.map(batched, get(wm, template, DB)));
    };

    /**
     * @param {TemplateStringsArray} template
     * @param {unknown[]} fields
     * @returns {ExecResult}
     */
    const exec = (template, ...fields) => {
      guard(template, fields);
      // this might be a good or bad idea ... escaped backticks
      // might mislead though, so for now it's considered a bad idea
      // return DB.exec(str.raw(template, ...fields));
      let sql = template[0];
      for (let i = 0; i < fields.length; i++)
        sql += str(fields[i]) + template[i + 1];
      return DB.exec(sql);
    };

    const first = augmented('first');

    const raw = augmented('raw');

    /**
     * @param {TemplateStringsArray} template
     * @param {unknown[]} fields
     * @returns {Result}
     */
    const run = (template, ...fields) => {
      guard(template, fields);
      return get(wm, template, DB).bind(...fields).run();
    };

    db = { batch, escape, exec, first, map, raw, run };
    dbs.set(DB, db);
  }
  return db;
};

/**
 * @this {PreparedStatement}
 * @param {unknown} _ one column array from `batch`’s `fields` (`fields.map` callback element)
 * @param {number} index row index (batch row)
 * @param {unknown[]} array all column arrays passed to `batch` (same as `fields`)
 * @returns {PreparedStatement}
 */
function batched(_, index, array) {
  const fields = [];
  for (let field, i = 0; i < array.length; i++) {
    field = array[i];
    if (!isArray(field) || field.length <= index)
      throw new SyntaxError('Invalid batch: ' + str(field));
    fields.push(field[index]);
  }
  return this.bind(...fields);
}

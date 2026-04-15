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
        // // Cursor told me not to do this ... and convinced me!
        // const field = fields[i];
        // const next = template[i + 1];
        // let value = field;
        // if (typeof field === 'string' && !(/(['"])$/.test(template[i]) && new RegExp(`^${re.$1}`).test(next)))
        //   value = `'${field.replace(/'/g, "''")}'`;
        // sql.push(value, next);
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

    dbs.set(DB, (db = { batch, escape, exec, first, raw, run }));
  }
  return db;
};

/**
 * @this {PreparedStatement}
 * @param {unknown} fields one bound row (`unknown[]`); typed as `unknown` because `map` passes `unknown`
 * @returns {PreparedStatement}
 */
function batched(fields) {
  if (!isArray(fields))
    throw new SyntaxError('Invalid batch: ' + str(fields));
  return this.bind(.../** @type {unknown[]} */ (fields));
}

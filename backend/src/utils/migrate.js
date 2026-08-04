// beacon2026/backend/src/utils/migrate.js
// Runs database migrations and seeds automatically on startup.
// This means you never need shell access to set up the database.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { prisma } from './db.js';
import { tenantQuery } from './db.js';
import { hashPassword } from './password.js';
import { PRIVILEGE_RESOURCES } from '../seed/privilegeResources.js';
import { DEFAULT_ROLES } from '../seed/defaultRoles.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrateAndSeed() {
  // 1. Run Prisma migrations (creates system-level tables if they don't exist)
  logger.info('Pushing database schema...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    logger.info('Schema push complete.');
  } catch (err) {
    logger.error('Migration failed', { message: err.message });
    throw err;
  }

  // 2. Seed the system admin if one doesn't exist yet.
  //    SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required — we refuse to
  //    create an admin account with a hardcoded fallback password.
  const existing = await prisma.sysAdmin.findFirst();
  if (!existing) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    const name = process.env.SEED_ADMIN_NAME ?? 'System Administrator';

    if (!email || !password) {
      throw new Error(
        'No system administrator exists and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set. ' +
          'Set both environment variables before starting the server.',
      );
    }

    const passwordHash = await hashPassword(password);
    await prisma.sysAdmin.create({ data: { email, name, passwordHash, active: true } });

    logger.info(
      '✓ System administrator created (set via SEED_ADMIN env vars). ' +
        'IMPORTANT: change this password immediately after first login.',
    );
  }

  // 3. One-time bootstrap of the default standard email/letter templates
  //    (System Admin's CRUD + rollout library — see routes/system.js). Only
  //    runs when a table is completely empty, so it never resurrects a
  //    template System Admin has since deleted.
  await seedDefaultTemplates();

  // 4. Bring all existing tenant schemas up to date
  await migrateTenantSchemas();

  // NOTE: migrateDefaultRolePrivileges() was a one-time fix (March 2026) to
  // correct privilege assignments on existing tenants after the default roles
  // were overhauled to match doc 8.4.1.  It is no longer called on startup —
  // the canonical set is now applied only when a new tenant is created via
  // createTenant.js.  The function is kept below for reference.
}

// ── Default Standard Email/Letter templates (one-time bootstrap) ───────────
// Content below is the original seed introduced by PR #497
// (backend/src/seed/defaultTemplates.js, now removed — this is its sole
// remaining home). Adapted from the Beacon User Guide's "Templates for
// Copying" (doc 6.1.2) and the Annual Data Check Form used by u3as running
// Beacon. Every u3a-specific detail (postal address, phone number, contact
// email) is left as a bracketed placeholder, since this ships to every
// tenant. System Admin can add/edit/delete these freely via the
// `default_standard_messages` / `default_standard_letters` master tables
// (routes/system.js) — this function only fires when a table is completely
// empty (i.e. before the very first row has ever existed), so it can never
// resurrect something System Admin deleted.

export const BOOTSTRAP_STANDARD_MESSAGES = [
  {
    name: 'New Member Welcome',
    subject: 'Welcome to #U3ANAME',
    body: `WELCOME TO #U3ANAME

Dear #FAM,

We would like to welcome you as a new member of #U3ANAME.

Please check that your details shown below are correct and let us know by return email if any changes are required or if there is any additional information that can be added.

You can find out more about #U3ANAME on [add a link to your u3a website].

If you go to [add a link to the page on your website about the Members Portal] you will see details of how you can log in to the Members Portal where you can update your personal details and view additional Groups & Calendar information that is not available to the general public.

We look forward to seeing you at our future meetings and events,

Best regards,

The Membership Team
#U3ANAME

-----------------------------------------------------

Name: #TITLE #FORENAME #SURNAME
Familiar name: #FAM
Address: #ADDRESSV
Email address: #EMAIL
Home phone: #TELEPHONE
Mobile Phone: #MOBILE
Emergency Contact: #EMERGENCY
Membership number: #MEMNO
Affiliation: #AFFILIATION
Membership Class: #MEMCLASS
Membership Renewal Date: #RENEW`,
  },
  {
    name: 'Renewal Confirmation',
    subject: 'Membership renewal confirmation — #U3ANAME',
    body: `MEMBERSHIP RENEWAL CONFIRMATION

Dear #FAM,

Thank you for renewing your membership of #U3ANAME. Please check the details about you below and let us know by return email if any changes are required or if there is any additional information that can be added.

Best regards,

The Membership Team
#U3ANAME

-----------------------------------------------------

Name: #TITLE #FORENAME #SURNAME
Familiar name: #FAM
Address: #ADDRESSV
Email address: #EMAIL
Home phone: #TELEPHONE
Mobile phone: #MOBILE
Emergency contact: #EMERGENCY
Membership class: #MEMCLASS
Membership number: #MEMNO
Affiliation: #AFFILIATION
Next renewal date: #RENEW`,
  },
];

// Standard Letters store `body` as a serialised Tiptap document
// (`{ type: 'doc', content: [...] }`) — see `tiptapToPdfContent()` in
// `backend/src/routes/letters.js`. Each paragraph renders as one
// line/block in the generated PDF; empty paragraphs render as blank lines.
function bootstrapPara(text, { bold = false, heading = false } = {}) {
  if (text === '') return { type: 'paragraph' };
  const node = {
    type: heading ? 'heading' : 'paragraph',
    content: [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }],
  };
  if (heading) node.attrs = { level: 2 };
  return node;
}

function bootstrapLabelledPara(label, value) {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: label, marks: [{ type: 'bold' }] },
      { type: 'text', text: value },
    ],
  };
}

const BOOTSTRAP_ANNUAL_DATA_CHECK_DOC = {
  type: 'doc',
  content: [
    bootstrapPara('#U3ANAME Annual Data Check', { heading: true }),
    bootstrapPara(''),
    bootstrapLabelledPara('Membership Number: ', '#MEMNO'),
    bootstrapPara(''),
    bootstrapPara(
      'Please check that these details are correct, and make any required amendments in CAPITAL LETTERS.',
    ),
    bootstrapPara(''),
    bootstrapLabelledPara('Name: ', '#TITLE #FORENAME #SURNAME'),
    bootstrapPara(''),
    bootstrapLabelledPara('Known As: ', '#FAM'),
    bootstrapPara(''),
    bootstrapPara('Address:', { bold: true }),
    bootstrapPara('#ADDRESSV'),
    bootstrapPara(''),
    bootstrapLabelledPara('Telephone: ', '#TELEPHONE'),
    bootstrapPara(''),
    bootstrapLabelledPara('Mobile: ', '#MOBILE'),
    bootstrapPara(''),
    bootstrapPara(''),
    bootstrapPara(
      'If you do not want group convenors to see your contact details, put a cross in the box below. (Bear in mind that if you do this then, as you do not have an email address, group convenors and outings organisers will be unable to communicate with you using Beacon.)',
    ),
    bootstrapPara('I do not want group convenors to see my contact details:  [ ]'),
    bootstrapPara(''),
    bootstrapPara(''),
    bootstrapPara(
      "This form can be returned at a Members Open Meeting, or posted to the Membership Secretary at [add your Membership Secretary's postal address]. Alternatively, you can telephone [add a contact phone number] to tell us of any changes.",
    ),
    bootstrapPara(''),
    bootstrapPara(
      'You are receiving this request by letter because we do not have an email address for you. If you have an email address that you use regularly, and would prefer us to contact you that way, please email [add your membership contact email address] (quoting ref: #MEMNO) to let us know.',
    ),
    bootstrapPara(''),
    bootstrapPara("If there are no changes, then you don't need to do anything."),
  ],
};

export const BOOTSTRAP_STANDARD_LETTERS = [
  {
    name: 'Annual Data Check Form',
    body: JSON.stringify(BOOTSTRAP_ANNUAL_DATA_CHECK_DOC),
  },
];

async function seedDefaultTemplates() {
  const messageCount = await prisma.defaultStandardMessage.count();
  if (messageCount === 0) {
    await prisma.defaultStandardMessage.createMany({ data: BOOTSTRAP_STANDARD_MESSAGES });
    logger.info(`✓ Seeded ${BOOTSTRAP_STANDARD_MESSAGES.length} default standard message(s).`);
  }

  const letterCount = await prisma.defaultStandardLetter.count();
  if (letterCount === 0) {
    await prisma.defaultStandardLetter.createMany({ data: BOOTSTRAP_STANDARD_LETTERS });
    logger.info(`✓ Seeded ${BOOTSTRAP_STANDARD_LETTERS.length} default standard letter(s).`);
  }
}

/**
 * Split a SQL string on semicolons, skipping characters that Postgres does
 * not treat as statement terminators:
 *   - `-- line comments` (to end of line)
 *   - `/* block comments *\/`
 *   - `'single-quoted strings'` (with `''` as the escape for a literal quote)
 *   - `$$ dollar-quoted blocks $$` (tag-less form; this codebase does not use tagged quoting)
 * Comment markers and the characters inside them are preserved verbatim in
 * the returned statements so the downstream SQL parser still sees them.
 */
export function splitSQL(sql) {
  const stmts = [];
  let current = '';
  // States: 'normal', 'lineComment', 'blockComment', 'string', 'dollarQuote'
  let state = 'normal';

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];

    if (state === 'lineComment') {
      current += c;
      if (c === '\n' || c === '\r') state = 'normal';
      continue;
    }
    if (state === 'blockComment') {
      if (c === '*' && n === '/') {
        current += '*/';
        i++;
        state = 'normal';
        continue;
      }
      current += c;
      continue;
    }
    if (state === 'string') {
      current += c;
      if (c === "'") {
        if (n === "'") {
          current += "'";
          i++; // escaped single quote — stay in string
        } else {
          state = 'normal';
        }
      }
      continue;
    }
    if (state === 'dollarQuote') {
      if (c === '$' && n === '$') {
        current += '$$';
        i++;
        state = 'normal';
        continue;
      }
      current += c;
      continue;
    }

    // state === 'normal'
    if (c === '-' && n === '-') {
      current += '--';
      i++;
      state = 'lineComment';
      continue;
    }
    if (c === '/' && n === '*') {
      current += '/*';
      i++;
      state = 'blockComment';
      continue;
    }
    if (c === "'") {
      current += "'";
      state = 'string';
      continue;
    }
    if (c === '$' && n === '$') {
      current += '$$';
      i++;
      state = 'dollarQuote';
      continue;
    }
    if (c === ';') {
      const trimmed = current.trim();
      if (trimmed) stmts.push(trimmed);
      current = '';
      continue;
    }
    current += c;
  }
  const last = current.trim();
  if (last) stmts.push(last);
  return stmts;
}

/**
 * Re-run tenant_schema.sql (idempotent) against every active tenant,
 * then re-seed default data (privilege resources, member statuses, member classes).
 * Safe to run on every startup — all DDL uses IF NOT EXISTS, inserts use ON CONFLICT DO NOTHING.
 */
async function migrateTenantSchemas() {
  const tenants = await prisma.sysTenant.findMany({ where: { active: true } });
  if (tenants.length === 0) return;

  const schemaSQL = readFileSync(resolve(__dirname, '../../prisma/tenant_schema.sql'), 'utf8');

  for (const tenant of tenants) {
    const slug = tenant.slug;
    const schemaName = `u3a_${slug}`;
    logger.info(`Migrating tenant schema: ${schemaName}`);

    let ddlErrors = 0;

    // Run the idempotent DDL — each statement is independent; a failure
    // on one statement (e.g. a pre-existing constraint) must not prevent
    // subsequent tables from being created.
    const statements = splitSQL(schemaSQL.replace(/:schema/g, schemaName));

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        ddlErrors++;
        logger.error(`  ✗ DDL error [${schemaName}]`, { message: err.message });
      }
    }

    // Re-seed default data — these run even if some DDL steps had warnings
    try {
      // Re-seed privilege resources — upsert so new actions are picked up
      for (const resource of PRIVILEGE_RESOURCES) {
        await tenantQuery(
          slug,
          `INSERT INTO privilege_resources (id, code, label, actions)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, actions = EXCLUDED.actions`,
          [resource.id, resource.code, resource.label, resource.actions],
        );
      }

      // Re-seed default role privileges (additive — ON CONFLICT DO NOTHING)
      await syncDefaultRolePrivileges(slug);

      // Re-seed locked member statuses
      for (const statusName of ['Current', 'Lapsed', 'Resigned', 'Deceased']) {
        await tenantQuery(
          slug,
          `INSERT INTO member_statuses (name, locked) VALUES ($1, true)
           ON CONFLICT (name) DO NOTHING`,
          [statusName],
        );
      }

      // Re-seed locked Individual member class (no UNIQUE on name, use WHERE NOT EXISTS)
      await tenantQuery(
        slug,
        `INSERT INTO member_classes (name, current, locked)
         SELECT 'Individual', true, true
         WHERE NOT EXISTS (SELECT 1 FROM member_classes WHERE name = 'Individual' AND locked = true)`,
      );

      // Seed default locked finance account: Current
      await tenantQuery(
        slug,
        `INSERT INTO finance_accounts (name, active, locked)
         SELECT 'Current', true, true
         WHERE NOT EXISTS (SELECT 1 FROM finance_accounts WHERE name = 'Current' AND locked = true)`,
      );

      // Seed default locked finance categories: Donations, Membership
      for (const catName of ['Donations', 'Membership']) {
        await tenantQuery(
          slug,
          `INSERT INTO finance_categories (name, active, locked)
           SELECT $1, true, true
           WHERE NOT EXISTS (SELECT 1 FROM finance_categories WHERE name = $1 AND locked = true)`,
          [catName],
        );
      }

      // Seed payment method defaults (BACS + all methods → Current account)
      // Only if the table is empty — never overwrite tenant configuration.
      const [pmCount] = await tenantQuery(
        slug,
        `SELECT count(*)::int AS n FROM payment_method_defaults`,
      );
      if (pmCount.n === 0) {
        const [currentAcc] = await tenantQuery(
          slug,
          `SELECT id FROM finance_accounts WHERE name = 'Current' AND locked = true LIMIT 1`,
        );
        if (currentAcc) {
          const pmMethods = [
            'Cheque',
            'Cash',
            'PayPal',
            'Standing Order',
            'Direct Debit',
            'BACS',
            'Debit card',
            'Account transfer',
            'Credit card',
          ];
          await tenantQuery(
            slug,
            `INSERT INTO payment_method_defaults (payment_method, account_id, updated_at)
             VALUES ('_default_method', 'BACS', now())`,
          );
          for (const pm of pmMethods) {
            await tenantQuery(
              slug,
              `INSERT INTO payment_method_defaults (payment_method, account_id, updated_at)
               VALUES ($1, $2, now())`,
              [pm, currentAcc.id],
            );
          }
        }
      }
    } catch (err) {
      logger.error(`  ✗ Seed error [${schemaName}]`, { message: err.message });
    }

    if (ddlErrors > 0) {
      logger.warn(`  ⚠ ${schemaName}: ${ddlErrors} DDL statement(s) failed (see errors above)`);
    } else {
      logger.info(`  ✓ ${schemaName} up to date`);
    }
  }
}

/**
 * Sync the canonical default-role privileges for a single tenant.
 * Called after a restore so that default-named roles (Administration, etc.)
 * always have at least the canonical privilege set.
 *
 * Strategy: for each DEFAULT_ROLES entry, find the role by name and INSERT
 * the canonical privileges (ON CONFLICT DO NOTHING — additive, not destructive).
 * Custom roles and any extra admin-added privileges are untouched.
 */
export async function syncDefaultRolePrivileges(slug) {
  const dbResources = await tenantQuery(slug, `SELECT id, code FROM privilege_resources`);
  const resourceIdByCode = Object.fromEntries(dbResources.map((r) => [r.code, r.id]));

  for (const roleData of DEFAULT_ROLES) {
    const rows = await tenantQuery(slug, `SELECT id FROM roles WHERE name = $1 LIMIT 1`, [
      roleData.name,
    ]);
    if (rows.length === 0) continue;
    const roleId = rows[0].id;

    for (const { code, action } of roleData.defaultPrivileges) {
      const resourceId = resourceIdByCode[code];
      if (!resourceId) continue;
      await tenantQuery(
        slug,
        `INSERT INTO role_privileges (role_id, resource_id, action)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [roleId, resourceId, action],
      );
    }
  }
  logger.info(`  ✓ Default role privileges synced for ${slug}`);
}

/**
 * Re-sync the privileges for the five default roles on every active tenant to
 * exactly match DEFAULT_ROLES in defaultRoles.js.
 *
 * Strategy: for each default role (looked up by name) delete all its current
 * privileges and re-insert from the canonical set.  This corrects both missing
 * entries and stale entries from earlier code versions.
 *
 * Custom roles and any admin-added privileges on non-default roles are untouched.
 *
 * Intentionally retained for reference (see note above); no longer called.
 */
// eslint-disable-next-line no-unused-vars
async function migrateDefaultRolePrivileges() {
  const tenants = await prisma.sysTenant.findMany({ where: { active: true } });
  if (tenants.length === 0) return;

  for (const tenant of tenants) {
    const slug = tenant.slug;
    try {
      await syncDefaultRolePrivileges(slug);
    } catch (err) {
      logger.error(`  ✗ Privilege sync error [${slug}]`, { message: err.message });
    }
  }
}

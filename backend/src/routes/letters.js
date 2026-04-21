// beacon2/backend/src/routes/letters.js
// Letters: compose, standard letter template CRUD, and PDF download.
// Docs 6.2, 6.2.1, 6.2.2

import { Router } from 'express';
import { z } from 'zod';
import { createRequire } from 'module';
import { tenantQuery } from '../utils/db.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { buildTokenMap, applyTokens } from '../utils/emailTokens.js';

const require = createRequire(import.meta.url);
const PdfPrinter = require('pdfmake/src/printer');
const vfsFonts = require('pdfmake/build/vfs_fonts');

const fonts = {
  Roboto: {
    normal:      Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64'),
    bold:        Buffer.from(vfsFonts['Roboto-Medium.ttf'], 'base64'),
    italics:     Buffer.from(vfsFonts['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64'),
  },
};
const printer = new PdfPrinter(fonts);

const router = Router();
router.use(requireAuth);
router.use(requireFeature('letters'));

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch members with address and partner data for token resolution.
 * Same query as email.js fetchMembersForEmail.
 */
async function fetchMembersForLetters(tenantSlug, memberIds) {
  const rows = await tenantQuery(tenantSlug, `
    SELECT
      m.id, m.membership_number, m.title, m.forenames, m.surname, m.known_as,
      m.email, m.mobile, m.next_renewal, m.home_u3a,
      mc.name AS class_name,
      a.house_no, a.street, a.add_line1, a.add_line2, a.town, a.county, a.postcode, a.telephone,
      p.id               AS p_id,
      p.title            AS p_title,
      p.forenames        AS p_forenames,
      p.surname          AS p_surname,
      p.known_as         AS p_known_as,
      p.email            AS p_email,
      p.mobile           AS p_mobile,
      pa.telephone       AS p_telephone
    FROM members m
    LEFT JOIN member_classes mc ON mc.id = m.class_id
    LEFT JOIN addresses a        ON a.id  = m.address_id
    LEFT JOIN members p          ON p.id  = m.partner_id
    LEFT JOIN addresses pa       ON pa.id = p.address_id
    WHERE m.id = ANY($1::text[])
  `, [memberIds]);

  return rows.map((r) => ({
    id:               r.id,
    membership_number: r.membership_number,
    title:            r.title,
    forenames:        r.forenames,
    surname:          r.surname,
    known_as:         r.known_as,
    email:            r.email,
    mobile:           r.mobile,
    next_renewal:     r.next_renewal,
    home_u3a:         r.home_u3a,
    class_name:       r.class_name,
    address: {
      house_no:  r.house_no,
      street:    r.street,
      add_line1: r.add_line1,
      add_line2: r.add_line2,
      town:      r.town,
      county:    r.county,
      postcode:  r.postcode,
      telephone: r.telephone,
    },
    partner: r.p_id ? {
      id:        r.p_id,
      title:     r.p_title,
      forenames: r.p_forenames,
      surname:   r.p_surname,
      known_as:  r.p_known_as,
      email:     r.p_email,
      mobile:    r.p_mobile,
      address: { telephone: r.p_telephone },
    } : null,
  }));
}

async function getTenantDisplayName(tenantSlug) {
  const rows = await tenantQuery(tenantSlug, `SELECT display_name FROM tenant_settings WHERE id = 'singleton'`, []);
  return rows[0]?.display_name || tenantSlug;
}

/**
 * Convert a TipTap JSON document node into pdfmake content array,
 * applying token resolution for a specific member.
 */
function tiptapToPdfContent(doc, tokenMap) {
  const content = [];

  for (const node of doc.content || []) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const textParts = [];

      for (const child of node.content || []) {
        if (child.type === 'text') {
          let text = child.text;
          if (tokenMap) text = applyTokens(text, tokenMap);

          const part = { text };
          const marks = child.marks || [];

          if (marks.some((m) => m.type === 'bold')) part.bold = true;
          if (marks.some((m) => m.type === 'italic')) part.italics = true;
          if (marks.some((m) => m.type === 'underline')) part.decoration = 'underline';

          const styleMark = marks.find((m) => m.type === 'textStyle');
          if (styleMark?.attrs?.fontSize) {
            part.fontSize = parseInt(styleMark.attrs.fontSize, 10);
          }

          textParts.push(part);
        } else if (child.type === 'hardBreak') {
          textParts.push({ text: '\n' });
        }
      }

      const para = {
        text: textParts.length > 0 ? textParts : [{ text: ' ' }],
      };

      if (node.attrs?.textAlign && node.attrs.textAlign !== 'left') {
        para.alignment = node.attrs.textAlign;
      }

      if (node.type === 'heading') {
        const sizeMap = { 1: 24, 2: 20, 3: 16, 4: 14, 5: 12, 6: 10 };
        para.fontSize = sizeMap[node.attrs?.level] || 16;
        para.bold = true;
      }

      content.push(para);
    }
  }

  return content;
}

// ─── Standard Letters CRUD ────────────────────────────────────────────────

// GET /letters/standard-letters
router.get('/standard-letters', requirePrivilege('letters_standard_messages', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(req.tenantSlug, `
      SELECT id, name, body FROM standard_letters ORDER BY name
    `, []);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /letters/standard-letters
router.post('/standard-letters', requirePrivilege('letters_standard_messages', 'create'), async (req, res, next) => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    body: z.string().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation error', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  const { name, body } = parsed.data;
  try {
    const rows = await tenantQuery(req.tenantSlug, `
      INSERT INTO standard_letters (name, body)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET body = $2, updated_at = NOW()
      RETURNING id, name, body
    `, [name, body]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /letters/standard-letters/:id
router.delete('/standard-letters/:id', requirePrivilege('letters_standard_messages', 'delete'), async (req, res, next) => {
  try {
    await tenantQuery(req.tenantSlug, `DELETE FROM standard_letters WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── PDF Download ─────────────────────────────────────────────────────────

// POST /letters/download
router.post('/download', requirePrivilege('letters', 'download'), async (req, res, next) => {
  const schema = z.object({
    memberIds: z.array(z.string()).min(1),
    body:      z.object({
      type:    z.literal('doc'),
      content: z.array(z.any()),
    }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation error', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  const { memberIds, body } = parsed.data;

  try {
    const [members, displayName] = await Promise.all([
      fetchMembersForLetters(req.tenantSlug, memberIds),
      getTenantDisplayName(req.tenantSlug),
    ]);

    if (members.length === 0) {
      return res.status(404).json({ error: 'No members found.' });
    }

    // Build pdfmake content: one page per member
    const allContent = [];
    for (let i = 0; i < members.length; i++) {
      const tokenMap = buildTokenMap(members[i], displayName);
      const memberContent = tiptapToPdfContent(body, tokenMap);

      if (i > 0 && memberContent.length > 0) {
        memberContent[0].pageBreak = 'before';
      }

      allContent.push(...memberContent);
    }

    const docDefinition = {
      content: allContent,
      pageSize: 'A4',
      pageMargins: [71, 71, 71, 71], // ~25mm
      defaultStyle: { font: 'Roboto', fontSize: 12 },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const filename = `${displayName.replace(/[^a-zA-Z0-9]/g, '_')}_Letters.pdf`;
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    });
    pdfDoc.end();
  } catch (err) { next(err); }
});

export default router;

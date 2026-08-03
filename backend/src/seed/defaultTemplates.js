// beacon2026/backend/src/seed/defaultTemplates.js
// Default Standard Email Messages and Standard Letters seeded for every new
// u3a tenant, adapted from the original Beacon User Guide's "Templates for
// Copying" (doc 6.1.2) and the Annual Data Check Form used by u3as running
// Beacon. Every u3a-specific detail (postal address, phone number, contact
// email) is left as a bracketed placeholder for that u3a to fill in — see
// CHANGELOG.md for the date these were added.

export const DEFAULT_STANDARD_MESSAGES = [
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
// (`{ type: 'doc', content: [...] }`), not plain text — see
// `tiptapToPdfContent()` in `backend/src/routes/letters.js`. Each paragraph
// below renders as one line/block in the generated PDF; empty paragraphs
// render as blank lines.
function para(text, { bold = false, heading = false } = {}) {
  if (text === '') return { type: 'paragraph' };
  const node = {
    type: heading ? 'heading' : 'paragraph',
    content: [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }],
  };
  if (heading) node.attrs = { level: 2 };
  return node;
}

function labelledPara(label, value) {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: label, marks: [{ type: 'bold' }] },
      { type: 'text', text: value },
    ],
  };
}

const annualDataCheckDoc = {
  type: 'doc',
  content: [
    para('#U3ANAME Annual Data Check', { heading: true }),
    para(''),
    labelledPara('Membership Number: ', '#MEMNO'),
    para(''),
    para(
      'Please check that these details are correct, and make any required amendments in CAPITAL LETTERS.',
    ),
    para(''),
    labelledPara('Name: ', '#TITLE #FORENAME #SURNAME'),
    para(''),
    labelledPara('Known As: ', '#FAM'),
    para(''),
    para('Address:', { bold: true }),
    para('#ADDRESSV'),
    para(''),
    labelledPara('Telephone: ', '#TELEPHONE'),
    para(''),
    labelledPara('Mobile: ', '#MOBILE'),
    para(''),
    para(''),
    para(
      'If you do not want group convenors to see your contact details, put a cross in the box below. (Bear in mind that if you do this then, as you do not have an email address, group convenors and outings organisers will be unable to communicate with you using Beacon.)',
    ),
    para('I do not want group convenors to see my contact details:  [ ]'),
    para(''),
    para(''),
    para(
      "This form can be returned at a Members Open Meeting, or posted to the Membership Secretary at [add your Membership Secretary's postal address]. Alternatively, you can telephone [add a contact phone number] to tell us of any changes.",
    ),
    para(''),
    para(
      'You are receiving this request by letter because we do not have an email address for you. If you have an email address that you use regularly, and would prefer us to contact you that way, please email [add your membership contact email address] (quoting ref: #MEMNO) to let us know.',
    ),
    para(''),
    para("If there are no changes, then you don't need to do anything."),
  ],
};

export const DEFAULT_STANDARD_LETTERS = [
  {
    name: 'Annual Data Check Form',
    body: JSON.stringify(annualDataCheckDoc),
  },
];

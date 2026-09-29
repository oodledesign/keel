/**
 * Default wording for the RICS Home Survey report template, used under the
 * workspace's RICS licence. Level 3 text follows the licensed Level 3 form.
 * Level 2 text is derived from Level 3 and is unverified until checked
 * against a real Level 2 report.
 */
export type TemplateLevel = 2 | 3;

function levelName(level: TemplateLevel): string {
  return `RICS Home Survey – Level ${level}`;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

export function callout(
  variant: 'reminder' | 'important' | 'know' | 'warning' | 'disclaimer',
  title: string,
  bodyHtml: string,
): string {
  return `<aside class="survey-callout" data-variant="${variant}"><h4>${title}</h4>${bodyHtml}</aside>`;
}

export const CONTENTS_NOTICE = (level: TemplateLevel) =>
  `<p>The ${levelName(level)} is reproduced with the permission of the Royal Institution of Chartered Surveyors, which owns the copyright. 2021 RICS ©</p>`;

export const DIVIDER_BLURBS = {
  A: (level: TemplateLevel) =>
    `<p>This ${levelName(level)} has been produced by a surveyor, who has written this report for you to use. If you decide not to act on the advice in this report, you do this at your own risk.</p>`,
  B: () =>
    `<p>This section provides our overall opinion of the property, highlighting areas of concern, and summarises the condition ratings of different elements of the property. If an element is made up of a number of different parts (for example, a pitched roof to the main building and a flat roof to an extension), only the part in the worst condition is shown here. It also provides a summary of repairs (and cost guidance where agreed) and recommendations for further investigations.</p>${callout(
      'important',
      'Important note',
      "<p>To get a balanced impression of the property, we strongly recommend that you read all sections of the report, in particular section L, 'What to do now', and discuss this with us if required.</p>",
    )}`,
  C: () =>
    '<p>This section includes:</p><ul><li>About the property</li><li>Energy efficiency</li><li>Location and facilities</li></ul>',
  F: () =>
    '<p>Services are generally hidden within the construction of the property. This means that we can only inspect the visible parts of the available services, and we do not carry out specialist tests. The visual inspection cannot assess the services to make sure they work efficiently and safely, and meet modern standards.</p>',
  H: () =>
    '<p>We do not act as a legal adviser and will not comment on any legal documents. However, if, during the inspection, we identify issues that your legal advisers may need to investigate further, we may refer to these in the report (for example, to state you should check whether there is a warranty covering replacement windows). You should show your legal advisers this section of the report.</p>',
  I: () =>
    '<p>This section summarises defects and issues that present a risk to the building or grounds, or a safety risk to people. These may have been reported and condition-rated against more than one part of the property, or may be of a more general nature. They may have existed for some time and cannot be reasonably changed.</p>',
  J: () =>
    "<p>This section describes energy related matters for the property as a whole. It takes into account a broad range of energy related features and issues already identified in the previous sections of this report, and discusses how they may be affected by the condition of the property.</p><p>This is not a formal energy assessment of the building but part of the report that will help you get a broader view of this topic. Although this may use information obtained from an available EPC, it does not check the certificate's validity or accuracy.</p>",
  JValuation: () =>
    '<p>This section sets out our opinion of the market value of the property and the reinstatement cost for insurance purposes, where these were agreed as part of the service.</p>',
};

export function aboutTheSurveyHtml(level: TemplateLevel): string {
  const survey =
    level === 3
      ? [
          "a thorough inspection of the property (see 'The inspection' in section M) and",
          "a detailed report based on the inspection (see 'The report' in section M).",
        ]
      : [
          "an inspection of the property (see 'The inspection' in section M) and",
          "a report based on the inspection (see 'The report' in section M).",
        ];
  const report =
    level === 3
      ? [
          'help you make a reasoned and informed decision when purchasing the property, or when planning for repairs, maintenance or upgrading the property;',
          'provide detailed advice on condition',
          'describe the identifiable risk of potential or hidden defects;',
          'propose the most probable cause(s) of the defects, based on the inspection',
          'where practicable and agreed, provide an estimate of costs and likely timescale for identified repairs and necessary work, and',
          'make recommendations as to any further actions to take or advice that needs to be obtained before committing to a purchase.',
        ]
      : [
          'help you make a reasoned and informed decision on whether to go ahead with buying the property;',
          'take into account any repairs or replacements the property needs, and',
          'consider what further advice you should take before committing to purchase the property.',
        ];
  const inspection =
    level === 3
      ? [
          'We carry out a desk-top study and make oral enquiries for information about matters affecting the property.',
          'We carefully and thoroughly inspect the property using reasonable efforts to see as much of it as is physically accessible. Where this is not possible an explanation will be provided.',
          'We visually inspect roofs, chimneys and other surfaces on the outside of the building from ground level and, if necessary, from neighbouring public property and with the help of binoculars.',
          'We inspect the roof structure from inside the roof space if there is access. We examine floor surfaces and under-floor spaces, so far as there is safe access and with permission from the owner. We are not able to assess the condition of the inside of any chimney, boiler or other flues.',
          'If we are concerned about these parts of the property that the inspection cannot cover, the report will tell you about any further investigations that are needed.',
          'Where practicable and agreed, we report on the cost of any work for identified repairs and make recommendations on how these repairs should be carried out. Some maintenance and repairs that we suggest may be expensive.',
          'We inspect the inside and outside of the main building and all permanent outbuildings. We also inspect the parts of the electricity, gas/oil, water, heating, drainage and other services that can be seen, but these are not tested other than normal operation in everyday use.',
          "To help describe the condition of the home, we give condition ratings to the main parts (the 'elements') of the building, garage, and some parts outside. Some elements can be made up of several different parts.",
          'In the element boxes in parts D, E, F and G, we describe the part that has the worst condition rating first and then outline the condition of the other parts.',
        ]
      : [
          'We visually inspect roofs, chimneys and other surfaces on the outside of the building from ground level and, if necessary, from neighbouring public property and with the help of binoculars.',
          'We inspect the roof structure from inside the roof space if there is access, but we do not move insulation or stored goods. We check floor surfaces and under-floor spaces so far as there is access, but we do not move furniture or lift floor coverings.',
          'We inspect the inside and outside of the main building and all permanent outbuildings, and the parts of the electricity, gas/oil, water, heating and drainage services that can be seen, but these are not tested other than normal operation in everyday use.',
          "To help describe the condition of the home, we give condition ratings to the main parts (the 'elements') of the building, garage, and some parts outside. Some elements can be made up of several different parts.",
          'In the element boxes in parts D, E, F and G, we describe the part that has the worst condition rating first and then outline the condition of the other parts.',
        ];

  return [
    '<h4>About the survey</h4>',
    '<p>As agreed, this report will contain the following:</p>',
    list(survey),
    '<h4>About the report</h4>',
    '<p>We aim to give you professional advice to:</p>',
    list(report),
    '<p>Any extra services we provide that are not covered by the terms and conditions of this report must be covered by a separate contract.</p>',
    '<h4>About the inspection</h4>',
    ...inspection.map((line) => `<p>${line}</p>`),
  ].join('');
}

export const REMINDER_CALLOUT = callout(
  'reminder',
  'Reminder',
  '<p>Please refer to your <strong>Terms and Conditions</strong>{{#terms.receivedDate}} received on the <strong>{{terms.receivedDate}}</strong>{{/terms.receivedDate}} for a full list of exclusions.</p>',
);

export const RATING_INTRO =
  "<p>To determine the condition of the property, we assess the main parts (the 'elements') of the building, garage and some outside areas. These elements are rated on the urgency of maintenance needed, ranging from 'very urgent' to 'no issues recorded'.</p>";

export const DOCUMENTS_INTRO =
  '<p>There are documents associated with the following elements. Check these documents have been supplied by your solicitor before exchanging contracts.</p>';

export const REPAIRS_INTRO =
  '<p>Formal quotations should be obtained prior to making a legal commitment to purchase the property.</p>';

export const FURTHER_INVESTIGATIONS_INTRO =
  '<p>Further investigations should be carried out before making a legal commitment to purchase the property.</p>';

export const ENERGY_EFFICIENCY_INTRO = (level: TemplateLevel) =>
  [
    "<p>We are advised that the property's current energy performance, as recorded in the EPC, is as stated below.</p>",
    '<p>We have checked for any obvious discrepancies between the EPC and the subject property, and the implications are explained to you.</p>',
    level === 3
      ? '<p>We will advise on the appropriateness of any energy improvements recommended by the EPC.</p>'
      : '',
  ].join('');

export const FLATS_NOTE = callout(
  'know',
  'Flats and maisonettes',
  '<p>The property is a flat or maisonette. We inspected the communal areas that give access to the flat, the roof spaces where these are accessible from the flat or communal areas, and the shared grounds. Your legal advisers should obtain the lease, details of service charges, reserve funds and planned major works, and confirm who is responsible for the maintenance of the building, the communal areas and the shared grounds.</p>',
);

export const LIMITATIONS_DEFAULTS: Record<'D' | 'E' | 'F' | 'G', string> = {
  D: '<p>We inspected the outside of the property from ground level within the boundaries of the site and from adjoining public areas. We did not inspect parts that were concealed or inaccessible, or where access would have caused damage. Roofs and high-level features were viewed from ground level, with the help of binoculars where needed.</p>',
  E: '<p>We did not move furniture, lift fitted floor coverings or floorboards, or open up the structure. Parts of the property that were covered, unexposed or otherwise inaccessible were not inspected, and we cannot report that those parts are free from defect.</p>',
  F: '<p>The services were subject to a visual inspection only and were not tested other than through their normal operation in everyday use. Concealed or intermittent defects may exist that were not apparent at the time of the inspection.</p>',
  G: '<p>The grounds were inspected from within the boundaries of the site. We did not inspect areas that were overgrown, covered or otherwise inaccessible.</p>',
};

export const SAFETY_WARNINGS = {
  F1: callout(
    'warning',
    'Safety warning',
    '<p>Electrical Safety First recommends that you should get a registered electrician to check the property and its electrical fittings at least every ten years, or on change of occupancy. All electrical installation work undertaken after 1 January 2005 should have appropriate certification. For more advice contact Electrical Safety First.</p>',
  ),
  F2: callout(
    'warning',
    'Safety warning',
    "<p>All gas and oil appliances and equipment should regularly be inspected, tested, maintained and serviced by a registered 'competent person' in line with the manufacturer's instructions. This is important to make sure that the equipment is working correctly, to limit the risk of fire and carbon monoxide poisoning, and to prevent carbon dioxide and other greenhouse gases from leaking into the air. For more advice, contact the Gas Safe Register for gas installations, and OFTEC for oil installations.</p>",
  ),
};

export const DECLARATION_CONFIRMATION =
  '<p>I confirm that I have inspected the property and prepared this report.</p>';

export const WHAT_TO_DO_NOW_HTML = [
  '<p>We have provided advice below on what to do next, now that you have an overview of any work to be carried out on the property. We recommend you make a note of any quotations you receive. This will allow you to check the amounts are in line with our estimates, if cost estimates have been provided.</p>',
  '<h4>Getting quotations</h4>',
  '<p>The cost of repairs may influence the amount you are prepared to pay for the property. Before you make a legal commitment to buy the property, you should get reports and quotations for all the repairs and further investigations the surveyor may have identified. You should get at least two quotations from experienced contractors who are properly insured.</p>',
  '<p>You should also:</p>',
  list([
    'ask them for references from people they have worked for;',
    'describe in writing exactly what you will want them to do; and',
    'get the contractors to put their quotations in writing.',
  ]),
  '<p>Some repairs will need contractors who have specialist skills and who are members of regulated organisations (for example, electricians, gas engineers, plumbers and so on). You may also need to get Building Regulations permission or planning permission from your local authority for some work.</p>',
  '<h4>Further investigations and what they involve</h4>',
  '<p>If we are concerned about the condition of a hidden part of the building, could only see part of a defect or do not have the specialist knowledge to assess part of the property fully, we may have recommended that further investigations should be carried out to discover the true extent of the problem.</p>',
  '<p>This will depend on the type of problem, but to do this properly, parts of the home may have to be disturbed, so you should discuss this matter with the current owner. In some cases, the cost of investigation may be high.</p>',
  '<p>When a further investigation is recommended, the following will be included in your report:</p>',
  list([
    'a description of the affected element and why a further investigation is required',
    'when a further investigation should be carried out and',
    'a broad indication of who should carry out the further investigation.',
  ]),
  '<h4>Who you should use for these further investigations</h4>',
  '<p>You should ask an appropriately qualified person, although it is not possible to tell you which one. Specialists belonging to different types of organisations will be able to do this. For example, qualified electricians can belong to five different government-approved schemes. If you want further advice, please contact the surveyor.</p>',
].join('');

export function serviceDescriptionHtml(level: TemplateLevel): string {
  const name = levelName(level);
  const service =
    level === 3 ? 'Home Survey - Level 3' : 'Home Survey - Level 2';
  return [
    '<h4>The service</h4>',
    `<p>The ${service} Service includes:</p>`,
    list(
      level === 3
        ? [
            "a thorough inspection of the property (see 'The inspection') and",
            "a detailed report based on the inspection (see 'The report').",
          ]
        : [
            "an inspection of the property (see 'The inspection') and",
            "a report based on the inspection (see 'The report').",
          ],
    ),
    `<p>The surveyor who provides the ${service} Service aims to give you professional advice to:</p>`,
    list(
      level === 3
        ? [
            'help you make a reasoned and informed decision when purchasing the property, or when planning for repairs, maintenance or upgrading the property;',
            'provide detailed advice on condition',
            'describe the identifiable risk of potential or hidden defects;',
            'propose the most probable cause(s) of the defects based on the inspection and',
            'where practicable and agreed, provide an estimate of costs and likely timescale for identified repairs and necessary work.',
          ]
        : [
            'make a reasoned and informed decision on whether to go ahead with buying the property;',
            'take into account any repairs or replacements the property needs, and',
            'consider what further advice you should take before committing to purchase the property.',
          ],
    ),
    '<p>Any extra services provided that are not covered by the terms and conditions of this service must be covered by a separate contract.</p>',
    '<h4>The inspection</h4>',
    "<p>The surveyor carefully and thoroughly inspects the inside and outside of the main building and all permanent outbuildings, recording the construction and defects that are evident. This inspection is intended to cover as much of the property as is physically accessible. Where this is not possible, an explanation is provided in the 'Limitations on the inspection' box in the relevant section of the report.</p>",
    '<p>The surveyor does not force or open up the fabric of the building without occupier/owner consent, or if there is a risk of causing personal injury or damage. This includes taking up fitted carpets and fitted floor coverings or floorboards; moving heavy furniture; removing the contents of cupboards, roof spaces, etc.; removing secured panels and/or hatches; or undoing electrical fittings.</p>',
    '<p>If necessary, the surveyor carries out parts of the inspection when standing at ground level from adjoining public property where accessible. This means the extent of the inspection will depend on a range of individual circumstances at the time of inspection, and the surveyor judges each case on an individual basis.</p>',
    '<p>The surveyor uses equipment such as a damp meter, binoculars and torch, and uses a ladder for flat roofs and for hatches no more than 3m above level ground (outside) or floor surfaces (inside) if it is safe to do so.</p>',
    '<p>If it is safe and reasonable to do so, the surveyor will enter the roof space and visually inspect the roof structure with attention paid to those parts vulnerable to deterioration and damage. Although thermal insulation is not moved, small corners should be lifted so its thickness and type, and the nature of underlying ceiling can be identified (if the surveyor considers it safe to do). The surveyor does not move stored goods or other contents.</p>',
    '<p>The surveyor also carries out a desk-top study and makes oral enquiries for information about matters affecting the property.</p>',
    '<h4>Services to the property</h4>',
    '<p>Services are generally hidden within the construction of the property. This means that only the visible parts of the available services can be inspected, and the surveyor does not carry out specialist tests other than through their normal operation in everyday use. The visual inspection cannot assess the efficiency or safety of electrical, gas or other energy sources. It also does not investigate the plumbing, heating or drainage installations (or whether they meet current regulations); or the internal condition of any chimney, boiler or other flue.</p>',
    '<h4>Outside the property</h4>',
    '<p>The surveyor inspects the condition of boundary walls, fences, permanent outbuildings and areas in common (shared) use. To inspect these areas, the surveyor walks around the grounds and any neighbouring public property where access can be obtained. Where there are restrictions to access (e.g. a creeper plant prevents closer inspection), these are reported and advice is given on any potential underlying risks that may require further investigation.</p>',
    '<p>Buildings with swimming pools and sports facilities are also treated as permanent outbuildings and are therefore inspected, but the surveyor does not report on the leisure facilities, such as the pool itself and its equipment internally or externally, landscaping and other facilities (for example, tennis courts and temporary outbuildings).</p>',
    '<h4>Flats</h4>',
    '<p>When inspecting flats, the surveyor assesses the general condition of the outside surfaces of the building, as well as its access and communal areas (for example, shared hallways and staircases that lead directly to the subject flat) and roof spaces, but only if they are accessible from within or owned by the subject flat or communal areas. The surveyor also inspects (within the identifiable boundary of the subject flat) drains, lifts, fire alarms and security systems, although the surveyor does not carry out any specialist tests other than their normal operation in everyday use. External wall systems are not inspected. If the surveyor has specific concerns about these items, further investigation will be recommended prior to legal commitment to purchase.</p>',
    '<h4>Dangerous materials, contamination and environmental issues</h4>',
    '<p>The surveyor makes enquiries about contamination or other environmental dangers. If the surveyor suspects a problem, they recommend a further investigation.</p>',
    '<p>The surveyor may assume that no harmful or dangerous materials have been used in the construction, and does not have a duty to justify making this assumption. However, if the inspection shows that such materials have been used, the surveyor must report this and ask for further instructions.</p>',
    "<p>The surveyor does not carry out an asbestos inspection and does not act as an asbestos inspector when inspecting properties that may fall within The Control of Asbestos Regulations 2012 ('CAR 2012'). However, the report should properly emphasise the suspected presence of asbestos containing materials if the inspection identifies that possibility. With flats, the surveyor assumes that there is a 'dutyholder' (as defined in the regulations), and that there is an asbestos register and an effective management plan in place, which does not present a significant risk to health or need any immediate payment. The surveyor does not consult the dutyholder.</p>",
    '<h4>The report</h4>',
    '<p>The surveyor produces a report of the results of inspection for you to use, but cannot accept any liability if it is used by anyone else. If you decide not to act on the advice in the report, you do this at your own risk. The report is aimed at providing you with a detailed understanding of the condition of the property to allow you to make an informed decision on serious or urgent repairs, and on the maintenance of a wide range of reported issues.</p>',
    '<h4>Condition ratings</h4>',
    "<p>The surveyor gives condition ratings to the main parts (the 'elements') of the main building, garage and some outside elements. The condition ratings are described as follows.</p>",
    '<p><strong>R</strong> - Documents we may suggest you request before you sign contracts.</p>',
    '<p><strong>Condition rating 3</strong> - defects that are serious and/or need to be repaired, replaced or investigated urgently. Failure to do so could risk serious safety issues or severe long-term damage to your property. Written quotations for repairs should be obtained prior to legal commitment to purchase.</p>',
    '<p><strong>Condition rating 2</strong> - defects that need repairing or replacing but are not considered to be either serious or urgent. The property must be maintained in the normal way.</p>',
    '<p><strong>Condition rating 1</strong> - no repair is currently needed. The property must be maintained in the normal way.</p>',
    '<p><strong>NI</strong> - Elements not inspected.</p>',
    '<p>The surveyor notes in the report if it was not possible to check any parts of the property that the inspection would normally cover. If the surveyor is concerned about these parts, the report tells you about any further investigations that are needed.</p>',
    '<h4>Energy</h4>',
    `<p>The surveyor has not prepared the Energy Performance Certificate (EPC) as part of the ${name} service for the property. Where the EPC has not been made available by others, the surveyor will obtain the most recent certificate from the appropriate central registry where practicable. If the surveyor has seen the current EPC, they will review and state the relevant energy efficiency rating in this report. Where possible and appropriate, the surveyor will include additional commentary on energy-related matters for the property as a whole in the energy efficiency section of the report, but this is not a formal energy assessment of the building. Checks will be made for any obvious discrepancies between the EPC and the subject property, and the implications will be explained to you.${level === 3 ? ` As part of the ${service} Service, the surveyor will advise on the appropriateness of any energy improvements recommended by the EPC.` : ''}</p>`,
    '<h4>Issues for legal advisers</h4>',
    '<p>The surveyor does not act as a legal adviser and does not comment on any legal documents. If, during the inspection, the surveyor identifies issues that your legal advisers may need to investigate further, the surveyor may refer to these in the report (for example, to state you should check whether there is a warranty covering replacement windows).</p>',
    "<p>This report has been prepared by a surveyor merely in their capacity as an employee or agent of a firm, company or other business entity ('the Company'). The report is the product of the Company, not of the individual surveyor. All of the statements and opinions contained in this report are expressed entirely on behalf of the Company, which accepts sole responsibility for them. For their part, the individual surveyor assumes no personal financial responsibility or liability in respect of the report, and no reliance or inference to the contrary should be drawn.</p>",
    '<p>In the case of sole practitioners, the surveyor may sign the report in their own name, unless the surveyor operates as a sole trader limited liability company.</p>',
    '<p>Nothing in this report excludes or limits liability for death or personal injury (including disease and impairment of mental condition) resulting from negligence.</p>',
    '<h4>Risks</h4>',
    `<p>This section summarises defects and issues that present a risk to the building or grounds, or a safety risk to people. These may have been reported and condition rated against more than one part of the property, or may be of a more general nature. They may have existed for some time and cannot be reasonably changed. The ${name} report will identify risks, explain the nature of the problems and explain how the client may resolve or reduce the risk.</p>`,
    '<p>If the property is leasehold, the surveyor gives you general advice and details of questions you should ask your legal advisers.</p>',
    '<h4>Standard terms of engagement</h4>',
    `<p><strong>1 The service</strong> - The surveyor provides the standard ${name} service described in this section, unless you agree with the surveyor in writing before the inspection that the surveyor will provide extra services. Any extra service will require separate terms of engagement to be entered into with the surveyor. Examples of extra services include:</p>`,
    list([
      'schedules of works',
      'supervision of works',
      're-inspection',
      'detailed specific issue reports',
      'market valuation and re-instatement cost, and',
      'negotiation.',
    ]),
    '<p><strong>2 The surveyor</strong> - the service will be provided by an AssocRICS, MRICS or FRICS member of the Royal Institution of Chartered Surveyors (RICS), who has the skills, knowledge and experience to survey, value and report on the property.</p>',
    '<p><strong>3 Before the inspection</strong> - before the inspection, you should tell us if there is already an agreed or proposed price for the property, and if you have any particular concerns about the property (such as a crack noted above the bathroom window or any plans for extension).</p>',
    '<p>This period forms an important part of the relationship between you and the surveyor. The surveyor will use reasonable endeavours to contact you to discuss your particular concerns regarding the property and explain (where necessary) the extent and/ or limitations of the inspection and report. The surveyor also carries out a desktop study to understand the property better.</p>',
    "<p><strong>4 Terms of payment</strong> - you agree to pay the surveyor's fee and any other charges agreed in writing.</p>",
    "<p><strong>5 Cancelling this contract</strong> - you should seek advice on your obligations under The Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 ('the Regulations') and/or the Consumer Rights Act 2015 in accordance with section 2.6 of the current edition of the Home survey standard RICS professional statement.</p>",
    '<p><strong>6 Liability</strong> - the report is provided for your use, and the surveyor cannot accept responsibility if it is used, or relied upon, by anyone else.</p>',
    '<p>Note: These terms form part of the contract between you and the surveyor.</p>',
    '<p>This report is for use in the UK.</p>',
    '<h4>Complaints handling procedure</h4>',
    '<p>The surveyor will have a complaints handling procedure and will give you a copy if you ask. The surveyor is required to provide you with contact details, in writing, for their complaints department or the person responsible for dealing with client complaints. Where the surveyor is party to a redress scheme, those details should also be provided. If any of this information is not provided, please notify the surveyor and ask for it to be supplied.</p>',
  ].join('');
}

export const TYPICAL_HOUSE_HTML =
  '<figure class="survey-diagram" data-asset="typical-house"><img src="/brand/rics-typical-house.png" alt="Typical house diagram" /></figure><p>This diagram illustrates where you may find some of the building elements referred to in the report.</p>';

export const CLOSING_CALLOUTS = [
  callout(
    'know',
    'You should know...',
    "<p>This report has been prepared by a surveyor merely in their capacity as an employee or agent of a firm, company or other business entity ('the Company'). The report is the product of the Company, not of the individual surveyor. All of the statements and opinions contained in this report are expressed entirely on behalf of the Company, which accepts sole responsibility for them. For their part, the individual surveyor assumes no personal financial responsibility or liability in respect of the report, and no reliance or inference to the contrary should be drawn.</p><p>In the case of sole practitioners, the surveyor may sign the report in their own name unless the surveyor operates as a sole trader limited liability company.</p><p>Nothing in this report excludes or limits liability for death or personal injury (including disease and impairment of mental condition) resulting from negligence.</p>",
  ),
  callout(
    'disclaimer',
    'RICS disclaimer',
    '<p>This document is issued in blank form by the Royal Institution of Chartered Surveyors (RICS) and is available only to parties who have signed a licence agreement with RICS.</p><p>RICS gives no representations or warranties, express or implied, and no responsibility or liability is accepted for the accuracy or completeness of the information inserted into the document, or any other written or oral information given to any interested party or its advisers. Any such liability is expressly disclaimed.</p>',
  ),
].join('');

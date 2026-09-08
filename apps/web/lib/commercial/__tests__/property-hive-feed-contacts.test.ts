import { describe, expect, it } from 'vitest';

import {
  indexStaffPhonesByEmail,
  renderFeedContactsXml,
  renderFeedJointAgentsXml,
  toFeedActingAgentContacts,
} from '../property-hive-feed-contacts';

describe('toFeedActingAgentContacts', () => {
  it('keeps acting-agent order so the first agent is the primary contact', () => {
    const contacts = toFeedActingAgentContacts(
      [
        {
          name: 'Josh Example',
          email: 'josh@ozer.example',
          phone: '01234 567890',
        },
        {
          name: 'Alex Other',
          email: 'alex@ozer.example',
          phone: null,
        },
      ],
      { office: 'Ozer', branch: 'London' },
    );

    expect(contacts).toEqual([
      {
        name: 'Josh Example',
        email: 'josh@ozer.example',
        phone: '01234 567890',
        office: 'Ozer',
        branch: 'London',
      },
      {
        name: 'Alex Other',
        email: 'alex@ozer.example',
        phone: '',
        office: 'Ozer',
        branch: 'London',
      },
    ]);
  });

  it('falls back to email when the member name is missing', () => {
    expect(
      toFeedActingAgentContacts([
        { name: null, email: 'josh@ozer.example', phone: null },
      ]),
    ).toEqual([
      {
        name: 'josh@ozer.example',
        email: 'josh@ozer.example',
        phone: '',
        office: '',
        branch: '',
      },
    ]);
  });

  it('skips agents with neither name nor email', () => {
    expect(
      toFeedActingAgentContacts([
        { name: '  ', email: null, phone: '0111' },
        { name: null, email: '', phone: null },
      ]),
    ).toEqual([]);
  });
});

describe('renderFeedContactsXml', () => {
  it('emits an empty contacts node when there are no acting agents', () => {
    expect(renderFeedContactsXml([])).toBe('<contacts/>');
  });

  it('emits ordered acting agents as Kato contacts (Avebury-style)', () => {
    const xml = renderFeedContactsXml(
      toFeedActingAgentContacts(
        [
          {
            name: 'Josh Example',
            email: 'josh@ozer.example',
            phone: '01234 567890',
          },
          {
            name: 'Alex Other',
            email: 'alex@ozer.example',
            phone: null,
          },
        ],
        { office: 'Ozer' },
      ),
    );

    expect(xml).toContain('<contacts>');
    expect(xml.indexOf('Josh Example')).toBeLessThan(xml.indexOf('Alex Other'));
    expect(xml).toContain('<name>Josh Example</name>');
    expect(xml).toContain('<email>josh@ozer.example</email>');
    expect(xml).toContain('<tel>01234 567890</tel>');
    expect(xml).toContain('<mobile>01234 567890</mobile>');
    expect(xml).toContain('<office>Ozer</office>');
    expect(xml).not.toContain('Darrell');
  });

  it('escapes contact fields', () => {
    const xml = renderFeedContactsXml(
      toFeedActingAgentContacts([
        {
          name: 'Josh & Co',
          email: 'josh@ozer.example',
          phone: null,
        },
      ]),
    );
    expect(xml).toContain('<name>Josh &amp; Co</name>');
  });
});

describe('renderFeedJointAgentsXml', () => {
  it('keeps external co-agents in joint_agents only', () => {
    const xml = renderFeedJointAgentsXml([
      {
        contact_name: 'Jane Smith',
        contact_email: 'jane@other.co.uk',
        contact_phone: '01234567890',
        clients: {
          display_name: 'Jane Smith',
          company_name: 'Other Agency LLP',
          email: 'office@other.co.uk',
          phone: '020 0000 0000',
        },
      },
    ]);

    expect(xml).toContain('<joint_agents>');
    expect(xml).toContain('<name>Jane Smith</name>');
    expect(xml).toContain('<office>Other Agency LLP</office>');
    expect(xml).toContain('<email>jane@other.co.uk</email>');
  });

  it('emits an empty joint_agents node when there are no co-agents', () => {
    expect(renderFeedJointAgentsXml([])).toBe('<joint_agents/>');
  });

  it('keeps acting-agent contacts independent of joint agents', () => {
    const contacts = renderFeedContactsXml(
      toFeedActingAgentContacts([
        {
          name: 'Josh Example',
          email: 'josh@ozer.example',
          phone: '01234 567890',
        },
      ]),
    );
    const joint = renderFeedJointAgentsXml([
      {
        contact_name: 'Jane Smith',
        contact_email: 'jane@other.co.uk',
        contact_phone: '01234567890',
        clients: {
          display_name: 'Jane Smith',
          company_name: 'Other Agency LLP',
          email: 'office@other.co.uk',
          phone: null,
        },
      },
    ]);

    expect(contacts).toContain('Josh Example');
    expect(contacts).not.toContain('Jane Smith');
    expect(joint).toContain('Jane Smith');
    expect(joint).not.toContain('Josh Example');
  });
});

describe('indexStaffPhonesByEmail', () => {
  it('indexes direct then mobile numbers by email and signature email', () => {
    const phones = indexStaffPhonesByEmail([
      {
        email: 'josh@ozer.example',
        signature_email: 'josh.sig@ozer.example',
        phone_direct: '01234 567890',
        phone_mobile: '07700 900123',
      },
      {
        email: 'alex@ozer.example',
        phone_direct: null,
        phone_mobile: ' 07700 900999 ',
      },
    ]);

    expect(phones.get('josh@ozer.example')).toBe('01234 567890');
    expect(phones.get('josh.sig@ozer.example')).toBe('01234 567890');
    expect(phones.get('alex@ozer.example')).toBe('07700 900999');
  });
});

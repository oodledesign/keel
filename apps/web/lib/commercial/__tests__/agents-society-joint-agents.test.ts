import { describe, expect, it } from 'vitest';

import { parseJointAgentsFromPropertyXml } from '../agents-society-joint-agents';

describe('parseJointAgentsFromPropertyXml', () => {
  it('returns empty when joint_agents is empty', () => {
    expect(
      parseJointAgentsFromPropertyXml(
        '<property><joint_agents></joint_agents></property>',
      ),
    ).toEqual([]);
  });

  it('parses joint_agent nodes', () => {
    const xml = `
      <property>
        <joint_agents>
          <joint_agent>
            <name>Jane Smith</name>
            <email>jane@other.co.uk</email>
            <tel>01234567890</tel>
            <office>Other Agency LLP</office>
          </joint_agent>
        </joint_agents>
      </property>
    `;
    expect(parseJointAgentsFromPropertyXml(xml)).toEqual([
      {
        externalId: null,
        firmName: 'Other Agency LLP',
        contactName: 'Jane Smith',
        contactEmail: 'jane@other.co.uk',
        contactPhone: '01234567890',
      },
    ]);
  });
});

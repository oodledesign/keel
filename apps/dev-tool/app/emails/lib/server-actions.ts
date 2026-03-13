'use server';

import {
  createKitEmailsDeps,
  createKitEmailsService,
} from '@kit/mcp-server/emails';
import { findWorkspaceRoot } from '@kit/mcp-server/env';

export async function sendEmailAction(params: {
  template: string;
  settings: {
    username: string;
    password: string;
    sender: string;
    host: string;
    to: string;
    port: number;
    tls: boolean;
  };
}) {
  const { settings } = params;
  const { createTransport } = await import('nodemailer');

  const transporter = createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.tls,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  });

  const rootPath = findWorkspaceRoot(process.cwd());
  const service = createKitEmailsService(createKitEmailsDeps(rootPath));
  const result = await service.read({ id: params.template });
  const html = result.renderedHtml ?? result.source;

  return transporter.sendMail({
    html,
    from: settings.sender,
    to: settings.to,
    subject: 'Test Email',
  });
}

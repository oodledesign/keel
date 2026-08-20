'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import { EarlyAccessSignupSchema } from '../early-access-signup.schema';

const contactEmail = z
  .string({
    description: `The email where you want to receive early-access signups.`,
    required_error:
      'Contact email is required. Please use the environment variable CONTACT_EMAIL.',
  })
  .parse(process.env.CONTACT_EMAIL);

const emailFrom = z
  .string({
    description: `The email sending address.`,
    required_error:
      'Sender email is required. Please use the environment variable EMAIL_SENDER.',
  })
  .parse(process.env.EMAIL_SENDER);

export const sendEarlyAccessSignup = enhanceAction(
  async (data) => {
    const safeEmail = data.email
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

    await sendPlatformEmail({
      type: 'contact_form',
      mail: {
        to: contactEmail,
        from: emailFrom,
        subject: 'Early access signup',
        html: `
        <p>New early-access interest from the /early-access page.</p>
        <p>Email: ${safeEmail}</p>
      `,
      },
    });

    return {};
  },
  {
    schema: EarlyAccessSignupSchema,
    auth: false,
  },
);

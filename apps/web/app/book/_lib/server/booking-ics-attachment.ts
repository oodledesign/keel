import 'server-only';

import { buildBookingIcs } from '../calendar-links';

export function bookingIcsAttachment(
  input: Parameters<typeof buildBookingIcs>[0],
) {
  const ics = buildBookingIcs(input);
  return {
    name: 'booking.ics',
    content: Buffer.from(ics, 'utf8').toString('base64'),
    mimeType: 'text/calendar; method=PUBLISH; charset=UTF-8',
  };
}

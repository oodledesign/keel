'use server';

import { enhanceAction } from '@kit/next/actions';

import {
  CancelPublicBookingSchema,
  CreatePublicBookingSchema,
  FetchSlotsSchema,
  ReschedulePublicBookingSchema,
} from '../schema/public-booking.schema';
import {
  cancelPublicBooking,
  createPublicBooking,
  fetchPublicAvailableSlots,
  reschedulePublicBooking,
} from './public-booking.service';

/**
 * Public booking actions — auth is not required.
 * All data access uses the service-role client inside the service layer.
 */
export const fetchPublicSlotsAction = enhanceAction(
  async (input) => {
    return fetchPublicAvailableSlots(input);
  },
  { schema: FetchSlotsSchema, auth: false },
);

export const createPublicBookingAction = enhanceAction(
  async (input) => {
    return createPublicBooking(input);
  },
  { schema: CreatePublicBookingSchema, auth: false },
);

export const cancelPublicBookingAction = enhanceAction(
  async (input) => {
    return cancelPublicBooking(input);
  },
  { schema: CancelPublicBookingSchema, auth: false },
);

export const reschedulePublicBookingAction = enhanceAction(
  async (input) => {
    return reschedulePublicBooking(input);
  },
  { schema: ReschedulePublicBookingSchema, auth: false },
);

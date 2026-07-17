'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useSignInWithOtp } from '@kit/supabase/hooks/use-sign-in-with-otp';
import { useVerifyOtp } from '@kit/supabase/hooks/use-verify-otp';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@kit/ui/form';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@kit/ui/input-otp';
import { Spinner } from '@kit/ui/spinner';
import { Trans } from '@kit/ui/trans';

import { useCaptcha } from '../captcha/client';
import { useLastAuthMethod } from '../hooks/use-last-auth-method';
import { AuthErrorAlert } from './auth-error-alert';
import { EmailInput } from './email-input';

const EmailSchema = z.object({ email: z.string().email() });
const OtpSchema = z.object({ token: z.string().min(6).max(6) });

type OtpSignInContainerProps = {
  shouldCreateUser: boolean;
  captchaSiteKey?: string;
};

export function OtpSignInContainer(props: OtpSignInContainerProps) {
  const verifyMutation = useVerifyOtp();
  const signInMutation = useSignInWithOtp();
  const captcha = useCaptcha({ siteKey: props.captchaSiteKey });
  const router = useRouter();
  const { recordAuthMethod } = useLastAuthMethod();
  const params = useSearchParams();

  const otpForm = useForm({
    resolver: zodResolver(OtpSchema.merge(EmailSchema)),
    defaultValues: {
      token: '',
      email: '',
    },
  });

  const email = useWatch({
    control: otpForm.control,
    name: 'email',
  });

  const isEmailStep = !email;

  const shouldCreateUser =
    'shouldCreateUser' in props && props.shouldCreateUser;

  const sendOtp = async (targetEmail: string) => {
    await signInMutation.mutateAsync({
      email: targetEmail,
      options: {
        captchaToken: captcha.token,
        shouldCreateUser,
      },
    });

    captcha.reset();
    otpForm.setValue('email', targetEmail, { shouldValidate: true });
    otpForm.setValue('token', '');
    verifyMutation.reset();
  };

  const handleVerifyOtp = async ({
    token,
    email,
  }: {
    token: string;
    email: string;
  }) => {
    await verifyMutation.mutateAsync({
      type: 'email',
      email,
      token,
    });

    recordAuthMethod('otp', { email });

    const next = params.get('next') ?? '/app';

    router.replace(next);
  };

  const handleResendOtp = async () => {
    const targetEmail = otpForm.getValues('email');

    if (!targetEmail) {
      otpForm.setValue('email', '', { shouldValidate: true });
      return;
    }

    await sendOtp(targetEmail);
  };

  if (isEmailStep) {
    return (
      <OtpEmailForm
        captcha={captcha}
        signInMutation={signInMutation}
        onSendOtp={sendOtp}
      />
    );
  }

  const isBusy = verifyMutation.isPending || signInMutation.isPending;

  return (
    <Form {...otpForm}>
      <form
        className="flex w-full flex-col items-center space-y-8"
        onSubmit={otpForm.handleSubmit(handleVerifyOtp)}
      >
        <AuthErrorAlert error={verifyMutation.error ?? signInMutation.error} />

        <p className="text-muted-foreground text-center text-sm">
          <Trans i18nKey="common:otp.codeSentToEmail" values={{ email }} />
        </p>

        <FormField
          name="token"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={isBusy}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} data-slot="0" />
                    <InputOTPSlot index={1} data-slot="1" />
                    <InputOTPSlot index={2} data-slot="2" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} data-slot="3" />
                    <InputOTPSlot index={4} data-slot="4" />
                    <InputOTPSlot index={5} data-slot="5" />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>

              <FormDescription>
                <Trans i18nKey="common:otp.enterCodeFromEmail" />
              </FormDescription>

              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex w-full flex-col gap-y-2">
          <Button type="submit" disabled={isBusy} data-test="otp-verify-button">
            {verifyMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                <Trans i18nKey="common:otp.verifying" />
              </>
            ) : (
              <Trans i18nKey="common:otp.verifyCode" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() => {
              void handleResendOtp();
            }}
          >
            {signInMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                <Trans i18nKey="common:otp.sendingCode" />
              </>
            ) : (
              <Trans i18nKey="common:otp.requestNewCode" />
            )}
          </Button>

          <Button
            type="button"
            variant="link"
            disabled={isBusy}
            className="text-muted-foreground"
            onClick={() => {
              signInMutation.reset();
              verifyMutation.reset();
              otpForm.setValue('email', '', { shouldValidate: true });
              otpForm.setValue('token', '');
            }}
          >
            <Trans i18nKey="auth:changeEmailAddress" />
          </Button>
        </div>

        {captcha.field}
      </form>
    </Form>
  );
}

function OtpEmailForm({
  captcha,
  signInMutation,
  onSendOtp,
}: {
  captcha: ReturnType<typeof useCaptcha>;
  signInMutation: ReturnType<typeof useSignInWithOtp>;
  onSendOtp: (email: string) => Promise<void>;
}) {
  const emailForm = useForm({
    resolver: zodResolver(EmailSchema),
    defaultValues: { email: '' },
  });

  const handleSendOtp = async ({ email }: z.infer<typeof EmailSchema>) => {
    await onSendOtp(email);
  };

  return (
    <Form {...emailForm}>
      <form
        className="flex flex-col gap-y-4"
        onSubmit={emailForm.handleSubmit(handleSendOtp)}
      >
        <AuthErrorAlert error={signInMutation.error} />

        <FormField
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <EmailInput data-test="otp-email-input" {...field} />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={signInMutation.isPending}
          data-test="otp-send-button"
        >
          {signInMutation.isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              <Trans i18nKey="common:otp.sendingCode" />
            </>
          ) : (
            <Trans i18nKey="common:otp.sendVerificationCode" />
          )}
        </Button>
      </form>

      {captcha.field}
    </Form>
  );
}

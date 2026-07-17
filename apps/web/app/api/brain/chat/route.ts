import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type BrainContextRef,
  parseSseAssistantText,
  prepareBrainChat,
  streamBrainChatReply,
  summarizeThreadTitle,
} from '~/lib/brain/chat';
import { isVoyageConfigured } from '~/lib/brain/voyage';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ChatBody = {
  accountId: string;
  accountSlug: string;
  threadId: string;
  message: string;
  scope?: {
    jobId?: string | null;
    clientId?: string | null;
    jobTitle?: string | null;
    clientName?: string | null;
  };
};

export const POST = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!isVoyageConfigured()) {
      return new Response('VOYAGE_API_KEY is not configured', { status: 503 });
    }

    const body = (await request.json()) as ChatBody;
    const client = getSupabaseServerClient();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const message = body.message?.trim();
    if (!message) return new Response('Message required', { status: 400 });

    const { data: thread } = await client
      .from('brain_chat_threads')
      .select('id, title')
      .eq('id', body.threadId)
      .eq('account_id', body.accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!thread) return new Response('Thread not found', { status: 404 });

    await client.from('brain_chat_messages').insert({
      thread_id: body.threadId,
      account_id: body.accountId,
      role: 'user',
      content: message,
      context_refs: [],
    });

    const prepared = await prepareBrainChat({
      client,
      accountId: body.accountId,
      userMessage: message,
      scope: body.scope,
    });

    const anthropicStream = await streamBrainChatReply(prepared.userPrompt);
    const parser = parseSseAssistantText(anthropicStream);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of parser.textChunks()) {
            controller.enqueue(encoder.encode(chunk));
          }

          const assistantText = parser.getFullText().trim();
          const contextRefs: BrainContextRef[] = prepared.contextRefs;

          await client.from('brain_chat_messages').insert({
            thread_id: body.threadId,
            account_id: body.accountId,
            role: 'assistant',
            content: assistantText || '(No response)',
            context_refs: contextRefs,
          });

          await client
            .from('brain_chat_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', body.threadId);

          if (!thread.title || thread.title === 'New chat') {
            void summarizeThreadTitle(message).then(async (title) => {
              if (!title) return;
              await client
                .from('brain_chat_threads')
                .update({ title: title.slice(0, 120) })
                .eq('id', body.threadId);
            });
          }

          controller.enqueue(
            encoder.encode(`\n\n[[BRAIN_REFS:${JSON.stringify(contextRefs)}]]`),
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  },
  { auth: true },
);

import { useCallback, useRef } from 'react';

export interface SSEHandlers {
  onThought?: (data: Record<string, unknown>) => void;
  onDelta?: (text: string, paragraphId: string) => void;
  onGhostComplete?: (data: Record<string, unknown>) => void;
  onVerified?: (data: Record<string, unknown>) => void;
  onFlagged?: (data: Record<string, unknown>) => void;
  onImageReady?: (data: Record<string, unknown>) => void;
  onAborted?: (data: Record<string, unknown>) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (msg: string) => void;
}

export function useSSE() {
  const abortRef = useRef<AbortController | null>(null);
  const reconnectCount = useRef(0);

  const connect = useCallback(async (
    url: string,
    payload: Record<string, unknown>,
    handlers: SSEHandlers,
    signal?: AbortSignal,
  ) => {
    reconnectCount.current = 0;

    const run = async () => {
      abortRef.current = new AbortController();
      const combinedSignal = signal ?? abortRef.current.signal;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: combinedSignal,
        });

        if (!res.ok || !res.body) {
          handlers.onError?.(`HTTP ${res.status}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          if (combinedSignal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const evt = JSON.parse(raw) as { event: string; data: Record<string, unknown> };
              dispatch(evt, handlers);
            } catch {
              // malformed chunk — skip
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;

        reconnectCount.current++;
        if (reconnectCount.current <= 3) {
          handlers.onError?.(`Connection lost — reconnecting (${reconnectCount.current}/3)...`);
          await new Promise((r) => setTimeout(r, 500));
          return run();
        }
        handlers.onError?.('Connection failed after 3 attempts');
      }
    };

    await run();
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { connect, abort };
}

function dispatch(
  evt: { event: string; data: Record<string, unknown> },
  handlers: SSEHandlers,
) {
  switch (evt.event) {
    case 'thought':
      handlers.onThought?.(evt.data);
      break;
    case 'delta':
      handlers.onDelta?.(
        (evt.data.text as string) ?? '',
        (evt.data.paragraph_id as string) ?? '',
      );
      break;
    case 'ghost_complete':
      handlers.onGhostComplete?.(evt.data);
      break;
    case 'verified':
      handlers.onVerified?.(evt.data);
      break;
    case 'flagged':
      handlers.onFlagged?.(evt.data);
      break;
    case 'image_ready':
      handlers.onImageReady?.(evt.data);
      break;
    case 'aborted':
      handlers.onAborted?.(evt.data);
      break;
    case 'done':
    case 'stream_end':
      handlers.onDone?.(evt.data);
      break;
    case 'error':
      handlers.onError?.((evt.data.message as string) ?? 'Unknown error');
      break;
  }
}

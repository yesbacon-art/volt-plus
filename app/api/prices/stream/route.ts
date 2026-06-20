import { createPriceTick } from "@/lib/price";
import { appendPriceTick } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const tick = appendPriceTick(createPriceTick());
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(tick)}\n\n`));
      };

      send();
      interval = setInterval(send, 2_500);
    },
    cancel() {
      clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

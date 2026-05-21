import { Router } from 'express';
import { EventEmitter } from 'events';

export const agentCallbackRouter = Router();

/**
 * In-memory store for pending agent replies.
 * Key = conversationId, Value = EventEmitter that streams activities as they arrive.
 *
 * The Activity Protocol flow:
 *   1. App sends activity to Foundry with serviceUrl pointing here
 *   2. Agent processes (calls MCP tools, reasons, etc.)
 *   3. Agent sends reply activities to POST /v3/conversations/:convId/activities
 *   4. This endpoint captures them and emits events so the caller can stream to the client
 */
export const pendingReplies = new Map<string, EventEmitter>();

/**
 * Bot Framework reply endpoint.
 * The agent sends its replies here as activities.
 * Path: /api/agent-callback/v3/conversations/:conversationId/activities
 */
agentCallbackRouter.post(
  '/v3/conversations/:conversationId/activities',
  (req, res) => {
    const { conversationId } = req.params;
    const activity = req.body;

    console.log(
      `[agent-callback] Received activity for conv=${conversationId} type=${activity.type} text=${(activity.text ?? '').substring(0, 100)}`
    );

    const emitter = pendingReplies.get(conversationId);
    if (emitter) {
      if (activity.type === 'message' && activity.text) {
        emitter.emit('text', activity.text);
      }
      if (activity.type === 'typing') {
        emitter.emit('typing');
      }
      // Check for end-of-turn indicators
      if (
        activity.type === 'message' &&
        activity.text &&
        !activity.inputHint?.includes('expecting')
      ) {
        // Delay slightly to allow any final activities
        setTimeout(() => emitter.emit('done'), 500);
      }
    } else {
      console.log(
        `[agent-callback] No listener for conversation ${conversationId}`
      );
    }

    // Bot Framework expects 200 OK
    res.status(200).json({ id: `reply-${Date.now()}` });
  }
);

/**
 * Bot Framework also POSTs to /v3/conversations for creating conversations.
 * We acknowledge but don't need to do anything.
 */
agentCallbackRouter.post('/v3/conversations', (_req, res) => {
  res.status(200).json({ id: `conv-${Date.now()}` });
});

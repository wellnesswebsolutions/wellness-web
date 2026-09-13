// Follow-up reminders: a business opened its demo but nobody has heard back.
// Shared by the app (window.FollowUps) and the tests (require).
(function (root) {
  const FOLLOW_UP_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

  // Time of the first demo open since the team last followed up (ms), or
  // null. Counting from the first open means someone who keeps reopening
  // the demo still becomes due, rather than resetting the clock each time.
  function firstUnansweredOpen(p, view) {
    if (!view) return null;
    const since = p.followedUpAt ? new Date(p.followedUpAt).getTime() : 0;
    const opens = (view.opens || [view.last]).map(t => new Date(t).getTime()).filter(t => t > since);
    return opens.length ? Math.min(...opens) : null;
  }

  // Due when the business is still at "Demo sent" (no reply moved it on),
  // isn't paying, and that first unanswered open was 2+ days ago.
  function followUpDue(p, view, now = Date.now()) {
    if (p.pipelineStage !== 'demo_sent') return false;
    if (p.paymentStatus === 'paid' || p.paymentStatus === 'pending') return false;
    const first = firstUnansweredOpen(p, view);
    return first !== null && now - first >= FOLLOW_UP_AFTER_MS;
  }

  const api = { FOLLOW_UP_AFTER_MS, firstUnansweredOpen, followUpDue };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FollowUps = api;
})(this);

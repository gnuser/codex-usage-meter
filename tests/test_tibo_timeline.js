const assert = require("node:assert/strict");
const { accepts, parse } = require("../browser-extension/timeline-data.js");
const url = "https://x.com/i/api/graphql/abc/UserOriginalsTimeline?variables=";
assert(
  accepts(
    url + encodeURIComponent(JSON.stringify({ userId: "1953337039510003712" })),
  ),
);
for (const vars of [
  { userId: "other" },
  { userId: "1953337039510003712", cursor: "next" },
]) {
  assert(!accepts(url + encodeURIComponent(JSON.stringify(vars))));
}
assert(!accepts("https://x.com/i/api/graphql/abc/Inbox"));
for (const operation of ["UserRepliesTimeline", "UserTweetsAndReplies"]) {
  assert(
    !accepts(
      url.replace("UserOriginalsTimeline", operation) +
        encodeURIComponent(JSON.stringify({ userId: "1953337039510003712" })),
    ),
  );
}
function tweet(id, handle = "thsottiaux") {
  return {
    rest_id: String(id),
    core: { user_results: { result: { legacy: { screen_name: handle } } } },
    legacy: {
      full_text: "Post " + id,
      created_at: `Wed Sep 23 00:00:0${id} +0000 2026`,
    },
  };
}
const first = tweet(1);
first.quoted_status_result = { result: tweet(9) };
const repost = tweet(8);
repost.legacy.retweeted_status_result = { result: tweet(7) };
const long = tweet(3);
long.legacy.truncated = true;
long.note_tweet = {
  note_tweet_results: { result: { text: "Full long text" } },
};
const reply = tweet(4);
reply.legacy.in_reply_to_status_id_str = "123";
const selfReply = tweet(5);
selfReply.legacy.in_reply_to_user_id_str = "1953337039510003712";
const result = parse({
  data: {
    entries: [
      reply,
      selfReply,
      first,
      tweet(2),
      long,
      tweet(5, "other"),
      repost,
      { type: "TimelinePinEntry", entry: tweet(6) },
    ],
  },
});
assert.equal(result.complete, true);
assert.deepEqual(
  result.posts.map((p) => p.id),
  ["3", "2", "1"],
);
assert.equal(result.posts[0].text, "Full long text");
assert.equal(result.posts[0].truncated, false);
assert.equal(parse({ errors: [] }).complete, false);
console.log(
  "Tibo timeline filtering, ownership, quotes, pinning and long text passed",
);

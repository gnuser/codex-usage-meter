/* Only public timeline responses for this account; never credentials or other APIs. */
const TiboTimeline = (() => {
  const ACCOUNT_ID = "1953337039510003712";
  function accepts(value) {
    try {
      const url = new URL(value, "https://x.com");
      const variables = JSON.parse(url.searchParams.get("variables") || "{}");
      return (
        url.origin === "https://x.com" &&
        /\/graphql\/[^/]+\/(?:UserTweets|UserOriginalsTimeline)$/.test(
          url.pathname,
        ) &&
        variables.userId === ACCOUNT_ID &&
        !variables.cursor
      );
    } catch {
      return false;
    }
  }
  function parse(data) {
    const found = new Map();
    let visited = 0;
    function walk(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 40 || ++visited > 30000)
        return;
      if (Array.isArray(node)) {
        node.forEach((value) => walk(value, depth + 1));
        return;
      }
      if (node.type === "TimelinePinEntry") return;
      const legacy = node.legacy;
      const user = node.core?.user_results?.result;
      const handle = user?.legacy?.screen_name || user?.core?.screen_name;
      if (legacy?.full_text && /^\d+$/.test(node.rest_id || "")) {
        if (
          handle?.toLowerCase() === "thsottiaux" &&
          !legacy.retweeted_status_result &&
          !legacy.in_reply_to_status_id_str &&
          !legacy.in_reply_to_status_id &&
          !legacy.in_reply_to_user_id_str &&
          !legacy.in_reply_to_user_id &&
          !/^RT @/i.test(legacy.full_text)
        ) {
          const text =
            node.note_tweet?.note_tweet_results?.result?.text ||
            legacy.full_text;
          const publishedAt = Date.parse(legacy.created_at) / 1000;
          if (Number.isFinite(publishedAt))
            found.set(node.rest_id, {
              id: node.rest_id,
              text,
              publishedAt,
              truncated:
                !!legacy.truncated &&
                !node.note_tweet?.note_tweet_results?.result?.text,
            });
        }
        // Do not descend into quoted or reposted tweets, including self-quotes.
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (!["quoted_status_result", "retweeted_status_result"].includes(key))
          walk(value, depth + 1);
      }
    }
    walk(data);
    const posts = [...found.values()]
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 3);
    return { posts, complete: posts.length === 3 };
  }
  return { accepts, parse };
})();
if (typeof module !== "undefined") module.exports = TiboTimeline;

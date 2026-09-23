"""Conservative, local rules over public posts; never confirms account-level resets."""
import re
import time

RESET = re.compile(r'\breset(?:s|ting)?\b', re.I)
TIME = re.compile(r'\b(?:tomorrow|today|tonight|soon|this week|next week|(?:on |for )?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|in \d+ (?:minutes?|hours?|days?)|at \d{1,2}:\d{2}(?:\s*(?:UTC|GMT|PST|PDT|EST|EDT))?)\b', re.I)
NEGATIVE = re.compile(r"\b(?:not|never|no|won't|can't|cancelled|canceled|delayed|postponed)\b", re.I)
PLANNED = re.compile(r"\b(?:we|i)(?:\s+(?:will|shall)|['’]ll|\s+(?:have\s+)?promised)\b.{0,100}\breset", re.I)
UNCERTAIN = re.compile(r'\b(?:maybe|might|could|hopefully|hope|if|consider)\b', re.I)
OTHER_RESET = re.compile(r'\b(?:password|git|branch|router|database|factory|device|phone)\b', re.I)
DONE = re.compile(r'\b(?:we|i)\s+(?:(?:have|just|already)\s+){0,3}(?:reset|granted|issued)\b|\bwe are (?:loading|granting|issuing)\b', re.I)


def assess(posts, now=None):
    now = time.time() if now is None else now
    unknown = {'state': 'unknown', 'label': '无明确重置信号', 'timeHint': '时间未知',
               'reason': '仅按来源最近三条原文做规则判断，不代表账号已获重置。', 'postId': None}
    for post in posts[:3]:
        if not 0 <= now - post['publishedAt'] <= 72 * 3600:
            continue
        text = post['text'].replace('\n', ' ')
        sentences = re.split(r'(?<=[.!?])\s+', text)
        relevant = [s for s in sentences if RESET.search(s)]
        if not relevant:
            continue
        # Negation/questions may contradict earlier posts; do not promote an old promise.
        if any(NEGATIVE.search(s) or '?' in s for s in relevant):
            return dict(unknown, reason='最近相关发言含否定、延期或疑问，无法可靠预测。', postId=post['id'])
        evidence = ' '.join(relevant)
        if OTHER_RESET.search(evidence):
            continue
        uncertain = bool(UNCERTAIN.search(evidence))
        if not uncertain and DONE.search(evidence) and (re.search(r'\b(?:codex|usage|limits?|banked|accounts?)\b', text, re.I)):
            return dict(unknown, state='reported', label='作者称已重置/正在发放',
                        reason='公开发言不等于你的账号已经收到；以额度接口为准。', postId=post['id'])
        if not uncertain and PLANNED.search(evidence):
            state, label = 'announced', '作者预告重置'
        else:
            state, label = 'possible', '可能信号 · 未证实'
        when = TIME.findall(evidence)
        return dict(unknown, state=state, label=label, postId=post['id'],
                    timeHint=('原文：' + ' / '.join(when) + '（仅引用原文，未换算时间）') if when else '时间未知',
                    reason='仅原文规则推测；不生成概率，不推算未经公布的具体日期。')
    return unknown

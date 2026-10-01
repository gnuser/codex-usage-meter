(() => {
  'use strict';
  const installMessages = {
    en: 'Install Codex Usage Meter by following this skill: https://raw.githubusercontent.com/gnuser/codex-usage-meter/main/skills/install-usage-meter/SKILL.md',
    zh: '请按照这个技能的说明安装 Codex Usage Meter：https://raw.githubusercontent.com/gnuser/codex-usage-meter/main/skills/install-usage-meter/SKILL.md'
  };
  const zh = {
    skip: '跳到正文', nav: '主导航', navFeatures: '功能', navDemo: '演示', navFaq: '常见问题', getFree: '免费安装 ↗',
    heroLabel: '免费工具 · 支持 MACOS + WINDOWS', heroLineOne: '看清你的', heroLineTwo: 'Codex 用量。',
    heroDescription: '额度、会话和每日用量，就在 Codex 侧栏。悬停即可查看，点击即可固定。',
    installFree: '免费安装', watchDemo: '观看 27 秒演示', heroNote: '免费使用，源码公开。',
    detailOneLabel: '就在工作区', detailOne: '一个小巧的侧栏助手', detailTwoLabel: '在你的电脑上', detailTwo: '本地读取会话日志',
    previewTitle: '用量，一眼看清。', previewTag: 'CODEX 内', previewAlt: 'Codex 侧栏用量面板：周余量、每日 token 图表、会话输入、输出与缓存用量。图中数值为演示数据。', previewCaption: '实际组件 · 演示数据',
    featuresLabel: '更清楚地了解用量', featuresTitle: '常看的数字，放在一起。', featuresDescription: '用一个紧凑面板，了解额度和 token 都用在了哪里。',
    featureOneTitle: '掌握额度与重置时间。', featureOneBody: '查看本周剩余额度、重置倒计时和可用重置次数。',
    featureTwoTitle: '找到用量较高的会话。', featureTwoBody: '比较活跃会话的输入、输出和缓存 token，展开查看各模型的用量。',
    featureThreeTitle: '回顾最近七天。', featureThreeBody: '通过柱状图查看每日 token，悬停显示当天的具体用量。',
    measurementNote: 'Token 数量与订阅额度是不同的计量方式。缺失数据保持未知，账户报告可能存在延迟。',
    demoTitle: '演示',
    videoLabel: 'Codex Usage Meter 产品演示', videoCaption: '演示数据', downloadVideo: '下载视频',
    installLabel: '开始使用', installTitle: '让 Codex 帮你安装。', installDescription: '把这段话复制到 Codex 对话中。它会按照项目安装说明，为你的用户账户配置启动器。',
    requirementsTitle: '开始前需要准备', requirementsBody: 'macOS 或 Windows 上的 Codex 桌面版、Python 3.10+、Node.js 24+。在 macOS 上，如果 Codex 附带的 Node 环境可用，安装器可以直接使用。',
    manualLabel: '想手动安装？', manualLink: '查看安装指南 ↗', copyTitle: '复制，然后粘贴到 Codex。', copyButton: '复制安装指令',
    launchTitle: '打开新启动器。', launchBody: '安装完成后，正常退出 Codex，再打开 Mac 应用程序目录或 Windows 桌面上的「Codex Usage Meter」。',
    hoverTitle: '悬停查看，点击固定。', hoverBody: '找到侧栏圆环，悬停即可查看用量，点击让面板保持展开。',
    releaseLink: '也可以前往 GitHub 下载最新 ZIP', releaseNote: '选择 CodexUsageMeter.zip。解压后，打开 Install.command（Mac）或 Install.cmd（Windows）。',
    compatibilityTitle: '兼容性说明。', compatibilityBody: '启动器会开启本地调试端口，请勿对外暴露或转发。Codex 更新可能影响兼容性。这是源码安装包，并非已签名的独立应用。', compatibilityLink: '查看安装细节 ↗',
    faqLabel: '安装前，了解这些', faqTitle: '开始前的小提示。', feedbackLink: '有建议？到 GitHub 反馈 ↗',
    faqOneQuestion: '可以免费使用吗？', faqOneAnswer: '可以。Codex Usage Meter 免费使用，源码在 GitHub 公开。它不会增加额度，也不会改变你的 Codex 订阅。',
    faqThreeQuestion: '数据从哪里来？', faqThreeAnswer: '会话日志在本地读取；账户额度和每日汇总来自 Codex 账户接口。可展开的重置资讯使用公开信息源，不会向该信息源发送会话或账户数据。',
    faqFourQuestion: 'Token 越多，就一定消耗更多额度吗？', faqFourAnswer: 'Token 数量和订阅额度是不同指标。会话 token 用于理解使用情况，账户额度用于查看剩余限额。工具不会把 token 换算成精确的额度消耗或美元费用。',
    faqFiveQuestion: '侧栏没有显示圆环怎么办？', faqFiveAnswer: '正常退出 Codex，然后通过 Codex Usage Meter 启动器重新打开。请先停止旧版侧栏服务。如果 Codex 刚刚更新，工具也可能需要更新适配。', troubleshootingLink: '查看使用与排错说明 ↗',
    faqSixQuestion: '可以恢复普通方式启动 Codex 吗？', faqSixAnswer: '可以。退出 Codex 后，用原来的应用图标打开，即可在不开启调试端口的情况下运行。安装不会修改已有会话日志。如需同时停止配套服务，请参阅使用指南。',
    closingLabel: '小工具，更清楚的用量', closingTitle: '把用量，放在手边。', footerNav: '项目链接', footerReleases: '版本下载 ↗', footerGuide: '使用指南 ↗'
  };
  const translations = {en: {}, zh};
  const textNodes = [...document.querySelectorAll('[data-i18n]')];
  const ariaNodes = [...document.querySelectorAll('[data-i18n-aria]')];
  const altNodes = [...document.querySelectorAll('[data-i18n-alt]')];
  for (const element of textNodes) translations.en[element.dataset.i18n] = element.textContent;
  for (const element of ariaNodes) translations.en[element.dataset.i18nAria] = element.getAttribute('aria-label');
  for (const element of altNodes) translations.en[element.dataset.i18nAlt] = element.alt;
  const languageButton = document.getElementById('language-switch');
  const copyButton = document.getElementById('copy-prompt');
  const prompt = document.getElementById('install-prompt');
  const status = document.getElementById('copy-status');
  let language = 'en';
  let statusTimer;
  let copyInProgress = false;

  function setLanguage(next) {
    language = next === 'zh' ? 'zh' : 'en';
    const dictionary = translations[language];
    for (const element of textNodes) element.textContent = dictionary[element.dataset.i18n] ?? translations.en[element.dataset.i18n];
    for (const element of ariaNodes) element.setAttribute('aria-label', dictionary[element.dataset.i18nAria]);
    for (const element of altNodes) element.alt = dictionary[element.dataset.i18nAlt];
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = language === 'zh' ? 'Codex Usage Meter — 看清你的 Codex 用量' : 'Codex Usage Meter — Know where your tokens go';
    const description = language === 'zh' ? '免费的 Codex 侧栏助手，查看额度、会话 token、缓存用量和每日使用情况。支持 macOS 与 Windows。' : 'A free sidebar companion for Codex. See account limits, per-chat tokens, cache usage, and daily activity on macOS and Windows.';
    document.querySelector('meta[name="description"]').content = description;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = description;
    languageButton.textContent = language === 'zh' ? 'EN' : '中文';
    languageButton.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到简体中文');
    prompt.value = installMessages[language];
    for (const link of document.querySelectorAll('[data-doc]')) link.href = `https://github.com/gnuser/codex-usage-meter/blob/main/docs/${link.dataset.doc}${language === 'zh' ? '.zh-CN' : ''}.md`;
    clearTimeout(statusTimer);
    status.textContent = '';
  }

  let savedLanguage;
  try { savedLanguage = localStorage.getItem('codex-meter-language'); } catch { /* Storage may be unavailable. */ }
  const queryLanguage = new URLSearchParams(location.search).get('lang');
  setLanguage(['en', 'zh'].includes(queryLanguage) ? queryLanguage : savedLanguage);
  languageButton.hidden = false;

  languageButton.addEventListener('click', () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
    try { localStorage.setItem('codex-meter-language', language); } catch { /* The page works without persistence. */ }
    try {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(null, '', url);
    } catch { /* Language switching also works in local file previews. */ }
  });

  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    if (copyInProgress) return;
    copyInProgress = true;
    copyButton.disabled = true;
    const text = prompt.value;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch { /* Fall back to selecting the visible message. */ }
    if (!copied) {
      prompt.focus();
      prompt.select();
      try { copied = document.execCommand('copy'); } catch { /* Leave the text selected for manual copying. */ }
    }
    clearTimeout(statusTimer);
    status.textContent = copied ? (language === 'zh' ? '已复制，粘贴到 Codex 即可。' : 'Copied. Paste it into Codex.') : (language === 'zh' ? '文字已选中，请手动复制。' : 'Text selected. Copy it manually.');
    copyButton.disabled = false;
    copyInProgress = false;
    if (copied) {
      copyButton.focus({preventScroll: true});
      statusTimer = setTimeout(() => { status.textContent = ''; }, 7000);
    }
  });
})();

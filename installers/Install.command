#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
print 'Codex Usage Meter — sidebar installer'
print 'Requires Python 3.10+, Node.js 24+, and Codex.'
print 'The launcher opens Codex with a local debugging endpoint; keep that endpoint private.'
python3 installers/install_sidebar.py
read -r '?Press Enter to close.'

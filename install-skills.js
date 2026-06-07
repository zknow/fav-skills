#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const os = require('os');

// 美化終端輸出的 ANSI 轉義字元
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  bgBlue: '\x1b[44m',
  white: '\x1b[37m'
};

const JSON_FILE = path.join(__dirname, 'favorite_skills.json');
const MD_FILE = path.join(__dirname, 'favorite_skills.md');

// 預設目錄對照表 (備用降級方案)
const defaultAgentPaths = {
  'Claude Code': { project: '.claude/skills', global: '.claude/skills' },
  'GitHub Copilot': { project: '.github/skills', global: '.copilot/skills' },
  'Google Antigravity': { project: '.agents/skills', global: '.gemini/config/skills' },
  'Cursor': { project: '.cursor/skills', global: '.cursor/skills' },
  'OpenCode': { project: '.opencode/skill', global: '.config/opencode/skill' },
  'OpenAI Codex': { project: '.codex/skills', global: '.codex/skills' },
  'Windsurf': { project: '.windsurf/skills', global: '.codeium/windsurf/skills' }
};

const CONFIG_FILE = path.join(__dirname, 'skills_path_map.json');
let agentPaths = defaultAgentPaths;

try {
  if (fs.existsSync(CONFIG_FILE)) {
    agentPaths = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }
} catch (err) {
  console.warn(`${colors.yellow}讀取設定檔 skills_path_map.json 失敗，使用內建預設值。${colors.reset}`);
}

// 自動將 favorite_skills.json 的內容同步/生成 favorite_skills.md
function syncMarkdown() {
  if (!fs.existsSync(JSON_FILE)) return;

  try {
    const rawData = fs.readFileSync(JSON_FILE, 'utf-8');
    const repos = JSON.parse(rawData);

    let mdContent = `# 技能庫清單\n\n`;
    mdContent += `| Category (分類) | Repo Name | GitHub Path | Fav Skills | 特色總結 (最受知名的 Skill 功能) |\n`;
    mdContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const repo of repos) {
      const match = repo.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      const displayName = match ? match[1] : repo.repoName;
      const pathCol = `[${displayName}](${repo.repoUrl})`;

      const skillsCol = repo.skills.map(skill => {
        return `[[\`${skill.name}\`](${skill.url})]`;
      }).join(' ');

      const categoryVal = repo.category || 'Coding';
      mdContent += `| ${categoryVal} | **${repo.repoName}** | ${pathCol} | ${skillsCol} | ${repo.summary} |\n`;
    }
    
    mdContent += `\n`;

    fs.writeFileSync(MD_FILE, mdContent, 'utf-8');
  } catch (err) {
    console.warn(`${colors.yellow}自動同步 favorite_skills.md 失敗：${err.message}${colors.reset}`);
  }
}

// 從 favorite_skills.json 讀取技能清單
function parseSkills() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`${colors.red}找不到 ${JSON_FILE} 文件！${colors.reset}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(JSON_FILE, 'utf-8');
    const repos = JSON.parse(rawData);
    const skillsList = [];

    for (const repo of repos) {
      for (const skill of repo.skills) {
        skillsList.push({
          repoName: repo.repoName,
          skillName: skill.name,
          githubUrl: skill.url
        });
      }
    }

    return skillsList;
  } catch (err) {
    console.error(`${colors.red}解析 ${JSON_FILE} 失敗！原因: ${err.message}${colors.reset}`);
    process.exit(1);
  }
}

// 解析 GitHub URL 取得 owner, repo, branch, path
function parseGithubUrl(githubUrl) {
  const url = githubUrl.trim();
  const regex = /github\.com\/([^/]+)\/([^/]+)(?:\/(tree|blob)\/([^/]+)\/(.+))?/;
  const match = url.match(regex);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  const type = match[3] || null;
  const branch = match[4] || 'main';
  let fullPath = match[5] || '';

  // 如果連結是單一檔案（blob 格式，例如末尾是 SKILL.md），提取父級目錄路徑以利下載整個資料夾
  if (type === 'blob') {
    const parts = fullPath.split('/');
    if (parts.length > 1) {
      fullPath = parts.slice(0, -1).join('/');
    }
  }

  return { owner, repo, branch, path: fullPath };
}

// 將 GitHub 網頁網址轉換成原始 raw 內容網址 (用於降級方案)
function getRawUrl(githubUrl) {
  let url = githubUrl.trim();
  
  if (url.includes('/tree/')) {
    url = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/tree/', '/');
    if (!url.endsWith('/SKILL.md') && !url.endsWith('/skill.json')) {
      url = url.endsWith('/') ? url + 'SKILL.md' : url + '/SKILL.md';
    }
  } else if (url.includes('/blob/')) {
    url = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }
  
  return url;
}

// 零依賴的 HTTPS GET 下載函式
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`下載失敗，HTTP 狀態碼: ${res.statusCode}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 請求 GitHub API 回傳 JSON 資料
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`API 請求失敗: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 選擇要安裝的技能 (TUI 多選畫面)
async function selectSkills() {
  const skills = parseSkills();

  if (skills.length === 0) {
    console.log(`${colors.yellow}目前沒有在清單中找到任何有效的 Fav Skills！${colors.reset}`);
    process.exit(0);
  }

  // 建構選單項目清單 (加入「全選 / 取消全選」虛擬項目在最頂部)
  const listItems = [
    { isSelectAll: true, skillName: '全選 / 取消全選', selected: true },
    ...skills.map(s => ({ ...s, selected: true })) // 預設全部勾選
  ];

  let cursorIndex = 0;

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // 隱藏游標
  process.stdout.write('\x1b[?25l');

  function render() {
    console.clear();
    console.log(`${colors.bgBlue}${colors.white}${colors.bold}   AI Agent Skills 安裝小助手 (TUI)   ${colors.reset}\n`);
    
    console.log(`${colors.green}已成功解析 favorite_skills.json，共讀取到 ${skills.length} 個技能：${colors.reset}`);
    skills.forEach(s => {
      console.log(` - ${colors.bold}${s.skillName}${colors.reset} ${colors.gray}(來自: ${s.repoName})${colors.reset}`);
    });
    
    console.log(`\n------------------------------------------------------------------`);
    console.log(`使用 ${colors.bold}↑ / ↓${colors.reset} 移動，${colors.bold}[空白鍵]${colors.reset} 勾選/取消，${colors.bold}[Enter]${colors.reset} 確認並繼續，${colors.bold}[Esc]${colors.reset} 離開。\n`);
    console.log(`${colors.cyan}--- 互動式多選安裝選單 ---${colors.reset}`);

    listItems.forEach((item, idx) => {
      const isCursor = idx === cursorIndex;
      const checkbox = item.selected ? `[${colors.green}✔${colors.reset}]` : '[ ]';
      const cursor = isCursor ? `${colors.cyan}➔${colors.reset}` : ' ';
      
      if (item.isSelectAll) {
        console.log(`${cursor} ${checkbox} ${colors.yellow}${colors.bold}${item.skillName}${colors.reset}`);
      } else {
        console.log(`${cursor} ${checkbox} ${colors.bold}${item.skillName}${colors.reset} ${colors.gray}(來自: ${item.repoName})${colors.reset}`);
      }
    });

    console.log('\n');
  }

  render();

  return new Promise((resolve) => {
    const onKeypress = (str, key) => {
      if (key.name === 'up') {
        cursorIndex = (cursorIndex - 1 + listItems.length) % listItems.length;
        render();
      } else if (key.name === 'down') {
        cursorIndex = (cursorIndex + 1) % listItems.length;
        render();
      } else if (key.name === 'space') {
        const currentItem = listItems[cursorIndex];
        if (currentItem.isSelectAll) {
          const targetState = !currentItem.selected;
          listItems.forEach(item => item.selected = targetState);
        } else {
          currentItem.selected = !currentItem.selected;
          const allRealSelected = listItems.slice(1).every(item => item.selected);
          listItems[0].selected = allRealSelected;
        }
        render();
      } else if (key.name === 'return') {
        cleanup();
        const finalSelected = listItems.slice(1).filter(item => item.selected);
        resolve(finalSelected);
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        console.log('取消操作。');
        process.exit(0);
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdout.write('\x1b[?25h');
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

// 通用的單選 TUI 菜單
async function selectOne(title, choices) {
  let cursorIndex = 0;
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdout.write('\x1b[?25l');

  function render() {
    console.clear();
    console.log(`${colors.bgBlue}${colors.white}${colors.bold}   ${title}   ${colors.reset}\n`);
    console.log(`使用 ${colors.bold}↑ / ↓${colors.reset} 移動，${colors.bold}[Enter]${colors.reset} 確認選擇，${colors.bold}[Esc]${colors.reset} 離開。\n`);
    
    choices.forEach((choice, idx) => {
      const isCursor = idx === cursorIndex;
      const cursor = isCursor ? `${colors.cyan}➔${colors.reset}` : ' ';
      const text = isCursor ? `${colors.cyan}${colors.bold}${choice.name}${colors.reset}` : choice.name;
      console.log(`${cursor} ${text}`);
    });
    console.log('\n');
  }

  render();

  return new Promise((resolve) => {
    const onKeypress = (str, key) => {
      if (key.name === 'up') {
        cursorIndex = (cursorIndex - 1 + choices.length) % choices.length;
        render();
      } else if (key.name === 'down') {
        cursorIndex = (cursorIndex + 1) % choices.length;
        render();
      } else if (key.name === 'return') {
        cleanup();
        resolve(choices[cursorIndex]);
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        console.log('取消操作。');
        process.exit(0);
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdout.write('\x1b[?25h');
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

// 詢問使用者自定義路徑
function askCustomPath() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`\n請輸入自定義的技能目錄路徑: `, (answer) => {
      rl.close();
      let targetPath = answer.trim();
      if (targetPath.startsWith('~')) {
        targetPath = path.join(os.homedir(), targetPath.slice(1));
      }
      resolve(targetPath);
    });
  });
}

// 主程式流程
async function main() {
  // 自動同步更新 Markdown 檔案表格，保持文檔最新狀態
  syncMarkdown();

  const workspaceBase = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

  // 1. 選擇技能
  const selectedSkills = await selectSkills();
  if (selectedSkills.length === 0) {
    console.log(`${colors.yellow}未選擇任何技能，程式結束。${colors.reset}`);
    process.exit(0);
  }

  // 2. 選擇 Scope (專案 vs 全域)
  const scopeChoice = await selectOne('步驟二：選擇安裝範圍 (Scope)', [
    { name: `專案目錄 (Project Scope) - 安裝於: ${workspaceBase}`, value: 'project' },
    { name: `使用者全域目錄 (Global Scope) - 安裝於: ${os.homedir()}`, value: 'global' }
  ]);

  // 3. 選擇 Agent/Tool
  const agentChoice = await selectOne('步驟三：選擇目標 AI Agent / 工具', [
    { name: 'Claude Code', value: 'Claude Code' },
    { name: 'GitHub Copilot', value: 'GitHub Copilot' },
    { name: 'Google Antigravity (agy)', value: 'Google Antigravity' },
    { name: 'Cursor', value: 'Cursor' },
    { name: 'OpenCode', value: 'OpenCode' },
    { name: 'OpenAI Codex', value: 'OpenAI Codex' },
    { name: 'Windsurf', value: 'Windsurf' },
    { name: '自定義路徑 (Custom Path)', value: 'custom' }
  ]);

  // 4. 計算路徑
  let targetDir = '';
  if (agentChoice.value === 'custom') {
    targetDir = await askCustomPath();
  } else {
    const rawPath = agentPaths[agentChoice.value][scopeChoice.value];
    
    // 解析家目錄 ~ 符號
    if (rawPath.startsWith('~')) {
      const relativePart = rawPath.slice(1).replace(/^[/\\]+/, ''); // 移除開頭的斜線
      targetDir = path.join(os.homedir(), relativePart);
    } else {
      if (scopeChoice.value === 'project') {
        targetDir = path.join(workspaceBase, rawPath);
      } else {
        targetDir = path.join(os.homedir(), rawPath);
      }
    }
  }

  if (!targetDir) {
    console.log(`${colors.red}路徑計算錯誤！程式終止。${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}正在準備安裝至: ${colors.bold}${targetDir}${colors.reset}...`);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`${colors.gray}建立了目錄 ${targetDir}${colors.reset}`);
  }

  for (const skill of selectedSkills) {
    const skillDir = path.join(targetDir, skill.skillName);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    process.stdout.write(`下載中 ${colors.bold}${skill.skillName}${colors.reset} ... `);

    const parsed = parseGithubUrl(skill.githubUrl);
    if (parsed) {
      // 嘗試透過 GitHub Contents API 下載整個目錄中的所有檔案
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${parsed.path}?ref=${parsed.branch}`;
      
      try {
        const contents = await fetchJson(apiUrl);
        if (Array.isArray(contents)) {
          const files = contents.filter(item => item.type === 'file');
          for (const file of files) {
            const destFile = path.join(skillDir, file.name);
            await downloadFile(file.download_url, destFile);
          }
          console.log(`${colors.green}成功！ (共下載了 ${files.length} 個檔案)${colors.reset}`);
          continue;
        } else if (contents && contents.type === 'file') {
          const destFile = path.join(skillDir, contents.name);
          await downloadFile(contents.download_url, destFile);
          console.log(`${colors.green}成功！ (單一檔案)${colors.reset}`);
          continue;
        }
      } catch (apiErr) {
        // API 失敗 (如 Rate Limit 等) 時，繼續往下執行降級方案
      }
    }

    // 降級方案：直接嘗試下載單一 SKILL.md 檔案
    try {
      const rawUrl = getRawUrl(skill.githubUrl);
      const destFile = path.join(skillDir, 'SKILL.md');
      await downloadFile(rawUrl, destFile);
      console.log(`${colors.green}成功！ (唯讀 SKILL.md 備用下載)${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}失敗！ (原因: ${err.message})${colors.reset}`);
    }
  }

  console.log(`\n${colors.green}${colors.bold}🎉 所有選定的技能已成功部署至目標目錄！${colors.reset}\n`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as readline from 'readline';

const COOKIES_PATH = 'cookies.json';

// 创建一个 readline 接口用于读取用户输入
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 暂停执行，等待用户在控制台按回车键
 * @param query - 显示给用户的提示信息
 * @returns 一个在用户按键后解析的 Promise
 */
function pressEnterToContinue(query: string): Promise<void> {
  return new Promise(resolve => rl.question(query, () => {
    rl.close();
    resolve();
  }));
}

/**
 * 主函数：处理登录并保存 cookies
 */
async function loginAndSaveCookies() {
  console.log('正在启动浏览器...');
  // 启动一个有头浏览器 (可以看到界面)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('正在导航到小红书...');
  await page.goto('https://www.xiaohongshu.com/explore');

  console.log(
    '\n============================================================\n' +
    '浏览器已打开，请在浏览器窗口中手动扫描二维码登录。\n' +
    '登录成功后，请回到此终端窗口，然后按 "Enter" 键继续...' +
    '\n============================================================\n'
  );

  // 等待用户手动登录并按回车
  await pressEnterToContinue('登录完成后请按 Enter 键: ');

  console.log('登录完成，正在保存 cookies...');
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));

  console.log(`Cookies 已成功保存到 ${COOKIES_PATH}`);
  
  await browser.close();
  console.log('浏览器已关闭。');
}

// 执行主函数
loginAndSaveCookies().catch(error => {
  console.error('爬虫执行出错:', error);
}); 
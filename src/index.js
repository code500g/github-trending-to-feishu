// src/index.js
import { fetchTrending } from "./trending.js";
import { writeTrendingToBitable } from "./feishu.js";

async function main() {
  try {
    console.log("开始抓取 GitHub Trending (Any, Today)...");
    const trending = await fetchTrending();
    console.log(`抓到 ${trending.length} 条仓库`);

    await writeTrendingToBitable(trending);

    console.log("同步完成 ✅");
  } catch (err) {
    console.error("运行出错：", err.message);
    process.exitCode = 1;
  }
}

main();

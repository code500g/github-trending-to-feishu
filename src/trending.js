// src/trending.js
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

const GITHUB_TRENDING_URL = "https://github.com/trending?since=daily";

// 可选：用 GitHub API 补全 star / fork
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

export async function fetchTrending() {
  console.log("开始抓取 GitHub Trending (Any, Today)...");

  const res = await axios.get(GITHUB_TRENDING_URL, {
    headers: {
      // 随便给个 UA，防止被当成机器人拦截
      "User-Agent": "github-trending-to-feishu"
    },
    timeout: 30000
  });

  const $ = cheerio.load(res.data);
  const repos = [];

  $("article").each((idx, el) => {
    const $el = $(el);

    // 仓库名 owner / repo
    const title = $el.find("h2 a").text().trim().replace(/\s/g, "");
    if (!title || !title.includes("/")) return;

    const [owner, name] = title.split("/");

    const description = $el
      .find("p")
      .first()
      .text()
      .trim();

    const language = $el
      .find('[itemprop="programmingLanguage"]')
      .text()
      .trim();

    // 今日新增 star
    const starsTodayText = $el
      .find("span")
      .filter((_, span) => $(span).text().includes("stars today"))
      .first()
      .text()
      .trim();

    let starsToday = 0;
    const m = starsTodayText.match(/([\d,]+)\s+stars\s+today/);
    if (m) {
      starsToday = parseInt(m[1].replace(/,/g, ""), 10) || 0;
    }

    const repoUrl = `https://github.com/${owner}/${name}`;

    repos.push({
      rank: idx + 1,
      owner,
      name,
      fullName: `${owner}/${name}`,
      description,
      language,
      starsToday,
      totalStars: 0, // 先占位，后面用 API 补
      forks: 0,       // 先占位，后面用 API 补
      repoUrl
    });
  });

  console.log(`抓到 ${repos.length} 条仓库`);

  const topRepos = repos.slice(0, 10);  // 只保留前 10 条

  // 再用 GitHub API 补全 totalStars & forks
  await enrichReposFromGithubApi(topRepos);

  return topRepos;
}

async function enrichReposFromGithubApi(repos) {
  for (const repo of repos) {
    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}`;

    try {
      const res = await axios.get(apiUrl, {
        headers: {
          "User-Agent": "github-trending-to-feishu",
          ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
        },
        timeout: 15000
      });

      const data = res.data;
      repo.totalStars = data.stargazers_count ?? 0;
      repo.forks = data.forks_count ?? 0;
    } catch (err) {
      // 出错就保持 0，不影响整体
      console.warn(
        `获取 ${repo.fullName} 详情失败，保持默认 0：`,
        err.response?.status || err.message
      );
    }
  }
}

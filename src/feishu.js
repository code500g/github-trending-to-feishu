// 调飞书多维表 API 写入记录

import axios from "axios";
import "dotenv/config.js";

const {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_BITABLE_APP_TOKEN,
  FEISHU_BITABLE_TABLE_ID,
} = process.env;

if (
  !FEISHU_APP_ID ||
  !FEISHU_APP_SECRET ||
  !FEISHU_BITABLE_APP_TOKEN ||
  !FEISHU_BITABLE_TABLE_ID
) {
  throw new Error(
    "缺少必要环境变量，请在 .env 中配置 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID"
  );
}

let cachedToken = null;
let cachedExpireAt = 0;

/**
 * 获取 tenant_access_token，带简单缓存
 */

async function getTenantAccessToken() {
  try {
    const res = await axios.post(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }
    );
    console.log("token res:", res.data); // 调试日志
    if (res.data.code !== 0) {
      throw new Error("get tenant_access_token failed: " + res.data.msg);
    }
    return res.data.tenant_access_token;
  } catch (err) {
    if (err.response) {
      console.error("Feishu HTTP error status:", err.response.status);
      console.error("Feishu HTTP error body:", err.response.data);
    } else {
      console.error("Feishu request error:", err.message);
    }
    throw err;
  }
}

/**
 * 把 GitHub Trending 的数组写入飞书多维表
 * @param {Array} records
 */
export async function writeTrendingToBitable(records) {
  if (!records.length) {
    console.log("没有 Trending 数据，不写入。");
    return;
  }

  const accessToken = await getTenantAccessToken();

  // 日期字段：用当天 00:00 的时间戳（毫秒）
  const today = new Date();
  const dateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dateTimestamp = dateOnly.getTime();

  const bitableRecords = records.map((r) => {
    const reason = `GitHub Trending 今日第 ${r.rank} 名，今日新增 Star ${r.starsToday}，总 Star ${r.totalStars}，Fork 数 ${r.forks}。`;

    return {
      fields: {
        日期: dateTimestamp,
        排名: r.rank,
        项目名称: r.fullName,
        描述: r.description,
        推荐理由: reason,
        作者: r.owner,
        GitHub链接: {
          text: r.fullName || r.repoUrl, // 显示在单元格里的文字
          link: r.repoUrl, // 点击后跳转的真实链接
        },
        //标签: [],
        主要语言: r.language || "",
        今日新增星标: r.starsToday,
        总星标数: r.totalStars,
        Fork数: r.forks,
        //追踪状态: "新增", // 注意：单选字段里必须先建立「新增」选项
      },
    };
  });

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records/batch_create`;

  try {
    const res = await axios.post(
      url,
      { records: bitableRecords },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        timeout: 30000,
      }
    );

    console.log("batch_create res:", res.data);

    if (res.data.code !== 0) {
      throw new Error(`write bitable failed: ${res.data.code} ${res.data.msg}`);
    }

    console.log(`已写入 ${records.length} 条记录到飞书多维表`);
  } catch (err) {
    if (err.response) {
      console.error("HTTP status:", err.response.status);
      console.error("HTTP body:", err.response.data);
    } else {
      console.error("Request error:", err.message);
    }
    throw err;
  }
}

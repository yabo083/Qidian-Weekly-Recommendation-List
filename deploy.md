# Vercel 部署指南

## 快速部署步骤

### 1. 准备工作

确保你的项目包含以下文件：
- ✅ `vercel.json` - Vercel配置文件
- ✅ `package.json` - 项目依赖配置
- ✅ `serverless-crawler.js` - 无服务器优化的爬虫
- ✅ `server.js` - Express服务器
- ✅ `public/index.html` - 前端界面

### 2. 方法一：通过Vercel CLI（推荐）

```bash
# 1. 安装Vercel CLI
npm i -g vercel

# 2. 登录到Vercel（会打开浏览器）
vercel login

# 3. 在项目目录中执行部署
vercel

# 4. 按照提示操作：
# - Link to existing project? [y/N] → N
# - What's your project's name? → qidian-ranking-crawler
# - In which directory is your code located? → ./
# - Override the settings? [y/N] → N

# 5. 部署完成后，Vercel会提供访问URL
```

### 3. 方法二：通过GitHub集成

```bash
# 1. 创建GitHub仓库并推送代码
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/qidian-ranking-crawler.git
git push -u origin main

# 2. 在Vercel控制台 (https://vercel.com) 中：
# - 点击 "New Project"
# - 导入你的GitHub仓库
# - 保持默认设置，点击 "Deploy"
```

## 部署后测试

部署完成后，访问以下URL测试功能：

- 主页：`https://你的域名.vercel.app`
- API测试：`https://你的域名.vercel.app/api/books`
- 数据刷新：`https://你的域名.vercel.app/api/refresh`

## 常见问题

### Q: 部署时出现依赖错误？
A: 确保运行过 `npm install @sparticuz/chromium puppeteer-core`

### Q: 爬虫超时？
A: Vercel免费版有10秒执行限制，代码已优化但可能需要多次尝试

### Q: 数据不准确？
A: 起点网站可能有反爬措施，系统会回退到备用数据源

### Q: 如何查看部署日志？
A: 在Vercel控制台的Functions标签页查看实时日志

## 环境变量配置

在Vercel控制台设置以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_ENV` | `production` | 启用生产环境优化 |

## 自定义域名

在Vercel控制台的Domains标签页可以配置自定义域名：
1. 点击 "Add Domain"
2. 输入你的域名
3. 按照DNS配置指南操作

## 成本说明

- **免费额度**：100GB带宽/月，100个无服务器函数调用/天
- **超出后**：按量计费，通常个人使用很难超出免费额度
- **推荐**：先使用免费版测试功能

## 技术细节

### 无服务器优化
- 使用 `@sparticuz/chromium` 替代完整Chrome
- 优化启动时间和内存使用
- 实现多重回退机制

### 限制说明
- 执行时间：10秒（免费版）
- 内存：1GB（免费版）
- 文件系统：只读（除tmp目录）

## 监控和维护

### 查看访问统计
Vercel控制台 → Analytics 标签页

### 查看错误日志
Vercel控制台 → Functions 标签页

### 更新部署
推送新代码到GitHub，或运行 `vercel --prod`

---

**注意**：首次部署可能需要几分钟时间，冷启动时爬虫可能较慢，这是正常现象。

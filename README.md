# 起点周推榜单分析工具

这是一个用于分析起点中文网周推荐排行榜的工具，可以自动爬取榜单数据并在前端界面中展示。

## 功能特性

- 🚀 自动爬取起点周推榜单页面
- 📖 获取书籍详细信息（书名、作者、周推荐数）
- 📊 横向条状图数据可视化展示，按周推荐数递减排序
- 🎨 Material Design 3 风格界面
- 💾 数据持久化存储
- 🔄 支持数据刷新
- ☁️ 支持Vercel无服务器部署

## 项目结构

```
qidian/
├── package.json          # 项目配置
├── vercel.json           # Vercel部署配置
├── server.js            # Express服务器
├── crawler.js           # Puppeteer爬虫模块
├── axios-crawler.js     # Axios爬虫模块
├── serverless-crawler.js # 无服务器环境爬虫
├── books_data.json      # 数据存储文件（运行后生成）
└── public/
    └── index.html       # Material Design 3 前端界面
```

## 本地开发

### 安装依赖

```bash
npm install
```

### 使用方法

#### 方法一：直接运行爬虫
```bash
npm run crawler    # 使用Puppeteer爬虫
npm run axios      # 使用Axios爬虫
```

#### 方法二：启动Web服务
```bash
npm start
```
然后在浏览器中访问 `http://localhost:3000`

## Vercel部署

### 1. 准备部署

确保项目根目录包含以下文件：
- `vercel.json` - Vercel配置文件
- `package.json` - 包含无服务器依赖
- `serverless-crawler.js` - 优化的无服务器爬虫

### 2. 部署到Vercel

#### 方法一：通过Vercel CLI
```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel
```

#### 方法二：通过Git集成
1. 将代码推送到GitHub仓库
2. 在Vercel控制台导入项目
3. Vercel会自动检测并部署

### 3. 环境变量

在Vercel控制台设置以下环境变量：
- `NODE_ENV=production`

### 4. 部署特点

- **无服务器**: 使用Vercel Functions，按需启动
- **优化的爬虫**: 专门为无服务器环境优化，减少冷启动时间
- **静态资源**: 前端文件作为静态资源部署
- **自动扩展**: 根据请求量自动扩展

## API 接口

- `GET /api/books` - 获取书籍数据
- `GET /api/refresh` - 重新爬取数据

## 技术栈

### 后端
- Node.js + Express
- Puppeteer (本地开发)
- Puppeteer-core + Chromium (无服务器)
- Axios + Cheerio (轻量级爬虫)

### 前端
- Material Design 3
- 原生HTML/CSS/JavaScript
- 横向条状图可视化
- 响应式设计

## 部署优化

### 无服务器优化
1. **移除user_data**: 不依赖本地存储
2. **优化超时**: 适应Vercel 10秒执行限制
3. **Chromium集成**: 使用@sparticuz/chromium
4. **回退机制**: Puppeteer失败时回退到Axios

### 性能优化
1. **减少爬取数量**: 适应无服务器时间限制
2. **缓存策略**: 数据文件缓存
3. **错误处理**: 完善的错误处理和回退机制

## 注意事项

1. 爬虫使用了延迟机制，避免频繁请求被反爬
2. 默认爬取前20本书的数据，可在代码中调整
3. 如果无法获取真实的周推荐数据，返回默认值0
4. 请遵守起点网站的robots.txt和使用条款
5. Vercel免费版有执行时间限制，大量数据爬取可能需要付费版

## 界面预览

- 📱 Material Design 3 风格
- 🎨 横向条状图展示推荐数据
- 📊 实时数据统计
- 🏆 排名显示和推荐数可视化
- 🔗 点击直达小说详情页

## 开发说明

如需修改爬虫逻辑，请编辑对应的爬虫文件中的选择器和数据提取逻辑。
如需修改界面样式，请编辑 `public/index.html` 中的CSS部分。

## License

MIT License - 仅供学习参考，非商业用途。

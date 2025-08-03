import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import QidianCrawler from './crawler.js';
import QidianAxiosCrawler from './axios-crawler.js';
import ServerlessQidianCrawler from './serverless-crawler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 设置静态文件目录
app.use(express.static('public'));

// API端点：获取书籍数据
app.get('/api/books', async (req, res) => {
    try {
        // 先尝试从文件读取数据
        if (fs.existsSync('books_data.json')) {
            const data = fs.readFileSync('books_data.json', 'utf8');
            const books = JSON.parse(data);
            res.json(books);
        } else {
            // 如果没有数据文件，启动爬虫
            console.log('没有找到数据文件，启动爬虫...');
            const crawler = new QidianCrawler();
            const books = await crawler.crawlAll();
            res.json(books);
        }
    } catch (error) {
        console.error('获取书籍数据失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// API端点：重新爬取数据
app.get('/api/refresh', async (req, res) => {
    try {
        console.log('开始重新爬取数据...');
        
        const isProduction = process.env.NODE_ENV === 'production';
        let books = [];
        
        if (isProduction) {
            // 生产环境使用无服务器爬虫
            console.log('使用无服务器爬虫...');
            try {
                const serverlessCrawler = new ServerlessQidianCrawler();
                books = await serverlessCrawler.crawlAll();
            } catch (error) {
                console.error('无服务器爬虫失败:', error);
                // 回退到axios爬虫
                const axiosCrawler = new QidianAxiosCrawler();
                books = await axiosCrawler.crawlAll();
            }
        } else {
            // 开发环境优先使用axios爬虫
            const axiosCrawler = new QidianAxiosCrawler();
            books = await axiosCrawler.crawlAll();
            
            // 如果axios爬虫失败，回退到puppeteer
            if (books.length === 0) {
                console.log('Axios爬虫失败，尝试使用Puppeteer爬虫...');
                const puppeteerCrawler = new QidianCrawler();
                books = await puppeteerCrawler.crawlAll();
            }
        }
        
        // 保存数据到文件（如果在文件系统可写的环境中）
        try {
            fs.writeFileSync('books_data.json', JSON.stringify(books, null, 2), 'utf8');
            console.log('数据已保存到 books_data.json');
        } catch (error) {
            console.log('无法写入文件系统，数据仅在内存中保存');
        }
        
        res.json({ message: '数据更新成功', count: books.length, books: books });
    } catch (error) {
        console.error('刷新数据失败:', error);
        res.status(500).json({ error: '刷新数据失败: ' + error.message });
    }
});

// 主页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('请在浏览器中访问查看起点周推榜单');
});

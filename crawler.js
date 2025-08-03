import puppeteer from 'puppeteer';
import fs from 'fs';

class QidianCrawler {
    constructor() {
        this.browser = null;
        this.page = null;
        this.books = [];
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: true,
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        this.page = await this.browser.newPage();
        
        // 设置更真实的User-Agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 设置额外的headers来模拟真实浏览器
        await this.page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });

        // 隐藏webdriver特征
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        // 设置viewport
        await this.page.setViewport({ width: 1366, height: 768 });
    }

    async getRankingList() {
        try {
            console.log('正在访问起点周推榜单页面...');
            
            // 首先访问起点首页，建立会话
            await this.page.goto('https://www.qidian.com/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // 等待几秒钟
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 再访问榜单页面
            await this.page.goto('https://www.qidian.com/rank/newsign/chn9/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // 等待页面加载
            await this.page.waitForSelector('.rank-view-list, .book-list', { timeout: 15000 });

            // 获取书籍ID列表 - 使用多种选择器尝试
            const bookIds = await this.page.evaluate(() => {
                // 尝试多种可能的选择器
                const selectors = [
                    '.rank-view-list .book-mid-info h2 a',
                    '.rank-view-list .book-info h2 a', 
                    '.book-list .book-mid-info h4 a',
                    '.book-list .book-info h4 a',
                    '.rank-view-list a[href*="/book/"]',
                    '.book-list a[href*="/book/"]'
                ];
                
                let bookElements = [];
                for (const selector of selectors) {
                    bookElements = document.querySelectorAll(selector);
                    if (bookElements.length > 0) {
                        console.log(`使用选择器: ${selector}, 找到 ${bookElements.length} 个元素`);
                        break;
                    }
                }
                
                if (bookElements.length === 0) {
                    console.log('未找到书籍链接，尝试获取所有包含book的链接');
                    bookElements = document.querySelectorAll('a[href*="/book/"]');
                }
                
                return Array.from(bookElements).map(link => {
                    const href = link.getAttribute('href');
                    const match = href.match(/\/book\/(\d+)/);
                    return match ? match[1] : null;
                }).filter(id => id !== null).slice(0, 20); // 爬取前20本书籍
            });

            console.log(`找到 ${bookIds.length} 本书籍`);
            return bookIds;
        } catch (error) {
            console.error('获取榜单失败:', error);
            return [];
        }
    }

    async getBookDetails(bookId) {
        try {
            const url = `https://www.qidian.com/book/${bookId}/`;
            console.log(`正在获取书籍详情: ${url}`);
            
            await this.page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // 等待页面元素加载，使用多种选择器
            try {
                await this.page.waitForSelector('.book-info, .book-information', { timeout: 10000 });
            } catch (e) {
                console.log('页面加载超时，尝试继续获取数据...');
            }

            const bookInfo = await this.page.evaluate((bookId) => {
                // 尝试多种选择器获取书名
                let bookName = '';
                const nameSelectors = [
                    '.book-info h1 em',
                    '.book-info h1',
                    '.book-information h1 em',
                    '.book-information h1',
                    'h1.book-title',
                    '.book-title'
                ];
                
                for (const selector of nameSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        bookName = element.textContent?.trim() || '';
                        if (bookName) break;
                    }
                }
                
                // 尝试多种选择器获取作者
                let author = '';
                const authorSelectors = [
                    '.book-info .writer',
                    '.book-information .writer', 
                    '.book-info .author',
                    '.author-name',
                    'a[href*="/free/"]'
                ];
                
                for (const selector of authorSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        author = element.textContent?.replace('作者：', '').trim() || '';
                        if (author) break;
                    }
                }
                
                // 重点：正确获取周推荐数据
                let weeklyRecommendation = 0;
                
                // 根据截图，周推荐数据在一个特定的结构中
                // 寻找包含"周推荐"文字的元素
                const recommendElements = document.querySelectorAll('*');
                for (let elem of recommendElements) {
                    const text = elem.textContent || '';
                    // 匹配 "数字+周推荐" 的模式，如 "211周推荐"
                    const weeklyMatch = text.match(/(\d+)周推荐/);
                    if (weeklyMatch) {
                        weeklyRecommendation = parseInt(weeklyMatch[1]);
                        console.log(`找到周推荐: ${weeklyRecommendation}`);
                        break;
                    }
                }
                
                // 如果上面的方法没找到，尝试其他可能的选择器
                if (weeklyRecommendation === 0) {
                    // 尝试在数据统计区域查找
                    const dataElements = document.querySelectorAll('.count em, .total em, .data-list em, .book-data em');
                    for (let elem of dataElements) {
                        const text = elem.textContent || '';
                        const numMatch = text.match(/(\d+)/);
                        if (numMatch) {
                            const num = parseInt(numMatch[1]);
                            // 假设周推荐数字通常在一定范围内
                            if (num > 10 && num < 100000) {
                                weeklyRecommendation = num;
                                break;
                            }
                        }
                    }
                }
                
                // 再次尝试：查找包含数字的span或em元素
                if (weeklyRecommendation === 0) {
                    const numberElements = document.querySelectorAll('span, em, div');
                    for (let elem of numberElements) {
                        const text = elem.textContent?.trim() || '';
                        // 检查是否是纯数字且在合理范围内
                        if (/^\d+$/.test(text)) {
                            const num = parseInt(text);
                            if (num > 50 && num < 50000) {
                                // 检查父元素或相邻元素是否有"推荐"相关文字
                                const parent = elem.parentElement;
                                const siblings = elem.parentElement?.children || [];
                                let hasRecommendText = false;
                                
                                // 检查父元素
                                if (parent && parent.textContent.includes('推荐')) {
                                    hasRecommendText = true;
                                }
                                
                                // 检查兄弟元素
                                for (let sibling of siblings) {
                                    if (sibling.textContent.includes('推荐')) {
                                        hasRecommendText = true;
                                        break;
                                    }
                                }
                                
                                if (hasRecommendText) {
                                    weeklyRecommendation = num;
                                    console.log(`通过上下文找到推荐数: ${weeklyRecommendation}`);
                                    break;
                                }
                            }
                        }
                    }
                }

                // 如果还是没找到，返回默认值0
                if (weeklyRecommendation === 0) {
                    console.log(`未找到周推荐数据，使用默认值: 0`);
                }

                return {
                    id: bookId,
                    name: bookName || `书籍${bookId}`,
                    author: author || '未知作者',
                    weeklyRecommendation: weeklyRecommendation
                };
            }, bookId);

            console.log(`获取书籍信息成功: ${bookInfo.name} - 作者: ${bookInfo.author} - 周推: ${bookInfo.weeklyRecommendation}`);
            return bookInfo;

        } catch (error) {
            console.error(`获取书籍 ${bookId} 详情失败:`, error);
            
            // 返回默认数据以防完全失败
            return {
                id: bookId,
                name: `书籍${bookId}`,
                author: '未知作者',
                weeklyRecommendation: 0
            };
        }
    }

    async crawlAll() {
        await this.init();
        
        try {
            // 获取书籍ID列表
            const bookIds = await this.getRankingList();
            
            if (bookIds.length === 0) {
                console.log('未获取到书籍列表');
                return [];
            }

            // 获取前20本书的详情
            const limitedIds = bookIds.slice(0, 20);
            
            for (const bookId of limitedIds) {
                const bookInfo = await this.getBookDetails(bookId);
                if (bookInfo) {
                    this.books.push(bookInfo);
                }
                
                // 添加延迟避免被反爬
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // 按周推荐数量降序排序
            this.books.sort((a, b) => b.weeklyRecommendation - a.weeklyRecommendation);

            // 保存数据到文件
            fs.writeFileSync('books_data.json', JSON.stringify(this.books, null, 2), 'utf8');
            console.log('数据已保存到 books_data.json');

            return this.books;

        } finally {
            await this.browser.close();
        }
    }
}

// 如果直接运行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const crawler = new QidianCrawler();
    crawler.crawlAll().then(books => {
        console.log('爬虫完成，共获取', books.length, '本书籍');
        console.log(books);
        process.exit(0);
    }).catch(error => {
        console.error('爬虫失败:', error);
        process.exit(1);
    });
}

export default QidianCrawler;

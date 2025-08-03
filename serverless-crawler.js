import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

class ServerlessQidianCrawler {
    constructor() {
        this.browser = null;
        this.page = null;
        this.books = [];
    }

    async init() {
        // Vercel/无服务器环境配置
        const isProduction = process.env.NODE_ENV === 'production';
        
        this.browser = await puppeteer.launch({
            args: isProduction ? chromium.args : [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: isProduction 
                ? await chromium.executablePath() 
                : process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            headless: chromium.headless || true,
            ignoreHTTPSErrors: true,
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

        await this.page.setViewport({ width: 1366, height: 768 });
    }

    async getRankingList() {
        try {
            console.log('正在访问起点周推榜单页面...');
            
            // 设置超时时间为较短时间，适应无服务器环境
            await this.page.goto('https://www.qidian.com/rank/newsign/chn9/', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // 等待页面加载
            await this.page.waitForSelector('.rank-view-list, .book-list', { timeout: 10000 });

            const bookIds = await this.page.evaluate(() => {
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
                        break;
                    }
                }
                
                if (bookElements.length === 0) {
                    bookElements = document.querySelectorAll('a[href*="/book/"]');
                }
                
                return Array.from(bookElements).map(link => {
                    const href = link.getAttribute('href');
                    const match = href.match(/\/book\/(\d+)/);
                    return match ? match[1] : null;
                }).filter(id => id !== null).slice(0, 20);
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
            console.log(`正在获取书籍详情: ${bookId}`);
            
            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // 简化等待逻辑
            try {
                await this.page.waitForSelector('.book-info, .book-information', { timeout: 8000 });
            } catch (e) {
                console.log('页面加载超时，尝试继续获取数据...');
            }

            const bookInfo = await this.page.evaluate((bookId) => {
                // 获取书名
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
                
                // 获取作者
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
                
                // 获取周推荐数据
                let weeklyRecommendation = 0;
                
                // 搜索包含"周推荐"的文本
                const recommendElements = document.querySelectorAll('*');
                for (let elem of recommendElements) {
                    const text = elem.textContent || '';
                    const weeklyMatch = text.match(/(\d+)周推荐/);
                    if (weeklyMatch) {
                        weeklyRecommendation = parseInt(weeklyMatch[1]);
                        break;
                    }
                }
                
                // 备用方法：查找数据统计区域
                if (weeklyRecommendation === 0) {
                    const dataElements = document.querySelectorAll('.count em, .total em, .data-list em, .book-data em');
                    for (let elem of dataElements) {
                        const text = elem.textContent || '';
                        const numMatch = text.match(/(\d+)/);
                        if (numMatch) {
                            const num = parseInt(numMatch[1]);
                            if (num > 10 && num < 100000) {
                                weeklyRecommendation = num;
                                break;
                            }
                        }
                    }
                }

                return {
                    id: bookId,
                    name: bookName || `书籍${bookId}`,
                    author: author || '未知作者',
                    weeklyRecommendation: weeklyRecommendation
                };
            }, bookId);

            console.log(`✅ ${bookInfo.name} - ${bookInfo.author} - 周推: ${bookInfo.weeklyRecommendation}`);
            return bookInfo;

        } catch (error) {
            console.error(`获取书籍 ${bookId} 详情失败:`, error);
            
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
            const bookIds = await this.getRankingList();
            
            if (bookIds.length === 0) {
                console.log('未获取到书籍列表');
                return [];
            }

            // 为了适应无服务器环境的时间限制，只获取前10本书
            const limitedIds = bookIds.slice(0, 10);
            
            for (const bookId of limitedIds) {
                const bookInfo = await this.getBookDetails(bookId);
                if (bookInfo) {
                    this.books.push(bookInfo);
                }
                
                // 减少延迟时间
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 按周推荐数量降序排序
            this.books.sort((a, b) => b.weeklyRecommendation - a.weeklyRecommendation);

            return this.books;

        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

export default ServerlessQidianCrawler;

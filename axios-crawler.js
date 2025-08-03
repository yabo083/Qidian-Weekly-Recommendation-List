import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

class QidianAxiosCrawler {
    constructor() {
        this.books = [];
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.qidian.com/',
        };
    }

    async getRankingList() {
        try {
            console.log('正在获取起点周推榜单...');
            const response = await axios.get('https://www.qidian.com/rank/newsign/chn9/', {
                headers: this.headers,
                timeout: 30000
            });

            const $ = cheerio.load(response.data);
            const bookIds = [];

            // 尝试多种选择器
            const selectors = [
                '.rank-view-list .book-mid-info h2 a',
                '.rank-view-list .book-info h2 a',
                '.book-list .book-mid-info h4 a',
                '.book-list .book-info h4 a',
                'a[href*="/book/"]'
            ];

            for (const selector of selectors) {
                $(selector).each((index, element) => {
                    const href = $(element).attr('href');
                    if (href) {
                        const match = href.match(/\/book\/(\d+)/);
                        if (match && bookIds.length < 20) {
                            bookIds.push(match[1]);
                        }
                    }
                });
                if (bookIds.length > 0) break;
            }

            console.log(`找到 ${bookIds.length} 本书籍ID`);
            return bookIds;
        } catch (error) {
            console.error('获取榜单失败:', error.message);
            return [];
        }
    }

    async getBookDetails(bookId) {
        try {
            const url = `https://www.qidian.com/book/${bookId}/`;
            console.log(`正在获取书籍详情: ${bookId}`);
            
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 30000
            });

            const $ = cheerio.load(response.data);

            // 获取书名
            let bookName = '';
            const nameSelectors = [
                '.book-info h1 em',
                '.book-info h1',
                'h1 em',
                'h1'
            ];
            
            for (const selector of nameSelectors) {
                const element = $(selector).first();
                if (element.length && element.text().trim()) {
                    bookName = element.text().trim();
                    break;
                }
            }

            // 获取作者
            let author = '';
            const authorSelectors = [
                '.book-info .writer',
                '.writer',
                'a[href*="/free/"]'
            ];
            
            for (const selector of authorSelectors) {
                const element = $(selector).first();
                if (element.length && element.text().trim()) {
                    author = element.text().replace('作者：', '').trim();
                    break;
                }
            }

            // 获取周推荐 - 关键部分
            let weeklyRecommendation = 0;
            
            // 方法1: 直接搜索包含"周推荐"的文本
            $('*').each((index, element) => {
                const text = $(element).text();
                const match = text.match(/(\d+)周推荐/);
                if (match) {
                    weeklyRecommendation = parseInt(match[1]);
                    return false; // 找到后停止循环
                }
            });

            // 方法2: 如果没找到，查找数据统计区域
            if (weeklyRecommendation === 0) {
                const dataSelectors = [
                    '.count em',
                    '.total em', 
                    '.data em',
                    '.book-data em',
                    'em'
                ];
                
                for (const selector of dataSelectors) {
                    $(selector).each((index, element) => {
                        const text = $(element).text().trim();
                        if (/^\d+$/.test(text)) {
                            const num = parseInt(text);
                            if (num > 50 && num < 50000) {
                                // 检查上下文是否包含推荐相关内容
                                const parent = $(element).parent();
                                const context = parent.text();
                                if (context.includes('推荐') || context.includes('周推')) {
                                    weeklyRecommendation = num;
                                    return false;
                                }
                            }
                        }
                    });
                    if (weeklyRecommendation > 0) break;
                }
            }

            // 方法3: 查找特定的HTML结构模式
            if (weeklyRecommendation === 0) {
                // 根据起点网站结构，周推荐通常在书籍统计信息中
                const statsArea = $('.book-data, .book-state, .book-info .cf');
                statsArea.find('em, span, strong').each((index, element) => {
                    const text = $(element).text().trim();
                    if (/^\d+$/.test(text)) {
                        const num = parseInt(text);
                        if (num > 10 && num < 10000) {
                            weeklyRecommendation = Math.max(weeklyRecommendation, num);
                        }
                    }
                });
            }

            // 如果仍然没找到，使用默认值0
            if (weeklyRecommendation === 0) {
                console.log(`未找到周推荐数据，使用默认值: 0`);
            }

            const bookInfo = {
                id: bookId,
                name: bookName || `书籍${bookId}`,
                author: author || '未知作者',
                weeklyRecommendation: weeklyRecommendation
            };

            console.log(`✅ ${bookInfo.name} - ${bookInfo.author} - 周推: ${bookInfo.weeklyRecommendation}`);
            return bookInfo;

        } catch (error) {
            console.error(`获取书籍 ${bookId} 详情失败:`, error.message);
            
            // 返回默认数据
            return {
                id: bookId,
                name: `书籍${bookId}`,
                author: '未知作者',
                weeklyRecommendation: 0
            };
        }
    }

    async crawlAll() {
        try {
            // 获取书籍ID列表
            const bookIds = await this.getRankingList();
            
            if (bookIds.length === 0) {
                console.log('❌ 未获取到书籍列表');
                return [];
            }

            console.log(`📚 开始获取 ${bookIds.length} 本书的详情...`);

            // 获取书籍详情
            for (const bookId of bookIds) {
                const bookInfo = await this.getBookDetails(bookId);
                if (bookInfo) {
                    this.books.push(bookInfo);
                }
                
                // 添加延迟避免请求过频
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // 按周推荐数量降序排序
            this.books.sort((a, b) => b.weeklyRecommendation - a.weeklyRecommendation);

            // 保存数据到文件
            fs.writeFileSync('books_data.json', JSON.stringify(this.books, null, 2), 'utf8');
            console.log('✅ 数据已保存到 books_data.json');

            return this.books;

        } catch (error) {
            console.error('❌ 爬取失败:', error);
            return [];
        }
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    const crawler = new QidianAxiosCrawler();
    crawler.crawlAll().then(books => {
        console.log('🎉 爬虫完成，共获取', books.length, '本书籍');
        books.forEach((book, index) => {
            console.log(`${index + 1}. ${book.name} - ${book.author} (周推: ${book.weeklyRecommendation})`);
        });
        process.exit(0);
    }).catch(error => {
        console.error('❌ 爬虫失败:', error);
        process.exit(1);
    });
}

export default QidianAxiosCrawler;

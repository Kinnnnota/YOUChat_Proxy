import ProviderManager from './provider.mjs';
import { EventEmitter } from 'events';
import SessionManager from './sessionManager.mjs';
import fs from 'fs';
import path from 'path';

async function runParallelTest() {
    // 创建日志文件
    const logFile = path.join(process.cwd(), 'parallel_test_logs', `test_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    
    // 确保日志目录存在
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    // 创建日志写入流
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // 日志写入函数
    const log = (message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage.trim());
        logStream.write(logMessage);
    };

    // 初始化 provider
    const providerManager = new ProviderManager();
    await providerManager.init();

    // 创建 SessionManager 实例
    const sessionManager = new SessionManager(providerManager.provider);
    const availableSessions = sessionManager.getAvailableSessions();

    if (availableSessions.length < 3) {
        log('可用会话数量不足3个，无法进行并行测试');
        log('当前可用会话数量: ' + availableSessions.length);
        log('可用会话: ' + JSON.stringify(availableSessions));
        logStream.end();
        return;
    }

    // 选择3个不同的会话
    const testSessions = availableSessions.slice(0, 3);
    log('使用以下会话进行测试: ' + JSON.stringify(testSessions));

    // 测试消息
    const testMessages = [
        { role: 'user', content: '你好，请简单自我介绍一下' },
        { role: 'user', content: '请用简短的话描述一下你的特点' },
        { role: 'user', content: '你能做些什么？请简要说明' }
    ];

    // 创建测试任务
    const tasks = testSessions.map((session, index) => {
        return async () => {
            log(`[Session ${index + 1}] 开始测试 (${session})`);
            
            try {
                const { completion } = await providerManager.getCompletion({
                    username: sessionManager.getUsernameFromSessionId(session),
                    messages: [testMessages[index]],
                    stream: true,
                    proxyModel: 'claude_3_5_sonnet'
                });

                return new Promise((resolve) => {
                    let response = '';

                    completion.on('start', (id) => {
                        log(`[Session ${index + 1}] 开始接收响应 (ID: ${id})`);
                    });

                    completion.on('completion', (id, text) => {
                        response += text;
                        const timestamp = new Date().toISOString();
                        logStream.write(`[${timestamp}] [Session ${index + 1}] ${text}`);
                    });

                    completion.on('end', () => {
                        log(`[Session ${index + 1}] 响应完成`);
                        resolve({
                            session,
                            success: true,
                            response
                        });
                    });

                    completion.on('error', (error) => {
                        log(`[Session ${index + 1}] 错误: ${error}`);
                        resolve({
                            session,
                            success: false,
                            error: error.message
                        });
                    });
                });
            } catch (error) {
                log(`[Session ${index + 1}] 发生错误: ${error}`);
                return {
                    session,
                    success: false,
                    error: error.message
                };
            }
        };
    });

    log('\n开始并行测试...\n');
    const startTime = Date.now();

    // 同时启动所有任务
    const results = await Promise.all(tasks.map(async (task, index) => {
        // 添加一个小延迟，避免完全同时发送请求
        await new Promise(resolve => setTimeout(resolve, index * 500));
        return task();
    }));

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    // 输出测试结果
    log('\n测试结果汇总:');
    log('====================');
    log(`总耗时: ${totalTime.toFixed(2)}秒`);
    log('====================');
    
    results.forEach((result, index) => {
        log(`\n会话 ${index + 1} (${result.session}):`);
        log('状态: ' + (result.success ? '成功' : '失败'));
        if (result.success) {
            log('响应长度: ' + result.response.length);
        } else {
            log('错误信息: ' + result.error);
        }
    });

    // 关闭日志流
    logStream.end();

    // 关闭进程
    process.exit(0);
}

// 运行测试
runParallelTest().catch(error => {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
}); 